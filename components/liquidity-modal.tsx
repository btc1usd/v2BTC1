'use client';

/**
 * Liquidity Modal Component
 * Beautiful, mobile-responsive modal for adding liquidity
 * Integrates with Krystal Zap for liquidity provision
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X, CheckCircle2, XCircle, Loader2, Plus, Droplets } from 'lucide-react';
import { useWalletClient } from 'wagmi';
import { useTheme } from 'next-themes';
import { useWeb3 } from '@/lib/web3-provider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Dynamically import KrystalZap with SSR disabled
const KrystalZap = dynamic(() => import('@krystaldefi/zap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  ),
});

interface LiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SwapConfig {
  chainId: number;
  platforms: string[];
  poolAddresses: { [platform: string]: string };
}

export default function LiquidityModal({ isOpen, onClose }: LiquidityModalProps) {
  const { theme } = useTheme();
  const { address, chainId } = useWeb3();
  const { data: walletClient } = useWalletClient();

  const [config, setConfig] = useState<SwapConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('uniswapv4');
  const [txLoading, setTxLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Fetch liquidity configuration
  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://api.krystal.app/all/v1/lp_explorer/configs');

      if (!response.ok) {
        throw new Error('Failed to fetch config');
      }

      const data = await response.json();
      const baseChainData = data?.chains?.['8453'];

      const baseConfig: SwapConfig = {
        chainId: 8453,
        platforms: baseChainData?.platforms || ['uniswapv4', 'uniswapv3', 'aerodromecl'],
        poolAddresses: {
          uniswapv4: '0xfbcf443d3e9ce293f7dd2300e8c6e0ad537fe1c9e59e221cde2d823aff129811',
          uniswapv3: '0xd0b53D9277642d899DF5C87A3966A349A798F224',
          aerodromecl: '0x4a23cdb430025f25092d30f721687638288a4e0a',
        },
      };

      setConfig(baseConfig);
      setError(null);
    } catch (err) {
      console.error('Error fetching config:', err);
      setError('Failed to load configuration. Using defaults.');
      setConfig({
        chainId: 8453,
        platforms: ['uniswapv4'],
        poolAddresses: {
          uniswapv4: '0xfbcf443d3e9ce293f7dd2300e8c6e0ad537fe1c9e59e221cde2d823aff129811',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  // Orange color scheme
  const customColorScheme = {
    dark: {
      '--card': '217.78 23.08% 22.94%',
      '--card-foreground': '0 0% 98%',
      '--primary': '24 91% 60%',
      '--secondary': '220 15% 30%',
      '--ring': '24 91% 60%',
    },
    light: {
      '--card': '0 0% 100%',
      '--card-foreground': '240 10% 15%',
      '--primary': '24 91% 60%',
      '--secondary': '240 5% 95%',
      '--ring': '24 91% 60%',
    },
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal={false}>
      <DialogContent 
        className="w-[95vw] sm:max-w-xl p-0 bg-gray-950 border-gray-800 rounded-2xl sm:rounded-[32px] shadow-2xl z-50 max-h-[90vh] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 sm:p-8 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-4 text-white text-3xl font-bold">
            <div className="p-3 bg-green-600/20 rounded-2xl">
              <Droplets className="h-7 w-7 text-green-400" />
            </div>
            Add Liquidity
          </DialogTitle>
          <p className="text-gray-400 text-base mt-2">
            Provide liquidity to pools and earn trading fees on Base.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4 sm:p-8 pt-2 overflow-y-auto pointer-events-auto flex flex-col items-center">
          <div className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="bg-red-900/20 border-red-500/50 text-red-200">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Network Warning */}
            {chainId && chainId !== 8453 && (
              <Alert variant="destructive" className="bg-orange-900/20 border-orange-500/50 text-orange-200">
                <AlertDescription>Please switch to Base Mainnet to add liquidity</AlertDescription>
              </Alert>
            )}

            {/* Transaction Status */}
            {txStatus.type && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
                  txStatus.type === 'success'
                    ? 'bg-green-500/10 border-green-500/50 text-green-400'
                    : 'bg-red-500/10 border-red-500/50 text-red-400'
                }`}
              >
                {txStatus.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-bold">{txStatus.type === 'success' ? 'Transaction Confirmed' : 'Transaction Failed'}</p>
                  <p className="mt-1 text-sm opacity-90 break-all">{txStatus.message}</p>
                </div>
                <button
                  onClick={() => setTxStatus({ type: null, message: '' })}
                  className="text-current hover:opacity-50 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-gray-800 border-t-orange-500 animate-spin" />
                  <Droplets className="absolute inset-0 m-auto h-5 w-5 text-orange-500" />
                </div>
                <p className="text-gray-400 animate-pulse">Initializing liquidity engine...</p>
              </div>
            ) : config && address && chainId === 8453 ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-1 shadow-inner">
                <KrystalZap
                  platform={selectedPlatform}
                  chainId={config.chainId}
                  poolAddress={config.poolAddresses[selectedPlatform]}
                  userAddress={address}
                  liquiditySlippage={0.02}
                  swapSlippage={0.01}
                  onTxDataReady={async (txObj) => {
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

                        setTxStatus({
                          type: 'success',
                          message: `Successfully added liquidity! Hash: ${hash.slice(0, 10)}...${hash.slice(-8)}`,
                        });
                        setTxLoading(false);

                        setTimeout(() => {
                          setTxStatus({ type: null, message: '' });
                        }, 8000);
                      } catch (err: any) {
                        const isRejection =
                          err?.message?.toLowerCase().includes('rejected') ||
                          err?.message?.toLowerCase().includes('denied') ||
                          err?.message?.toLowerCase().includes('user rejected');

                        setTxStatus({
                          type: 'error',
                          message: isRejection
                            ? 'Transaction rejected in wallet'
                            : err?.message || 'Failed to execute transaction',
                        });
                        setTxLoading(false);
                      }
                    }
                  }}
                  onError={(error: any) => {
                    console.error('Liquidity error:', error);
                    setError(typeof error === 'string' ? error : error?.message || 'An error occurred during Zap setup');
                  }}
                  onLoading={(loading) => setTxLoading(loading)}
                  theme={theme === 'dark' ? 'dark' : 'light'}
                  colorScheme={customColorScheme}
                />
              </div>
            ) : (
              <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800">
                <Plus className="h-10 w-10 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">Connect wallet to Base Mainnet to continue</p>
                <p className="text-gray-600 text-xs mt-2">Make sure you are on the correct network (Base 8453)</p>
              </div>
            )}
            
            <p className="text-[10px] text-center text-gray-600">
              Powered by Krystal Zap. Liquidity is provided directly to underlying DEX protocols.
            </p>
          </div>
        </ScrollArea>

        <div className="p-4 sm:p-6 bg-gray-900/50 border-t border-gray-800 flex justify-center flex-shrink-0">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-sm font-medium transition-colors"
          >
            Cancel and Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
