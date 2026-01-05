import { NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { CONTRACT_ADDRESSES } from '@/lib/contracts';

// Determine which chain to use based on environment
const getChain = () => {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '8453');
  return chainId === 84532 ? baseSepolia : base;
};

const getRpcUrl = () => {
  const rpcUrls = (process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org').split(',');
  return rpcUrls[0].trim();
};

// Create public client for reading contract data
const publicClient = createPublicClient({
  chain: getChain(),
  transport: http(getRpcUrl()),
});

// ABI definitions for the contracts
const BTC1USD_ABI = [
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const VAULT_ABI = [
  {
    inputs: [],
    name: "getTotalCollateralValue",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getCurrentCollateralRatio",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ORACLE_ABI = [
  {
    inputs: [],
    name: "getBTCPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // json or raw

    // Fetch all data in parallel
    const [totalSupplyRaw, btcReservesRaw, collateralRatioRaw, btcPriceRaw] = await Promise.all([
      publicClient.readContract({
        address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
        abi: BTC1USD_ABI,
        functionName: 'totalSupply',
      }).catch(() => 0n),
      
      publicClient.readContract({
        address: CONTRACT_ADDRESSES.VAULT as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'getTotalCollateralValue',
      }).catch(() => 0n),
      
      publicClient.readContract({
        address: CONTRACT_ADDRESSES.VAULT as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'getCurrentCollateralRatio',
      }).catch(() => 0n),
      
      publicClient.readContract({
        address: CONTRACT_ADDRESSES.CHAINLINK_BTC_ORACLE as `0x${string}`,
        abi: ORACLE_ABI,
        functionName: 'getBTCPrice',
      }).catch(() => 0n),
    ]);

    // Format the values (all use 8 decimals)
    const totalSupply = parseFloat(formatUnits(totalSupplyRaw as bigint, 8));
    const btcReserves = parseFloat(formatUnits(btcReservesRaw as bigint, 8));
    const collateralRatio = parseFloat(formatUnits(collateralRatioRaw as bigint, 8));
    const btcPrice = parseFloat(formatUnits(btcPriceRaw as bigint, 8));

    const stats = {
      success: true,
      timestamp: new Date().toISOString(),
      network: getChain().name,
      chainId: getChain().id,
      data: {
        circulatingSupply: totalSupply,
        btcReservesValue: btcReserves,
        collateralRatio: collateralRatio,
        rewardsPeriodDays: 7,
        btcPrice: btcPrice,
      },
      formatted: {
        circulatingSupply: `${totalSupply.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BTC1`,
        btcReservesValue: `$${btcReserves.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        collateralRatio: `${(collateralRatio * 100).toFixed(2)}%`,
        rewardsPeriodDays: '7 days',
        btcPrice: `$${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      contracts: {
        btc1usd: CONTRACT_ADDRESSES.BTC1USD,
        vault: CONTRACT_ADDRESSES.VAULT,
        oracle: CONTRACT_ADDRESSES.CHAINLINK_BTC_ORACLE,
      }
    };

    // Return raw format if requested
    if (format === 'raw') {
      return NextResponse.json({
        success: true,
        circulatingSupply: totalSupply,
        btcReservesValue: btcReserves,
        collateralRatio: collateralRatio,
        rewardsPeriodDays: 7,
        btcPrice: btcPrice,
      });
    }

    return NextResponse.json(stats, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
      },
    });
  } catch (error) {
    console.error('Error fetching protocol stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch protocol stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
