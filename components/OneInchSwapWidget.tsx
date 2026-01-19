'use client';

/**
 * 1inch Swap Widget for Base Mainnet
 * 
 * Complete non-custodial swap implementation using 1inch Aggregation API
 * All transactions are signed and sent by the user's wallet
 * Supports any token to any token swaps
 */

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWalletClient, usePublicClient } from 'wagmi';
import { Address } from 'viem';
import { ChevronDown, ChevronUp, ArrowDownUp } from 'lucide-react';
import {
  executeOneInchSwap,
  getOneInchQuote,
  formatToWei,
  formatFromWei,
  getTokenDecimals,
  BASE_CHAIN_ID,
} from '@/lib/oneinch-aggregator';

// Native ETH address for 1inch
const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// BTC1 token on Base Mainnet
const BTC1_TOKEN = '0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface SwapState {
  loading: boolean;
  quoteLoading: boolean;
  error: string | null;
  success: boolean;
  txHash: string | null;
  quote: {
    toAmount: string;
    estimatedGas: string;
  } | null;
}

// Common tokens on Base Mainnet
const BASE_TOKENS: Token[] = [
  {
    address: NATIVE_ETH,
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
  },
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
  },
  {
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    decimals: 8,
  },
  {
    address: BTC1_TOKEN,
    symbol: 'BTC1',
    name: 'BTC1 Token',
    decimals: 18,
  },
];

