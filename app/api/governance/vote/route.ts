import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ABIS } from '@/lib/contracts';
import { createProviderWithFallback } from '@/lib/rpc-provider'; // Added import

const GOVERNANCE_DAO_ABI = [
  "function proposalCount() view returns (uint256)",
  "function getProposal(uint256 proposalId) view returns (address proposer, string title, string description, uint8 category, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint256 startBlock, uint256 endBlock, uint256 eta, bool executed, bool canceled)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function hasVoted(uint256 proposalId, address account) view returns (bool)",
  "function getReceipt(uint256 proposalId, address voter) view returns (bool hasVoted, uint8 support, uint256 votes)",
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proposalId = searchParams.get('proposalId');
    const voterAddress = searchParams.get('voter');

    if (!proposalId || !voterAddress) {
      return NextResponse.json(
        { error: 'Missing proposalId or voter address' },
        { status: 400 }
      );
    }

    // Use robust provider with fallback
    const provider = await createProviderWithFallback(8453, {
      timeout: 15000, // Increased timeout
      maxRetries: 3,
      retryDelay: 2000, // Increased delay
      backoffMultiplier: 2
    });

    const governanceDAO = new ethers.Contract(
      process.env.NEXT_PUBLIC_GOVERNANCE_DAO_CONTRACT || CONTRACT_ADDRESSES.GOVERNANCE_DAO,
      GOVERNANCE_DAO_ABI,
      provider
    );

    const receipt = await governanceDAO.getReceipt(parseInt(proposalId), voterAddress);

    return NextResponse.json({
      hasVoted: receipt[0],
      support: Number(receipt[1]),
      votes: ethers.formatUnits(receipt[2], 8),
    });
  } catch (error: any) {
    console.error('Error fetching vote receipt:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch vote receipt', 
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
    const { proposalId, support, voterAddress } = body;

    if (!proposalId || support === undefined || !voterAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use robust provider with fallback
    const provider = await createProviderWithFallback(8453, {
      timeout: 15000, // Increased timeout
      maxRetries: 3,
      retryDelay: 2000, // Increased delay
      backoffMultiplier: 2
    });

    const governanceDAO = new ethers.Contract(
      process.env.NEXT_PUBLIC_GOVERNANCE_DAO_CONTRACT || CONTRACT_ADDRESSES.GOVERNANCE_DAO,
      GOVERNANCE_DAO_ABI,
      provider
    );

    // Check if user has already voted
    const hasVoted = await governanceDAO.hasVoted(proposalId, voterAddress);
    if (hasVoted) {
      return NextResponse.json(
        { error: 'User has already voted on this proposal' },
        { status: 400 }
      );
    }

    // Return vote data for frontend to execute
    return NextResponse.json({
      success: true,
      message: 'Vote data prepared for submission',
      voteData: {
        proposalId,
        support,
        voterAddress,
      },
    });
  } catch (error: any) {
    console.error('Error processing vote:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process vote', 
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