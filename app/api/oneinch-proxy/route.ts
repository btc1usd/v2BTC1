import { NextRequest, NextResponse } from 'next/server';

/**
 * 1inch API Proxy Route
 * 
 * Proxies requests to 1inch API to avoid CORS issues in the browser
 * All 1inch API calls should go through this endpoint
 */

const ONEINCH_API_BASE = 'https://api.1inch.dev/swap/v5.2/8453';
const API_KEY = process.env.NEXT_PUBLIC_ONEINCH_API_KEY;

export async function GET(request: NextRequest) {
  try {
    // Get the endpoint and query params from the request
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing endpoint parameter' },
        { status: 400 }
      );
    }

    if (!API_KEY) {
      return NextResponse.json(
        { error: '1inch API key not configured' },
        { status: 500 }
      );
    }

    // Build the 1inch API URL
    const apiUrl = new URL(`${ONEINCH_API_BASE}/${endpoint}`);
    
    // Forward all query params except 'endpoint'
    searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
        apiUrl.searchParams.append(key, value);
      }
    });

    console.log('Proxying 1inch request:', apiUrl.toString());

    // Make the request to 1inch API with authorization
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
      },
    });

    // Get the response data
    const data = await response.json();

    // Return error if 1inch API returned an error
    if (!response.ok) {
      console.error('1inch API error:', response.status, data);
      return NextResponse.json(
        { 
          error: data.description || data.error || '1inch API request failed',
          details: data 
        },
        { status: response.status }
      );
    }

    // Return successful response
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('1inch proxy error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

// Enable CORS for this route
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
