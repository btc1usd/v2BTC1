export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { Bridge } from "thirdweb";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { client as thirdwebClient } from "@/lib/thirdweb-client";

/**
 * Recursively convert all BigInt values in an object to strings
 */
function deepSerializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(deepSerializeBigInt);
  }
  
  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[key] = deepSerializeBigInt(obj[key]);
  }
  return result;
}

/**
 * SwapX Quote API
 * Fetches an estimate for a token swap
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      fromTokenAddress, 
      fromChainId, 
      amountWei, // Amount in wei (string or bigint)
      toTokenAddress,
      toChainId 
    } = body;

    if (!fromTokenAddress || !fromChainId || !amountWei) {
      return NextResponse.json(
        { error: "Missing required fields: fromTokenAddress, fromChainId, amountWei" },
        { status: 400 }
      );
    }

    const originChainId = Number(fromChainId);
    const destinationChainId = Number(toChainId || 8453);
    const originTokenAddress = fromTokenAddress;
    const destinationTokenAddress = toTokenAddress || CONTRACT_ADDRESSES.BTC1USD;
    const amount = BigInt(amountWei);

    const quote = await Bridge.Sell.quote({
      originChainId,
      originTokenAddress,
      destinationChainId,
      destinationTokenAddress,
      amount,
      client: thirdwebClient,
    });

    return NextResponse.json(deepSerializeBigInt({
      quote,
      intent: {
        originChainId,
        originTokenAddress,
        destinationChainId,
        destinationTokenAddress,
        amount: amount.toString(),
      }
    }));
  } catch (error: any) {
    console.error("SwapX quote API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch SwapX quote" },
      { status: 500 }
    );
  }
}
