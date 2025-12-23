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

    const governanceDAO = new ethers.Contract(
      daoAddress,
      GOVERNANCE_DAO_ABI,
      provider
    );

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
      proposalCount = await governanceDAO.proposalCount();
    } catch (error: any) {
      console.error('Error fetching proposal count:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch proposal count', 
          details: error.message,
          suggestions: [
            "Check contract deployment",
            "Verify RPC configuration",
            "Try again in a few minutes"
          ]
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