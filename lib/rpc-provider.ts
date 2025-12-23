import { JsonRpcProvider } from "ethers";

// Type definitions
interface RpcProviderConfig {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
}

interface ProviderHealth {
  url: string;
  isHealthy: boolean;
  responseTime: number;
  lastChecked: number;
  error?: string;
}

interface CachedProvider {
  url: string;
  timestamp: number;
}

// Global health cache
const providerHealthCache = new Map<string, ProviderHealth>();
const HEALTH_CHECK_TTL = 5 * 60 * 1000; // 5 minutes

// File for caching last working provider
const CACHE_FILE = '.rpc-provider-cache.json';

/**
 * Creates a robust JsonRpcProvider with health checks and timeout handling
 */
export async function createRobustProvider(
  url: string,
  chainId: number,
  config: RpcProviderConfig = {}
): Promise<JsonRpcProvider | null> {
  const { 
    timeout = 10000, 
    maxRetries = 3, 
    retryDelay = 1000,
    backoffMultiplier = 2
  } = config;
  
  console.log(`🔍 Testing RPC provider: ${url}`);
  
  // Check if provider is healthy from cache
  const cachedHealth = providerHealthCache.get(url);
  if (cachedHealth && Date.now() - cachedHealth.lastChecked < HEALTH_CHECK_TTL) {
    if (!cachedHealth.isHealthy) {
      console.warn(`⏭️ Skipping unhealthy provider (cached): ${url} - ${cachedHealth.error}`);
      return null;
    }
  }

  // Exponential backoff retry logic
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      
      // Create provider with explicit configuration
      const provider = new JsonRpcProvider(url, chainId, {
        staticNetwork: true
      });

      // Test provider health with timeout and proper error handling
      const healthCheckPromise = testProviderHealth(provider, timeout);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Provider health check timeout')), timeout)
      );

      await Promise.race([healthCheckPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      // Update health cache
      providerHealthCache.set(url, {
        url,
        isHealthy: true,
        responseTime,
        lastChecked: Date.now()
      });

      console.log(`✅ Provider healthy: ${url} (response time: ${responseTime}ms)`);
      return provider;
    } catch (error) {
      const errorMessage = (error as Error).message;
      const delay = retryDelay * Math.pow(backoffMultiplier, attempt);
      
      // Update health cache with error details
      providerHealthCache.set(url, {
        url,
        isHealthy: false,
        responseTime: -1,
        lastChecked: Date.now(),
        error: errorMessage
      });
      
      console.warn(`⚠️ Provider attempt ${attempt + 1}/${maxRetries + 1} failed: ${url} - ${errorMessage}`);
      
      // Don't delay on the last attempt
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.warn(`❌ All attempts failed for provider: ${url}`);
  return null;
}

/**
 * Tests provider health by checking chainId instead of fetching full blocks
 */
async function testProviderHealth(provider: JsonRpcProvider, timeout: number): Promise<void> {
  try {
    // Test with chainId which is faster and more reliable than fetching blocks
    const networkPromise = provider.getNetwork();
    const chainIdPromise = provider.send('eth_chainId', []);
    
    // Race both promises with timeout
    const networkResult = await Promise.race([
      networkPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Network check timeout')), timeout)
      )
    ]);
    
    const chainIdResult = await Promise.race([
      chainIdPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Chain ID check timeout')), timeout)
      )
    ]);
    
    // Validate we're on the correct network (support both Base Mainnet and Base Sepolia)
    const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
    if (networkResult.chainId !== BigInt(expectedChainId)) {
      throw new Error(`Wrong chain ID: expected ${expectedChainId}, got ${networkResult.chainId}`);
    }
    
    console.log(`🌐 Network verified: chainId=${chainIdResult}`);
  } catch (error) {
    throw new Error(`Health check failed: ${(error as Error).message}`);
  }
}

/**
 * Gets a list of RPC URLs prioritized by health and response time
 */
