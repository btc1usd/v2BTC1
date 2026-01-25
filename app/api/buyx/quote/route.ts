export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { Bridge } from "thirdweb";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { client as thirdwebClient } from "@/lib/thirdweb-client";

/**
 * BuyX Quote API (On-ramp)
 * Prepares an on-ramp session and returns a link
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      onramp = "coinbase", // stripe, coinbase, or transak
      chainId = 8453,
      tokenAddress = CONTRACT_ADDRESSES.BTC1USD,
      receiver,
      amountWei, // Optional
      currency = "USD",
      country = "US"
    } = body;

    if (!receiver) {
      return NextResponse.json(
        { error: "Missing required field: receiver" },
        { status: 400 }
      );
    }

    const preparedOnramp = await Bridge.Onramp.prepare({
      client: thirdwebClient,
      onramp: onramp as any,
      chainId: Number(chainId),
      tokenAddress: tokenAddress as any,
      receiver: receiver as any,
      amount: amountWei ? BigInt(amountWei) : undefined,
      currency,
      country,
    });

    return NextResponse.json({
      link: preparedOnramp.link,
      id: preparedOnramp.id,
      currency: preparedOnramp.currency,
      currencyAmount: preparedOnramp.currencyAmount,
      destinationAmount: preparedOnramp.destinationAmount.toString(),
      expiration: preparedOnramp.expiration,
      intent: {
        ...preparedOnramp.intent,
        amount: preparedOnramp.intent.amount?.toString()
      }
    });
  } catch (error: any) {
    console.error("BuyX quote API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch BuyX quote" },
      { status: 500 }
    );
  }
}
