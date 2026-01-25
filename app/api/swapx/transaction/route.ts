export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { Bridge } from "thirdweb";
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
 * SwapX Transaction API
 * Prepares finalized transactions for a token swap
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      fromTokenAddress, 
      fromChainId, 
      amountWei, 
      toTokenAddress,
      toChainId,
      sender,
      receiver 
    } = body;

    if (!fromTokenAddress || !fromChainId || !amountWei || !sender) {
      return NextResponse.json(
        { error: "Missing required fields: fromTokenAddress, fromChainId, amountWei, sender" },
        { status: 400 }
      );
    }

    const prepared = await Bridge.Sell.prepare({
      originChainId: Number(fromChainId),
      originTokenAddress: fromTokenAddress,
      destinationChainId: Number(toChainId || 8453),
      destinationTokenAddress: toTokenAddress,
      amount: BigInt(amountWei),
      sender: sender,
      receiver: receiver || sender,
      client: thirdwebClient,
    });

    // Extract all transactions from all steps
    const allTransactions = prepared.steps.flatMap(step => step.transactions);

    return NextResponse.json(deepSerializeBigInt({ 
      transactions: allTransactions,
      expiration: prepared.expiration,
      intent: prepared.intent
    }));
  } catch (error: any) {
    console.error("SwapX transaction API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate SwapX transaction" },
      { status: 500 }
    );
  }
}