export default function OneInchSwapWidget() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // Collapsible state
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Token In (any token)
  const [tokenIn, setTokenIn] = useState<Token>(BASE_TOKENS[0]);
  
  // Token Out (any token, default to BTC1)
  const [tokenOut, setTokenOut] = useState<Token>(BASE_TOKENS[4]); // BTC1

  const [amountIn, setAmountIn] = useState<string>('');
  const [customTokenAddress, setCustomTokenAddress] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [slippage, setSlippage] = useState<number>(1); // 1% default

  const [state, setState] = useState<SwapState>({
    loading: false,
    quoteLoading: false,
    error: null,
    success: false,
    txHash: null,
    quote: null,
  });

  // Fetch user balance
  useEffect(() => {
    if (walletClient?.account?.address && publicClient) {
      const fetchBalance = async () => {
        try {
          if (tokenIn.address === NATIVE_ETH) {
            const ethBalance = await publicClient.getBalance({
              address: walletClient.account.address,
            });
            setBalance(ethers.formatEther(ethBalance));
          } else {
            // For ERC20 tokens, implement balance fetching if needed
            setBalance('0');
          }
        } catch (err) {
          console.error('Error fetching balance:', err);
          setBalance('0');
        }
      };

      fetchBalance();
    }
  }, [walletClient, publicClient, tokenIn]);

  // Fetch quote when amount changes
  useEffect(() => {
    if (amountIn && parseFloat(amountIn) > 0 && walletClient && tokenIn.address !== tokenOut.address) {
      fetchQuote();
    } else {
      setState(prev => ({ ...prev, quote: null }));
    }
  }, [amountIn, tokenIn, tokenOut, slippage, walletClient]);

  const fetchQuote = async () => {
    if (!walletClient || !amountIn || parseFloat(amountIn) <= 0) return;

    // Prevent same token swap
    if (tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase()) {
      setState(prev => ({ 
        ...prev, 
        error: 'Cannot swap the same token',
        quote: null 
      }));
      return;
    }

    setState(prev => ({ ...prev, quoteLoading: true, error: null }));

    try {
      // Validate minimum amount
      const minAmount = tokenIn.address === NATIVE_ETH ? 0.001 : 0;
      if (parseFloat(amountIn) < minAmount) {
        throw new Error(`Minimum swap amount is ${minAmount} ${tokenIn.symbol}`);
      }

      // Convert amount to wei
      const amountInWei = formatToWei(amountIn, tokenIn.decimals);

      // Get quote from 1inch
      const quote = await getOneInchQuote({
        src: tokenIn.address,
        dst: tokenOut.address,
        amount: amountInWei,
        from: walletClient.account.address,
        slippage,
      });

      // Format output amount
      const toAmountFormatted = formatFromWei(quote.toAmount, tokenOut.decimals);

      setState(prev => ({
        ...prev,
        quoteLoading: false,
        quote: {
          toAmount: toAmountFormatted,
          estimatedGas: quote.estimatedGas,
        },
      }));
    } catch (err: any) {
      console.error('Quote fetch failed:', err);
      setState(prev => ({
        ...prev,
        quoteLoading: false,
        error: err.message || 'Failed to fetch quote. This pair may not have sufficient liquidity.',
      }));
    }
  };
  
  const handleSwapTokens = () => {
    // Swap input and output tokens
    const temp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(temp);
    setAmountIn(''); // Clear amount
  };
  
  const handleSwap = async () => {
    if (!walletClient || !walletClient.account) {
      setState(prev => ({ ...prev, error: 'Please connect your wallet first' }));
      return;
    }

    if (!amountIn || parseFloat(amountIn) <= 0) {
      setState(prev => ({ ...prev, error: 'Please enter a valid amount' }));
      return;
    }

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      success: false,
      txHash: null,
    }));

    try {
      // Get ethers.js signer from wallet
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Convert amount to wei
        const amountInWei = formatToWei(amountIn, tokenIn.decimals);

        // Execute swap through 1inch
        const txHash = await executeOneInchSwap(
          signer,
          tokenIn.address,
          tokenOut.address,
          amountInWei,
          slippage
        );

        setState(prev => ({
          ...prev,
          loading: false,
          success: true,
          txHash,
        }));

        // Reset form
        setAmountIn('');

        // Reset success state after 5 seconds
        setTimeout(() => {
          setState(prev => ({ ...prev, success: false }));
        }, 5000);
      } else {
        throw new Error('Wallet not available');
      }
    } catch (err: any) {
      console.error('Swap failed:', err);

      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Swap failed',
        success: false,
      }));
    }
  };

  const handleMaxClick = () => {
    if (tokenIn.address === NATIVE_ETH && balance) {
      // Leave small amount for gas
      const maxAmount = parseFloat(balance) - 0.001;
      if (maxAmount > 0) {
        setAmountIn(maxAmount.toFixed(6));
      }
    }
  };

  const handleCustomToken = async (address: string) => {
    setCustomTokenAddress(address);

    if (/^0x[a-fA-F0-9]{40}$/.test(address) && publicClient) {
      try {
        const tokenContract = {
          address: address as Address,
          abi: [
            {
              name: 'symbol',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'string' }],
            },
            {
              name: 'decimals',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint8' }],
            },
            {
              name: 'name',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'string' }],
            },
          ],
        } as const;

        const [symbol, decimals, name] = await Promise.all([
          publicClient.readContract({ ...tokenContract, functionName: 'symbol' }),
          publicClient.readContract({ ...tokenContract, functionName: 'decimals' }),
          publicClient.readContract({ ...tokenContract, functionName: 'name' }),
        ]);

        setTokenIn({
          address: address,
          symbol: symbol as string,
          decimals: Number(decimals),
          name: name as string,
        });
      } catch (err) {
        console.error('Failed to fetch token info:', err);
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-gray-900 rounded-xl border border-gray-700">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-gray-800/50 transition-colors rounded-t-xl"
      >
        <div className="text-left">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
            Token Swap (1inch)
          </h2>
          <p className="text-xs sm:text-sm text-gray-400">
            {isExpanded ? 'Click to collapse' : 'Click to expand swap interface'}
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
        )}
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4 sm:p-6 border-t border-gray-700">
          {/* Info Banner */}
          <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-blue-900/20 border border-blue-500/50 rounded-lg text-blue-300 text-xs">
            <strong>1inch Aggregation:</strong> Best prices across all Base DEXs
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>Swap any token to any token</li>
              <li>Automated routing through multiple liquidity sources</li>
              <li className="hidden sm:list-item">Gas-optimized transactions</li>
            </ul>
          </div>

      {/* Error Message */}
      {state.error && (
        <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-300 text-xs sm:text-sm break-words">
          {state.error}
        </div>
      )}

      {/* Success Message */}
      {state.success && state.txHash && (
        <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-green-900/30 border border-green-500 rounded-lg text-green-300 text-xs sm:text-sm">
          Swap successful!
          <a
            href={`https://basescan.org/tx/${state.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block underline mt-1 break-all"
          >
            View on BaseScan
          </a>
        </div>
      )}

      <div className="space-y-3 sm:space-y-4">
        {/* Token In */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs sm:text-sm text-gray-400">From</label>
            {balance && tokenIn.address === NATIVE_ETH && (
              <button
                onClick={handleMaxClick}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Balance: {parseFloat(balance).toFixed(6)}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-2 sm:p-3 mb-2">
            <select
              value={tokenIn.address}
              onChange={(e) => {
                const selected = BASE_TOKENS.find(t => t.address === e.target.value);
                if (selected) {
                  setTokenIn(selected);
                  setCustomTokenAddress('');
                }
              }}
              className="bg-transparent text-white text-sm border-none focus:outline-none min-w-[70px]"
            >
              {BASE_TOKENS.filter(t => t.address !== tokenOut.address).map(token => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent text-white text-sm sm:text-base border-none focus:outline-none text-right"
            />
          </div>

          {/* Custom Token Input */}
          <div className="text-xs text-gray-400 mb-1">Or enter custom token address:</div>
          <input
            type="text"
            value={customTokenAddress}
            onChange={(e) => handleCustomToken(e.target.value)}
            placeholder="0x..."
            className="w-full p-2 bg-gray-800 text-white text-xs sm:text-sm rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Quote Display */}
        {state.quoteLoading && (
          <div className="text-center py-2 text-gray-400">
            <span className="flex items-center justify-center text-xs sm:text-sm">
              <svg
                className="animate-spin -ml-1 mr-2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Getting best price...
            </span>
          </div>
        )}

        {state.quote && !state.quoteLoading && (
          <div className="p-2 sm:p-3 bg-gray-800 rounded-lg text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">You receive:</span>
              <span className="text-white font-medium break-all text-right">
                {parseFloat(state.quote.toAmount).toFixed(6)} {tokenOut.symbol}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-gray-400 text-xs">Est. Gas:</span>
              <span className="text-gray-400 text-xs">{state.quote.estimatedGas}</span>
            </div>
            <div className="mt-1 text-xs text-gray-400">Powered by 1inch v5.2</div>
          </div>
        )}

        {/* Swap Direction Arrow */}
        <div className="flex justify-center">
          <button
            onClick={handleSwapTokens}
            className="p-1.5 sm:p-2 rounded-full bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-blue-500 transition-all active:scale-95"
            title="Swap token positions"
          >
            <ArrowDownUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
          </button>
        </div>

        {/* Token Out (Any Token) */}
        <div>
          <label className="block text-xs sm:text-sm text-gray-400 mb-1">To</label>
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-2 sm:p-3">
            <select
              value={tokenOut.address}
              onChange={(e) => {
                const selected = BASE_TOKENS.find(t => t.address === e.target.value);
                if (selected) {
                  setTokenOut(selected);
                }
              }}
              className="bg-transparent text-white text-sm border-none focus:outline-none min-w-[70px]"
            >
              {BASE_TOKENS.filter(t => t.address !== tokenIn.address).map(token => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={state.quote ? state.quote.toAmount : '0.0'}
              readOnly
              placeholder="0.0"
              className="flex-1 bg-transparent text-gray-400 text-sm sm:text-base border-none focus:outline-none text-right"
            />
          </div>
        </div>

        {/* Slippage Settings */}
        <div>
          <label className="block text-xs sm:text-sm text-gray-400 mb-1">Slippage Tolerance</label>
          <div className="flex gap-1.5 sm:gap-2">
            {[0.5, 1, 2].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={`flex-1 py-1.5 sm:py-2 rounded-lg border text-xs sm:text-sm ${
                  slippage === value
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >
                {value}%
              </button>
            ))}
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value) || 1)}
              className="w-16 sm:w-20 p-1.5 sm:p-2 bg-gray-800 text-white text-xs sm:text-sm rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              step="0.1"
              min="0.1"
              max="5"
            />
          </div>
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={
            state.loading ||
            state.quoteLoading ||
            !walletClient ||
            !amountIn ||
            !state.quote
          }
          className={`w-full py-3 sm:py-4 px-4 rounded-lg font-medium text-base sm:text-lg ${
            state.loading || state.quoteLoading
              ? 'bg-gray-600 cursor-not-allowed'
              : !walletClient
              ? 'bg-gray-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-[0.98]'
          } text-white transition-all`}
        >
          {state.loading || state.quoteLoading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {state.quoteLoading ? 'Getting quote...' : 'Swapping...'}
            </span>
          ) : (
            'Swap via 1inch'
          )}
        </button>
      </div>
      </div>
      )}
    </div>
  );
}
