/**
 * RPC Health Check Utility
 * Monitors the health of configured RPC endpoints
 */

export interface RPCEndpoint {
  url: string;
  name: string;
  priority: number;
}

export interface RPCHealthStatus {
  url: string;
  name: string;
  healthy: boolean;
  latency: number | null;
  error: string | null;
}

export async function checkRPCHealth(url: string): Promise<RPCHealthStatus> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return {
        url,
        name: extractRPCName(url),
        healthy: false,
        latency,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (data.error) {
      return {
        url,
        name: extractRPCName(url),
        healthy: false,
        latency,
        error: data.error.message || 'RPC Error',
      };
    }

    return {
      url,
      name: extractRPCName(url),
      healthy: true,
      latency,
      error: null,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return {
      url,
      name: extractRPCName(url),
      healthy: false,
      latency,
      error: error.message || 'Network error',
    };
  }
}

export async function checkAllRPCs(): Promise<RPCHealthStatus[]> {
  const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const rpcUrls = process.env.NEXT_PUBLIC_RPC_URL?.split(',').map(url => url.trim()).filter(Boolean) || [];

  const endpoints: string[] = [];

  if (alchemyApiKey) {
    endpoints.push(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`);
  }

  endpoints.push(...rpcUrls);

  // Add public fallbacks
  endpoints.push(
    'https://mainnet.base.org',
    'https://base.publicnode.com',
    'https://base.blockpi.network/v1/rpc/public',
    'https://base-pokt.nodies.app'
  );

  // Remove duplicates
  const uniqueEndpoints = Array.from(new Set(endpoints));

  // Check all endpoints in parallel
  const results = await Promise.all(
    uniqueEndpoints.map(url => checkRPCHealth(url))
  );

  return results;
}

function extractRPCName(url: string): string {
  if (url.includes('alchemy.com')) return 'Alchemy';
  if (url.includes('base.org')) return 'Base Official';
  if (url.includes('pokt.network')) return 'Pocket Network';
  if (url.includes('publicnode.com')) return 'PublicNode';
  if (url.includes('blockpi.network')) return 'BlockPI';
  return 'Unknown RPC';
}

// Log RPC health status to console
export async function logRPCHealth() {
  console.log('🏥 Checking RPC endpoint health...');
  const results = await checkAllRPCs();

  const healthy = results.filter(r => r.healthy);
  const unhealthy = results.filter(r => !r.healthy);

  console.log(`\n✅ Healthy endpoints (${healthy.length}):`);
  healthy
    .sort((a, b) => (a.latency || Infinity) - (b.latency || Infinity))
    .forEach(rpc => {
      console.log(`   ${rpc.name}: ${rpc.latency}ms`);
    });

  if (unhealthy.length > 0) {
    console.log(`\n❌ Unhealthy endpoints (${unhealthy.length}):`);
    unhealthy.forEach(rpc => {
      console.log(`   ${rpc.name}: ${rpc.error}`);
    });
  }

  return { healthy, unhealthy, total: results };
}
