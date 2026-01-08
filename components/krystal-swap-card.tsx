"use client";

/**
 * Swap Card Component
 * Enables users to swap any token for BTC1 at the best rates using DEX aggregator
 */

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useWalletClient } from 'wagmi';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeftRight, Loader2, X, CheckCircle2, XCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { useWeb3 } from "@/lib/web3-provider";

// Dynamically import KrystalZap with SSR disabled
const KrystalZap = dynamic(() => import('@krystaldefi/zap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  ),
});

interface SwapConfig {
  chainId: number;
  platforms: string[];
  poolAddresses: { [platform: string]: string };
}

interface SwapCardProps {
  className?: string;
  onClose?: () => void;
}

export function KrystalSwapCard({ className, onClose }: SwapCardProps) {
  const { theme } = useTheme();
  const { address, chainId } = useWeb3();
  const [config, setConfig] = useState<SwapConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("uniswapv3");
  const [txLoading, setTxLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const { data: walletClient } = useWalletClient();

  // Fetch swap configuration
  useEffect(() => {
    async function fetchConfig() {
      try {
        setLoading(true);
        const response = await fetch('https://api.krystal.app/all/v1/lp_explorer/configs');
        
        if (!response.ok) {
          throw new Error('Failed to fetch swap config');
        }

        const data = await response.json();
        const baseChainData = data?.chains?.["8453"];
        
        if (!baseChainData) {
          console.warn('Base network not found in config');
        }

        // Using working test pool (WETH/USDC on Uniswap V3) - Replace with BTC1 pool once created
        const baseConfig: SwapConfig = {
          chainId: 8453,
          platforms: baseChainData?.platforms || ['uniswapv3', 'aerodromecl', 'balancer'],
          poolAddresses: {
            uniswapv3: "0xfbcf443d3e9ce293f7dd2300e8c6e0ad537fe1c9e59e221cde2d823aff129811", // WETH/USDC test pool
            aerodromecl: "0x4a23cdb430025f25092d30f721687638288a4e0a", // BTC1 pool (not indexed yet)
            balancer: "0x0000000000000000000000000000000000000000",
          }
        };
        
        setConfig(baseConfig);
        setError(null);
      } catch (err) {
        console.error('Error fetching swap config:', err);
        setError('Failed to load swap configuration. Using default settings.');
        
        setConfig({
          chainId: 8453,
          platforms: ['uniswapv3'],
          poolAddresses: {
            uniswapv3: "0xfbcf443d3e9ce293f7dd2300e8c6e0ad537fe1c9e59e221cde2d823aff129811",
          }
        });
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  // Orange color scheme matching your app
  const customColorScheme = {
    dark: {
      "--card": "217.78 23.08% 22.94%",
      "--card-foreground": "0 0% 98%",
      "--primary": "24 91% 60%", // Orange primary
      "--secondary": "220 15% 30%",
      "--ring": "24 91% 60%",
    },
    light: {
      "--card": "0 0% 100%",
      "--card-foreground": "240 10% 15%",
      "--primary": "24 91% 60%", // Orange primary
      "--secondary": "240 5% 95%",
      "--ring": "24 91% 60%",
    },
  };

  return (
    <Card className={className}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <ArrowLeftRight className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">Get BTC1</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-orange-500/50 bg-orange-500/10 text-orange-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              Live
            </Badge>
            {onClose && (
              <button
                onClick={onClose}
                className="ml-2 p-1 rounded-full hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        <CardDescription className="text-gray-400">
          Swap any token to get BTC1 at the best rates
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 text-red-400">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!address && (
          <Alert className="bg-orange-500/10 border-orange-500/50">
            <AlertDescription className="text-orange-400">
              Please connect your wallet to start swapping
            </AlertDescription>
          </Alert>
        )}

        {chainId && chainId !== 8453 && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 text-red-400">
            <AlertDescription>
              Please switch to Base network to use this feature
            </AlertDescription>
          </Alert>
        )}

        {config && config.poolAddresses[selectedPlatform] === "0x0000000000000000000000000000000000000000" && (
          <Alert className="bg-yellow-500/10 border-yellow-500/50">
            <AlertDescription className="text-yellow-400">
              ⚠️ BTC1 liquidity pool not yet created. Please create a liquidity pool on Uniswap V3, Aerodrome, or Balancer first.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : config && address && chainId === 8453 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden p-4">
              {/* Transaction Status Notification */}
              {txStatus.type && (
                <div className={`mb-4 p-4 rounded-lg border flex items-start gap-3 ${
                  txStatus.type === 'success' 
                    ? 'bg-green-500/10 border-green-500/50 text-green-400' 
                    : 'bg-red-500/10 border-red-500/50 text-red-400'
                }`}>
                  {txStatus.type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {txStatus.type === 'success' ? 'Success!' : 'Error'}
                    </p>
                    <p className="text-sm mt-1 break-all">{txStatus.message}</p>
                  </div>
                  <button
                    onClick={() => setTxStatus({ type: null, message: '' })}
                    className="text-current hover:opacity-70 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              
              <KrystalZap
                platform={selectedPlatform}
                chainId={config.chainId}
                poolAddress={config.poolAddresses[selectedPlatform]}
                userAddress={address}
                liquiditySlippage={0.02}
                swapSlippage={0.01}
                onTxDataReady={async (txObj) => {
                  console.log('Transaction ready:', txObj);
                  
                  // Execute transaction using wallet client
                  if (walletClient && txObj && txObj.to && txObj.data) {
                    try {
                      setTxLoading(true);
                      setTxStatus({ type: null, message: '' });
                      
                      const hash = await walletClient.sendTransaction({
                        to: txObj.to as `0x${string}`,
                        data: txObj.data as `0x${string}`,
                        value: txObj.value ? BigInt(txObj.value) : BigInt(0),
                        account: address as `0x${string}`,
                        chain: walletClient.chain,
                      });
                      
                      console.log('Transaction sent:', hash);
                      setTxStatus({ 
                        type: 'success', 
                        message: `Transaction confirmed! Hash: ${hash.slice(0, 10)}...${hash.slice(-8)}` 
                      });
                      setTxLoading(false);
                      
                      // Auto-hide success message after 5 seconds
                      setTimeout(() => {
                        setTxStatus({ type: null, message: '' });
                      }, 5000);
                    } catch (err: any) {
                      console.error('Transaction failed:', err);
                      
                      // Check if user rejected the transaction
                      const isRejection = err?.message?.toLowerCase().includes('rejected') || 
                                         err?.message?.toLowerCase().includes('denied') ||
                                         err?.message?.toLowerCase().includes('user rejected');
                      
                      if (isRejection) {
                        setTxStatus({ 
                          type: 'error', 
                          message: 'Transaction rejected by user' 
                        });
                      } else {
                        setTxStatus({ 
                          type: 'error', 
                          message: err?.message || 'Transaction failed' 
                        });
                      }
                      
                      setError(err?.message || 'Transaction failed');
                      setTxLoading(false);
                      
                      // Auto-hide error message after 5 seconds
                      setTimeout(() => {
                        setTxStatus({ type: null, message: '' });
                      }, 5000);
                    }
                  }
                }}
                onError={(error: any) => {
                  console.error('Swap error:', error);
                  setError(typeof error === 'string' ? error : error?.message || 'An error occurred');
                }}
                onLoading={(loading) => setTxLoading(loading)}
                theme={theme === "dark" ? "dark" : "light"}
                colorScheme={customColorScheme}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>Connect wallet and switch to Base network to start swapping</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default KrystalSwapCard;
