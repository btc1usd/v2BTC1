'use client';

/**
 * Liquidity Modal Component
 * Beautiful, mobile-responsive modal for adding liquidity
 * Integrates with Krystal Zap for liquidity provision
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useWalletClient } from 'wagmi';
import { useTheme } from 'next-themes';
import { useWeb3 } from '@/lib/web3-provider';

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

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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

  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-2xl my-8 animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-red-500 transition-all shadow-lg"
          aria-label="Close modal"
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hover:text-red-400" />
        </button>

        {/* Modal content */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-2xl p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Add Liquidity
            </h2>
            <p className="text-xs sm:text-sm text-gray-400">
              Provide liquidity to earn fees on Base DEXs
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-300 text-xs sm:text-sm">
              {error}
            </div>
          )}

          {/* Network Warning */}
          {chainId && chainId !== 8453 && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-300 text-xs sm:text-sm">
              Please switch to Base network to add liquidity
            </div>
          )}

          {/* Transaction Status */}
          {txStatus.type && (
            <div
              className={`mb-4 p-3 rounded-lg border flex items-start gap-2 sm:gap-3 text-xs sm:text-sm ${
                txStatus.type === 'success'
                  ? 'bg-green-500/10 border-green-500/50 text-green-400'
                  : 'bg-red-500/10 border-red-500/50 text-red-400'
              }`}
            >
              {txStatus.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {txStatus.type === 'success' ? 'Success!' : 'Error'}
                </p>
                <p className="mt-1 break-all">{txStatus.message}</p>
              </div>
              <button
                onClick={() => setTxStatus({ type: null, message: '' })}
                className="text-current hover:opacity-70 transition-opacity flex-shrink-0"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : config && address && chainId === 8453 ? (
            <div className="rounded-lg border border-gray-700 bg-gray-800 overflow-hidden">
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
                        message: `Transaction confirmed! Hash: ${hash.slice(0, 10)}...${hash.slice(-8)}`,
                      });
                      setTxLoading(false);

                      setTimeout(() => {
                        setTxStatus({ type: null, message: '' });
                      }, 5000);
                    } catch (err: any) {
                      const isRejection =
                        err?.message?.toLowerCase().includes('rejected') ||
                        err?.message?.toLowerCase().includes('denied') ||
                        err?.message?.toLowerCase().includes('user rejected');

                      setTxStatus({
                        type: 'error',
                        message: isRejection
                          ? 'Transaction rejected by user'
                          : err?.message || 'Transaction failed',
                      });
                      setTxLoading(false);

                      setTimeout(() => {
                        setTxStatus({ type: null, message: '' });
                      }, 5000);
                    }
                  }
                }}
                onError={(error: any) => {
                  console.error('Liquidity error:', error);
                  setError(typeof error === 'string' ? error : error?.message || 'An error occurred');
                }}
                onLoading={(loading) => setTxLoading(loading)}
                theme={theme === 'dark' ? 'dark' : 'light'}
                colorScheme={customColorScheme}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-xs sm:text-sm">
              <p>Connect wallet and switch to Base network to add liquidity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
