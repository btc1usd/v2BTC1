import { NextRequest, NextResponse } from "next/server";

/**
 * 0x Swap Quote Proxy (Base Mainnet)
 * - Returns executable swap transaction
 * - Handles ETH normalization
 * - Server-side only API key
 */

const ZEROX_BASE_URL = "https://base.api.0x.org/swap/v1/quote";
const ETH_PLACEHOLDER = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;

    let sellToken = params.get("sellToken");
    const buyToken = params.get("buyToken");
    const sellAmount = params.get("sellAmount");
    const takerAddress = params.get("takerAddress");
    const slippagePercentage = params.get("slippagePercentage") || "0.01";

    if (!sellToken || !buyToken || !sellAmount || !takerAddress) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Normalize ETH for 0x
    if (sellToken === ETH_PLACEHOLDER) {
      sellToken = "ETH";
    }

    const apiKey = process.env.Zerox_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "0x API key not configured" },
        { status: 500 }
      );
    }

    const zeroxParams = new URLSearchParams({
      sellToken,
      buyToken,
      sellAmount,
      takerAddress,
      slippagePercentage,
    });

    const response = await fetch(
      `${ZEROX_BASE_URL}?${zeroxParams.toString()}`,
      {
        headers: {
          "0x-api-key": apiKey,
        },
      }
    );

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    console.error("0x proxy error:", err);

    return NextResponse.json(
      {
        error: "Failed to fetch swap quote",
        message: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
