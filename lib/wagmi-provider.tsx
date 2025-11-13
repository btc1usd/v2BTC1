"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http, fallback } from "wagmi";
import { baseSepolia, base, mainnet, polygon, arbitrum, optimism, bsc, avalanche } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";
import React, { ReactNode, useState, useEffect } from "react";
import type { Config } from "wagmi";

// WalletConnect Project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

// ============================================
// NETWORK CONFIGURATION
// ============================================
// Current: Base Sepolia (Testnet)
const TARGET_CHAIN = baseSepolia;
const ALCHEMY_ENDPOINT = 'base-sepolia';

// For Mainnet deployment, uncomment these lines:
// const TARGET_CHAIN = base;
// const ALCHEMY_ENDPOINT = 'base-mainnet';
// ============================================

// Create a react-query client once
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// Create a single config instance with all connectors
const createWagmiConfig = () => {
  // Only add WalletConnect if we have a valid project ID
  const hasWalletConnect = !!projectId && typeof window !== "undefined";

  const connectors = [
    injected({
      shimDisconnect: true,
    }),
    coinbaseWallet({
      appName: "BTC1USD Protocol",
      appLogoUrl: "https://btc1usd.com/icon.png",
    }),
  ];

  // Dynamically add WalletConnect if available
  if (hasWalletConnect) {
    try {
      const { walletConnect } = require("wagmi/connectors");
      connectors.push(
        walletConnect({
          projectId,
          showQrModal: true,
          metadata: {
            name: "BTC1USD Protocol",
            description: "Shariah-compliant Bitcoin-backed coin",
            url:
              typeof window !== "undefined"
                ? window.location.origin
                : "https://btc1usd.com",
            icons: [
              typeof window !== "undefined"
                ? `${window.location.origin}/icon.png`
                : "https://btc1usd.com/icon.png",
            ],
          },
          qrModalOptions: {
            themeMode: "dark",
          },
          disableProviderPing: true,
        })
      );
    } catch (error) {
      console.warn("WalletConnect initialization failed:", error);
    }
  }

  // Get RPC URLs from environment with Alchemy as primary
  const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;
  const rpcUrls = process.env.NEXT_PUBLIC_RPC_URL?.split(',').map(url => url.trim()).filter(Boolean) || [];

  // Build transport chain with Alchemy first (if available), then fallbacks
  const transportUrls: string[] = [];

  if (alchemyApiKey) {
    transportUrls.push(`https://${ALCHEMY_ENDPOINT}.g.alchemy.com/v2/${alchemyApiKey}`);
  }

  // Add configured fallback URLs
  transportUrls.push(...rpcUrls);

  // Add additional public fallbacks as last resort
  const publicFallbacks = TARGET_CHAIN.id === 84532
    ? [
        'https://base-sepolia.blockpi.network/v1/rpc/public',
        'https://base-sepolia.publicnode.com',
      ]
    : [
        'https://mainnet.base.org',
        'https://base.publicnode.com',
      ];

  publicFallbacks.forEach(url => {
    if (!transportUrls.includes(url)) {
      transportUrls.push(url);
    }
  });

  // Create http transports for each URL
  const transports = transportUrls.map(url =>
    http(url, {
      retryCount: 2,
      retryDelay: 500,
      timeout: 10000,
    })
  );

  // Use fallback transport to automatically switch between RPC providers
  const transport = transports.length > 1 ? fallback(transports) : transports[0];

  console.log(`🌐 Wagmi configured for ${TARGET_CHAIN.name} (Chain ID: ${TARGET_CHAIN.id})`);
  console.log(`   RPC Endpoints: ${transportUrls.length}`);
  console.log(`   Primary: ${transportUrls[0]}`);
  if (transportUrls.length > 1) {
    console.log(`   Fallbacks: ${transportUrls.slice(1).join(', ')}`);
  }

  return createConfig({
    // Include multiple chains so wagmi can detect when user is on wrong network
    chains: [TARGET_CHAIN, base, mainnet, polygon, arbitrum, optimism, bsc, avalanche],
    transports: {
      [TARGET_CHAIN.id]: transport,
      // Add minimal transports for other chains (just for detection)
      [base.id]: http(),
      [mainnet.id]: http(),
      [polygon.id]: http(),
      [arbitrum.id]: http(),
      [optimism.id]: http(),
      [bsc.id]: http(),
      [avalanche.id]: http(),
    },
    connectors,
    ssr: true,
    // Enable automatic reconnection
    multiInjectedProviderDiscovery: true,
    batch: {
      multicall: {
        wait: 100,
      },
    },
  });
};

// Create config once
let wagmiConfig: Config | null = null;

function getWagmiConfig() {
  if (!wagmiConfig) {
    wagmiConfig = createWagmiConfig();
  }
  return wagmiConfig;
}

export function WagmiProviderComponent({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    setMounted(true);
    setConfig(getWagmiConfig());
  }, []);

  // Show a state-of-the-art, lightweight loading state
  if (!mounted || !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-background/80 flex items-center justify-center">
        <div className="text-center">
          {/* Modern 3D spinner */}
          <div className="relative w-16 h-16 mx-auto mb-8">
            <div 
              className="absolute inset-0 rounded-full border-[3px] border-primary/20"
              style={{
                background: 'conic-gradient(from 0deg, transparent, var(--primary))',
                animation: 'spin 1s linear infinite',
                maskImage: 'linear-gradient(transparent 50%, black 50%)',
                WebkitMaskImage: 'linear-gradient(transparent 50%, black 50%)'
              }}
            />
            <div className="absolute inset-2 rounded-full bg-background" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
          </div>
          
          {/* Minimal text */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground/90">Loading Protocol</p>
            <div className="flex gap-1 justify-center">
              <span className="w-1 h-1 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0s' }} />
              <span className="w-1 h-1 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-1 h-1 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}