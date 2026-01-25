export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { client as thirdwebClient } from "@/lib/thirdweb-client";

/**
 * Fetch tokens for a specific chain from Thirdweb Bridge API
 * Returns token data in a mobile-friendly format
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get("chainId");
    const limit = searchParams.get("limit") || "100";
    const offset = searchParams.get("offset") || "0";
    const includePrices = searchParams.get("includePrices") === "true";

    if (!chainId) {
      return NextResponse.json(
        { error: "Missing required parameter: chainId" },
        { status: 400 }
      );
    }

    // Validate chainId is a number
    const chainIdNum = Number(chainId);
    if (isNaN(chainIdNum) || chainIdNum <= 0) {
      return NextResponse.json(
        { error: "Invalid chainId parameter" },
        { status: 400 }
      );
    }

    // Validate limit and offset are numbers
    const limitNum = Number(limit);
    const offsetNum = Number(offset);
    if (isNaN(limitNum) || isNaN(offsetNum) || limitNum <= 0 || offsetNum < 0) {
      return NextResponse.json(
        { error: "Invalid limit or offset parameters" },
        { status: 400 }
      );
    }

    // Construct the Thirdweb Bridge API URL
    const apiUrl = `https://bridge.thirdweb.com/v1/tokens?chainId=${chainIdNum}&limit=${limitNum}&offset=${offsetNum}&includePrices=${includePrices}`;

    // Fetch tokens from Thirdweb Bridge API
    const response = await fetch(apiUrl, {
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "x-client-id": process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || thirdwebClient.clientId
      },
      // Add a reasonable timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      // Return a more descriptive error based on the status code
      const errorText = await response.text().catch(() => response.statusText);
      return NextResponse.json(
        { 
          error: "Failed to fetch tokens from Thirdweb Bridge API",
          details: `HTTP ${response.status}: ${errorText}`
        },
        { status: response.status }
      );
    }

    const tokens = await response.json();

    // Check if tokens is an array or has a different structure
    let tokenList: any[];
    if (Array.isArray(tokens)) {
      tokenList = tokens;
    } else if (tokens && typeof tokens === 'object' && Array.isArray(tokens.data)) {
      // Thirdweb Bridge API returns tokens in a 'data' property
      tokenList = tokens.data;
    } else if (tokens && typeof tokens === 'object' && Array.isArray(tokens.tokens)) {
      tokenList = tokens.tokens;
    } else {
      console.error('Unexpected response format from Bridge API:', tokens);
      tokenList = [];
    }

    // Process tokens to ensure they're in a mobile-friendly format
    const processedTokens = tokenList.map((token: any) => ({
      address: token.address || token.tokenAddress,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      logo: token.iconUri || token.icon || token.logo,
      price: token.price,
      verified: token.verified,
      chainId: token.chainId,
    }));

    return NextResponse.json({
      tokens: processedTokens,
      chainId: chainIdNum,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: processedTokens.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Tokens API error:", error);

    // Handle timeout specifically
    if (error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: "Request timed out while fetching tokens" },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { 
        error: error?.message || "Failed to fetch tokens",
        details: typeof error === "string" ? error : "Internal server error"
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for fetching tokens by chainId in the request body
 * Useful for bulk operations or when query params aren't suitable
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainId, limit = 100, offset = 0, includePrices = false } = body;

    if (!chainId) {
      return NextResponse.json(
        { error: "Missing required field: chainId" },
        { status: 400 }
      );
    }

    // Validate chainId is a number
    const chainIdNum = Number(chainId);
    if (isNaN(chainIdNum) || chainIdNum <= 0) {
      return NextResponse.json(
        { error: "Invalid chainId parameter" },
        { status: 400 }
      );
    }

    // Validate limit and offset are numbers
    const limitNum = Number(limit);
    const offsetNum = Number(offset);
    if (isNaN(limitNum) || isNaN(offsetNum) || limitNum <= 0 || offsetNum < 0) {
      return NextResponse.json(
        { error: "Invalid limit or offset parameters" },
        { status: 400 }
      );
    }

    // Construct the Thirdweb Bridge API URL
    const apiUrl = `https://bridge.thirdweb.com/v1/tokens?chainId=${chainIdNum}&limit=${limitNum}&offset=${offsetNum}&includePrices=${includePrices}`;

    // Fetch tokens from Thirdweb Bridge API
    const response = await fetch(apiUrl, {
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "x-client-id": process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || thirdwebClient.clientId
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      return NextResponse.json(
        { 
          error: "Failed to fetch tokens from Thirdweb Bridge API",
          details: `HTTP ${response.status}: ${errorText}`
        },
        { status: response.status }
      );
    }

    const tokens = await response.json();

    // Check if tokens is an array or has a different structure
    let tokenList: any[];
    if (Array.isArray(tokens)) {
      tokenList = tokens;
    } else if (tokens && typeof tokens === 'object' && Array.isArray(tokens.data)) {
      // Thirdweb Bridge API returns tokens in a 'data' property
      tokenList = tokens.data;
    } else if (tokens && typeof tokens === 'object' && Array.isArray(tokens.tokens)) {
      tokenList = tokens.tokens;
    } else {
      console.error('Unexpected response format from Bridge API:', tokens);
      tokenList = [];
    }

    // Process tokens to ensure they're in a mobile-friendly format
    const processedTokens = tokenList.map((token: any) => ({
      address: token.address || token.tokenAddress,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      logo: token.iconUri || token.icon || token.logo,
      price: token.price,
      verified: token.verified,
      chainId: token.chainId,
    }));

    return NextResponse.json({
      tokens: processedTokens,
      chainId: Number(chainIdNum),
      pagination: {
        limit: Number(limitNum),
        offset: Number(offsetNum),
        total: processedTokens.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Tokens POST API error:", error);

    // Handle timeout specifically
    if (error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: "Request timed out while fetching tokens" },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { 
        error: error?.message || "Failed to fetch tokens",
        details: typeof error === "string" ? error : "Internal server error"
      },
      { status: 500 }
    );
  }
}