export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { Bridge } from "thirdweb";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { client as thirdwebClient } from "@/lib/thirdweb-client";

// Simple mapping for supported origin tokens on Base
const BASE_TOKENS = {
  eth: {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    decimals: 18,
  },
  usdc: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
  },
} as const;

interface SwapQuoteRequestBody {
  fromAddress: string;
  fromToken: keyof typeof BASE_TOKENS;
  amount: string; // human-readable amount, e.g. "1.23"
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<SwapQuoteRequestBody>;
    const { fromAddress, fromToken, amount } = body;

    if (!fromAddress || !fromToken || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: fromAddress, fromToken, amount" },
        { status: 400 }
      );
    }

    const tokenConfig = BASE_TOKENS[fromToken];
    if (!tokenConfig) {
      return NextResponse.json(
        { error: "Unsupported fromToken" },
        { status: 400 }
      );
    }

    // For now, we assume swaps are on Base -> BTC1 on Base
    const originChainId = 8453;
    const destinationChainId = 8453;
    const originTokenAddress = tokenConfig.address;
    const destinationTokenAddress = CONTRACT_ADDRESSES.BTC1USD;

    // Convert human-readable amount to wei based on token decimals
    let sellAmountWei: string;
    try {
      sellAmountWei = ethers.parseUnits(amount, tokenConfig.decimals).toString();
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid amount format" },
        { status: 400 }
      );
    }

    const quote = await Bridge.Sell.quote({
      originChainId,
      originTokenAddress,
      destinationChainId,
      destinationTokenAddress,
      sellAmountWei,
      client: thirdwebClient,
    });

    return NextResponse.json({
      quote,
      meta: {
        originChainId,
        originTokenAddress,
        destinationChainId,
        destinationTokenAddress,
      },
    });
  } catch (error: any) {
    console.error("SwapX quote API error:", error);

    const message =
      typeof error?.message === "string"
        ? error.message
        : "Failed to fetch SwapX quote";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
