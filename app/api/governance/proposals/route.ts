import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ABIS } from '@/lib/contracts';
import { createProviderWithFallback } from '@/lib/rpc-provider'; // Added import

const GOVERNANCE_DAO_ABI = [
  "function proposalCount() view returns (uint256)",
  "function getProposal(uint256 proposalId) view returns (address proposer, string title, string description, uint8 category, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint256 startBlock, uint256 endBlock, uint256 eta, bool executed, bool canceled)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function getQuorum(uint8 category) view returns (uint256)",
  "function categoryThreshold(uint8 category) view returns (uint256)",
];

const CATEGORY_NAMES = [
  'Parameter Change',
  'Contract Upgrade',
  'Emergency Action',
  'Treasury Action',
  'Endowment Non-Profit',
  'Endowment Distribution',
  'Governance Change',
  'Oracle Update',
];

const STATE_NAMES = [
  'Pending',
  'Active',
  'Canceled',
  'Defeated',
  'Succeeded',
  'Queued',
  'Expired',
  'Executed',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proposalId = searchParams.get('id');
    const status = searchParams.get('status');

    // Use the chain ID from environment variables
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");

    // Use robust provider with fallback
    const provider = await createProviderWithFallback(chainId, {
      timeout: 15000, // Increased timeout
      maxRetries: 3,
      retryDelay: 2000, // Increased delay
      backoffMultiplier: 2
    });

    // Use the correct contract address from environment or fallback to CONTRACT_ADDRESSES
    const daoAddress = process.env.NEXT_PUBLIC_DAO_CONTRACT || CONTRACT_ADDRESSES.GOVERNANCE_DAO;

    // Check if the contract exists at this address
    let code;
    try {
      code = await provider.getCode(daoAddress);
    } catch (error: any) {
      console.error('Error checking contract code:', error);
      return NextResponse.json(
        { 
          error: 'Failed to verify contract existence', 
          details: error.message,
          contractAddress: daoAddress,
          suggestions: [
            "Check if you're on the correct network",
            "Verify the DAO contract is deployed",
            "Check NEXT_PUBLIC_DAO_CONTRACT in .env"
          ]
        },
        { status: 500 }
      );
    }

    if (code === '0x') {
      console.error(`No contract found at DAO address: ${daoAddress}`);
      return NextResponse.json(
        { 
          error: 'Governance DAO contract not found', 
          details: `No contract code at address ${daoAddress}`,
          contractAddress: daoAddress,
          network: chainId,
          suggestions: [
            "Check if you're connected to the correct network (Base Sepolia Testnet: 84532, Base Mainnet: 8453)",
            "Verify NEXT_PUBLIC_DAO_CONTRACT in your .env file",
            "Ensure the DAO contract has been deployed",
            "Check deployment-base-mainnet.json for the correct address"
          ]
        },
        { status: 404 }
      );
    }

    const governanceDAO = new ethers.Contract(
      daoAddress,
      GOVERNANCE_DAO_ABI,
      provider
    );

    // Debug: Log contract info
    console.log('=== DAO Contract Debugging ===');
    console.log('Address:', daoAddress);
    console.log('Network:', chainId);
    console.log('Code exists:', code !== '0x');
    console.log('Code length:', code?.length);
    console.log('===============================');

    // Get single proposal
    if (proposalId) {
      const id = parseInt(proposalId);
      
      // Validate proposal ID
      if (isNaN(id) || id <= 0) {
        return NextResponse.json(
          { error: 'Invalid proposal ID' },
          { status: 400 }
        );
      }

      try {
        const proposalData = await governanceDAO.getProposal(id);
        const proposalState = await governanceDAO.state(id);

        // Validate that we received valid data
        if (!proposalData || proposalData.length === 0) {
          return NextResponse.json(
            { error: 'Proposal not found or invalid data returned' },
            { status: 404 }
          );
        }

        const proposal: any = {
          id,
          proposer: proposalData[0],
          title: proposalData[1],
          description: proposalData[2],
          category: CATEGORY_NAMES[Number(proposalData[3])] || 'Unknown',
          categoryId: Number(proposalData[3]),
          forVotes: ethers.formatUnits(proposalData[4], 8),
          againstVotes: ethers.formatUnits(proposalData[5], 8),
          abstainVotes: ethers.formatUnits(proposalData[6], 8),
          startBlock: Number(proposalData[7]),
          endBlock: Number(proposalData[8]),
          eta: Number(proposalData[9]),
          executed: proposalData[10],
          canceled: proposalData[11],
          state: STATE_NAMES[Number(proposalState)] || 'Unknown',
          stateId: Number(proposalState),
        };

        // Get quorum for this category
        const quorum = await governanceDAO.getQuorum(proposalData[3]);
        proposal.quorum = ethers.formatUnits(quorum, 8);

        // Calculate vote percentage
        const totalVotes = parseFloat(proposal.forVotes) + parseFloat(proposal.againstVotes) + parseFloat(proposal.abstainVotes);
        proposal.quorumReached = totalVotes >= parseFloat(proposal.quorum);
        proposal.votePercentage = totalVotes > 0
          ? {
              for: (parseFloat(proposal.forVotes) / totalVotes) * 100,
              against: (parseFloat(proposal.againstVotes) / totalVotes) * 100,
              abstain: (parseFloat(proposal.abstainVotes) / totalVotes) * 100,
            }
          : { for: 0, against: 0, abstain: 0 };

        return NextResponse.json({ proposal });
      } catch (error: any) {
        console.error(`Error fetching proposal ${id}:`, error);
        return NextResponse.json(
          { 
            error: `Failed to fetch proposal ${id}`, 
            details: error.message,
            suggestions: [
              "Check if the proposal exists",
              "Verify contract deployment",
              "Try again in a few minutes"
            ]
          },
          { status: 500 }
        );
      }
    }

    // Get all proposals or filtered by status
    let proposalCount;
    try {
      // First verify the contract has the proposalCount function by checking if it returns valid data
      proposalCount = await governanceDAO.proposalCount();
      
      // Validate that we got a valid response
      if (proposalCount === undefined || proposalCount === null) {
        throw new Error('proposalCount returned undefined/null - contract may not be properly deployed');
      }
      
      console.log(`Successfully fetched proposal count: ${proposalCount}`);
    } catch (error: any) {
      console.error('Error fetching proposal count:', error);
      
      // Provide detailed error information
      let errorDetails = error.message;
      let suggestions = [
        "Check contract deployment",
        "Verify RPC configuration",
        "Try again in a few minutes"
      ];
      
      if (error.code === 'BAD_DATA' || error.message?.includes('could not decode')) {
        errorDetails = `Contract call failed - the contract at ${daoAddress} exists but doesn't implement proposalCount() or returned invalid data`;
        suggestions = [
          `Verify the DAO contract address in .env: ${daoAddress}`,
          "Check if the contract is the correct DAO implementation",
          `Verify you're on the correct network (current: ${chainId})`,
          "Check deployment-base-mainnet.json for the correct DAO address",
          "The contract may need to be redeployed or upgraded"
        ];
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch proposal count', 
          details: errorDetails,
          contractAddress: daoAddress,
          network: chainId,
          errorCode: error.code,
          suggestions
        },
        { status: 500 }
      );
    }

    const proposals: any[] = [];

    for (let i = 1; i <= Number(proposalCount); i++) {
      try {
        const proposalData = await governanceDAO.getProposal(i);
        const proposalState = await governanceDAO.state(i);
        const stateString = STATE_NAMES[Number(proposalState)] || 'Unknown';

        // Filter by status if provided
        if (status && stateString.toLowerCase() !== status.toLowerCase()) {
          continue;
        }

        // Validate that we received valid data
        if (!proposalData || proposalData.length === 0) {
          continue; // Skip invalid proposals
        }

        const forVotes = ethers.formatUnits(proposalData[4], 8);
        const againstVotes = ethers.formatUnits(proposalData[5], 8);
        const abstainVotes = ethers.formatUnits(proposalData[6], 8);

        // Calculate vote percentage
        const totalVotes = parseFloat(forVotes) + parseFloat(againstVotes) + parseFloat(abstainVotes);
        const votePercentage = totalVotes > 0
          ? {
              for: (parseFloat(forVotes) / totalVotes) * 100,
              against: (parseFloat(againstVotes) / totalVotes) * 100,
              abstain: (parseFloat(abstainVotes) / totalVotes) * 100,
            }
          : { for: 0, against: 0, abstain: 0 };

        const proposal: any = {
          id: i,
          proposer: proposalData[0],
          title: proposalData[1],
          description: proposalData[2],
          category: CATEGORY_NAMES[Number(proposalData[3])] || 'Unknown',
          categoryId: Number(proposalData[3]),
          forVotes,
          againstVotes,
          abstainVotes,
          startBlock: Number(proposalData[7]),
          endBlock: Number(proposalData[8]),
          eta: Number(proposalData[9]),
          executed: proposalData[10],
          canceled: proposalData[11],
          state: stateString,
          stateId: Number(proposalState),
          votePercentage,
        };

        proposals.push(proposal);
      } catch (error: any) {
        console.warn(`Skipping proposal ${i} due to error:`, error.message);
        // Continue with next proposal instead of failing completely
        continue;
      }
    }

    // Sort by ID descending (newest first)
    proposals.sort((a, b) => b.id - a.id);

    return NextResponse.json({ proposals, total: proposals.length });
  } catch (error: any) {
    console.error('Error fetching proposals:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch proposals', 
        details: error.message,
        suggestions: [
          "Check your network connection",
          "Verify RPC configuration",
          "Try again in a few minutes"
        ]
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      category,
      targets,
      values,
      signatures,
      calldatas,
      walletAddress,
    } = body;

    // Validation
    if (!title || !description || category === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Return proposal data for frontend to execute
    return NextResponse.json({
      success: true,
      message: 'Proposal data prepared for submission',
      proposalData: {
        title,
        description,
        category,
        targets: targets || [],
        values: values || [],
        signatures: signatures || [],
        calldatas: calldatas || [],
      },
    });
  } catch (error: any) {
    console.error('Error creating proposal:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create proposal', 
        details: error.message,
        suggestions: [
          "Check your network connection",
          "Verify RPC configuration",
          "Try again in a few minutes"
        ]
      },
      { status: 500 }
    );
  }
}