export function getPrioritizedRpcUrls(): string[] {
  const urls: string[] = [];
  
  // Get URLs from environment variables (support comma-separated values)
  const envUrls = (process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  urls.push(...envUrls);

  // Add Alchemy if configured
  const alchemyKey = process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (alchemyKey) {
    urls.push(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`);
  }

  // Add fallback public RPC endpoints (verified working ones first)
  urls.push(
    "https://mainnet.base.org",  // Official Base Mainnet endpoint
    "https://base.publicnode.com",  // Public node
    "https://base.blockpi.network/v1/rpc/public",  // BlockPI
    "https://base-pokt.nodies.app",  // Nodies (Pokt Network)
    "https://base-rpc.publicnode.com" // Alternative public node
  );

  // Remove duplicates
  const uniqueUrls = Array.from(new Set(urls));
  
  // Sort by health and response time
  return uniqueUrls.sort((a, b) => {
    const healthA = providerHealthCache.get(a);
    const healthB = providerHealthCache.get(b);
    
    // Unhealthy providers last
    if (healthA && !healthA.isHealthy) return 1;
    if (healthB && !healthB.isHealthy) return -1;
    
    // Healthy providers sorted by response time
    if (healthA && healthB) {
      return healthA.responseTime - healthB.responseTime;
    }
    
    // Providers without health data come after healthy ones
    if (healthA) return -1;
    if (healthB) return 1;
    
    // Both without health data, keep original order
    return 0;
  });
}

/**
 * Cache the last working provider to a file
 */
async function cacheLastWorkingProvider(url: string): Promise<void> {
  try {
    // Use dynamic import to handle both CommonJS and ES modules
    let fs: any;
    let path: any;
    
    try {
      // Try ES module approach first
      fs = await import('fs');
      path = await import('path');
    } catch {
      // Fallback to CommonJS
      fs = require('fs');
      path = require('path');
    }
    
    const cachePath = path.join(process.cwd(), CACHE_FILE);
    
    const cacheData: CachedProvider = {
      url,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
    console.log(`💾 Cached last working provider: ${url}`);
  } catch (error) {
    console.warn('⚠️ Failed to cache provider:', (error as Error).message);
  }
}

/**
 * Get cached last working provider
 */
async function getCachedLastWorkingProvider(): Promise<string | null> {
  try {
    // Use dynamic import to handle both CommonJS and ES modules
    let fs: any;
    let path: any;
    
    try {
      // Try ES module approach first
      fs = await import('fs');
      path = await import('path');
    } catch {
      // Fallback to CommonJS
      fs = require('fs');
      path = require('path');
    }
    
    const cachePath = path.join(process.cwd(), CACHE_FILE);
    
    if (fs.existsSync(cachePath)) {
      const cacheData = fs.readFileSync(cachePath, 'utf8');
      const cached: CachedProvider = JSON.parse(cacheData);
      
      // Check if cache is still valid (less than 1 hour old)
      if (Date.now() - cached.timestamp < 60 * 60 * 1000) {
        console.log(`📂 Using cached provider: ${cached.url}`);
        return cached.url;
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to read cached provider:', (error as Error).message);
  }
  
  return null;
}

/**
 * Creates a provider with automatic fallback to healthy providers
 */
export async function createProviderWithFallback(
  chainId: number,
  config: RpcProviderConfig = {}
): Promise<JsonRpcProvider> {
  // Try cached provider first
  const cachedProviderUrl = await getCachedLastWorkingProvider();
  if (cachedProviderUrl) {
    try {
      const provider = await createRobustProvider(cachedProviderUrl, chainId, config);
      if (provider) {
        console.log(`✅ Using cached provider: ${cachedProviderUrl}`);
        return provider;
      }
    } catch (error) {
      console.warn(`⚠️ Cached provider failed: ${cachedProviderUrl}`, (error as Error).message);
    }
  }
  
  const urls = getPrioritizedRpcUrls();
  console.log(`🔄 Testing ${urls.length} RPC providers...`);
  
  for (const url of urls) {
    // Skip cached provider if we already tried it
    if (cachedProviderUrl === url) continue;
    
    try {
      const provider = await createRobustProvider(url, chainId, config);
      if (provider) {
        console.log(`✅ Successfully created provider using: ${url}`);
        await cacheLastWorkingProvider(url); // Cache this working provider
        return provider;
      }
    } catch (error) {
      console.warn(`Provider failed for ${url}:`, (error as Error).message);
    }
  }
  
  // If all providers fail, throw an error
  const error = new Error("All RPC providers failed. Please check your network connection and RPC configuration.");
  console.error('💥 All RPC providers failed:', error.message);
  throw error;
}

/**
 * Executes a function with a provider, automatically retrying with fallback providers if needed
 */
export async function executeWithProviderFallback<T>(
  executor: (provider: JsonRpcProvider) => Promise<T>,
  chainId: number = 8453,
  config: RpcProviderConfig = {}
): Promise<T> {
  const urls = getPrioritizedRpcUrls();
  const errors: string[] = [];
  
  for (const url of urls) {
    try {
      const provider = await createRobustProvider(url, chainId, config);
      if (provider) {
        const result = await executor(provider);
        await cacheLastWorkingProvider(url); // Cache successful provider
        return result;
      }
    } catch (error) {
      const errorMessage = `Provider ${url} failed: ${(error as Error).message}`;
      console.warn(errorMessage);
      errors.push(errorMessage);
    }
  }
  
  throw new Error(`All RPC providers failed:\n${errors.join('\n')}`);
}