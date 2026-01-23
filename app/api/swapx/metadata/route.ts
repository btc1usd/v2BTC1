export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { Bridge } from "thirdweb";
import { client as thirdwebClient } from "@/lib/thirdweb-client";

export async function GET(_req: NextRequest) {
  try {
    const originChainId = 8453; // Base
    const destinationChainId = 8453; // Base -> BTC1 on Base

    // Use Bridge.routes to discover available origin tokens on Base
    const routes: any[] = await (Bridge as any).routes({
      originChainId,
      destinationChainId,
      client: thirdwebClient,
    });

    const tokensMap: Record<string, { address: string; symbol: string; name: string }> = {};

    for (const route of routes || []) {
      const t = route?.originToken;
      if (t?.address) {
        const key = (t.address as string).toLowerCase();
        if (!tokensMap[key]) {
          tokensMap[key] = {
            address: t.address,
            symbol: t.symbol || t.address.slice(0, 6),
            name: t.name || t.symbol || t.address,
          };
        }
      }
    }

    const tokens = Object.values(tokensMap);

    return NextResponse.json({
      chains: [{ chainId: originChainId, name: "Base" }],
      tokens,
    });
  } catch (error: any) {
    console.error("SwapX metadata API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load SwapX metadata" },
      { status: 500 }
    );
  }
}
