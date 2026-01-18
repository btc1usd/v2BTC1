import { NextRequest, NextResponse } from "next/server";

const ZEROX_URL = "https://base.api.0x.org/swap/v1/quote";
const ETH_PLACEHOLDER = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;

    let sellToken = p.get("sellToken");
    const buyToken = p.get("buyToken");
    const sellAmount = p.get("sellAmount");
    const takerAddress = p.get("takerAddress");
    const slippagePercentage = p.get("slippagePercentage") || "0.01";

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

    const apiKey = process.env.ZEROX_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "0x API key not configured" },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      sellToken,
      buyToken,
      sellAmount,
      takerAddress,
      slippagePercentage,
    });

    const response = await fetch(`${ZEROX_URL}?${params}`, {
      headers: {
        "0x-api-key": apiKey,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch swap quote", message: err.message },
      { status: 500 }
    );
  }
}
