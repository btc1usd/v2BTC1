import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to proxy 0x Protocol swap quotes
 * Avoids CORS issues by making requests from server-side
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const sellToken = searchParams.get('sellToken');
    const buyToken = searchParams.get('buyToken');
    const sellAmount = searchParams.get('sellAmount');
    const takerAddress = searchParams.get('takerAddress');
    const slippagePercentage = searchParams.get('slippagePercentage') || '0.01';
    
    if (!sellToken || !buyToken || !sellAmount || !takerAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Build 0x API request
    const params = new URLSearchParams({
      sellToken,
      buyToken,
      sellAmount,
      takerAddress,
      slippagePercentage,
    });

    const zeroxUrl = `https://base.api.0x.org/swap/v1/price?${params}`;
    
    // Make request to 0x API from server
    const response = await fetch(zeroxUrl, {
      headers: {
        '0x-api-key': process.env.ZEROX_API_KEY || process.env.NEXT_PUBLIC_0X_API_KEY || '',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.reason || `0x API error: ${response.status}`, details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Swap quote proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for getting executable swap transaction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { sellToken, buyToken, sellAmount, takerAddress, slippagePercentage = '0.01' } = body;
    
    if (!sellToken || !buyToken || !sellAmount || !takerAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Build 0x API request for executable quote
    const params = new URLSearchParams({
      sellToken,
      buyToken,
      sellAmount,
      takerAddress,
      slippagePercentage,
    });

    const zeroxUrl = `https://base.api.0x.org/swap/v1/quote?${params}`;
    
    // Make request to 0x API from server
    const response = await fetch(zeroxUrl, {
      headers: {
        '0x-api-key': process.env.ZEROX_API_KEY || process.env.NEXT_PUBLIC_0X_API_KEY || '',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.reason || `0x API error: ${response.status}`, details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Swap transaction proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch swap transaction', message: error.message },
      { status: 500 }
    );
  }
}
