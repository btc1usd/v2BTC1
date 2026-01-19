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
import { ChevronDown, ChevronUp, ArrowDownUp, Search, Check, Wallet, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
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
  logo?: string;
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
    logo: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
  },
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logo: 'https://tokens.1inch.io/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png'
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    logo: 'https://tokens.1inch.io/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png'
  },
  {
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    decimals: 8,
    logo: 'https://tokens.1inch.io/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599.png'
  },
  {
    address: BTC1_TOKEN,
    symbol: 'BTC1',
    name: 'BTC1 Token',
    decimals: 18,
    logo: '/favicon.png'
  },
];

interface TokenSelectorProps {
  selectedToken: Token;
  onSelect: (token: Token) => void;
  tokens: Token[];
  balances: { [address: string]: string };
  label: string;
  disabled?: boolean;
}

function TokenSelector({ selectedToken, onSelect, tokens, balances, label, disabled }: TokenSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[140px] sm:w-[160px] justify-between bg-gray-800 border-gray-700 hover:bg-gray-700 text-white"
          disabled={disabled}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {selectedToken.logo ? (
              <img src={selectedToken.logo} alt={selectedToken.symbol} className="w-5 h-5 rounded-full" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold">
                {selectedToken.symbol.slice(0, 2)}
              </div>
            )}
            <span className="truncate">{selectedToken.symbol}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 bg-gray-900 border-gray-700" align="start">
        <Command className="bg-gray-900 text-white">
          <CommandInput placeholder={`Search ${label}...`} className="text-white" />
          <CommandList>
            <CommandEmpty>No token found.</CommandEmpty>
            <CommandGroup heading="Available Tokens" className="text-gray-400">
              <ScrollArea className="h-[300px]">
                {tokens.map((token) => {
                  const balance = balances[token.address];
                  const hasBalance = balance && parseFloat(balance) > 0;
                  
                  return (
                    <CommandItem
                      key={token.address}
                      value={token.symbol}
                      onSelect={() => {
                        onSelect(token);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {token.logo ? (
                          <img src={token.logo} alt={token.symbol} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                            {token.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{token.symbol}</span>
                          <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{token.name}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        {hasBalance ? (
                          <>
                            <span className="text-sm font-medium text-blue-400">
                              {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            </span>
                            <Badge variant="outline" className="text-[9px] h-4 border-blue-500/50 text-blue-300">
                              In Wallet
                            </Badge>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500">0.00</span>
                        )}
                      </div>
                      
                      {selectedToken.address === token.address && (
                        <Check className="ml-2 h-4 w-4 text-blue-500" />
                      )}
                    </CommandItem>
                  );
                })}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
  const [balances, setBalances] = useState<{ [address: string]: string }>({});
  const [slippage, setSlippage] = useState<number>(1); // 1% default

  const [state, setState] = useState<SwapState>({
    loading: false,
    quoteLoading: false,
    error: null,
    success: false,
    txHash: null,
    quote: null,
  });

  // Fetch user balances for all tokens
  useEffect(() => {
    if (walletClient?.account?.address && publicClient) {
      const fetchAllBalances = async () => {
        const newBalances: { [address: string]: string } = {};

        try {
          // Fetch ETH balance
          const ethBalance = await publicClient.getBalance({
            address: walletClient.account.address,
          });
          newBalances[NATIVE_ETH] = ethers.formatEther(ethBalance);

          // Fetch ERC20 token balances
          for (const token of BASE_TOKENS) {
            if (token.address !== NATIVE_ETH) {
              try {
                const balance = await publicClient.readContract({
                  address: token.address as Address,
                  abi: [
                    {
                      name: 'balanceOf',
                      type: 'function',
                      stateMutability: 'view',
                      inputs: [{ type: 'address' }],
                      outputs: [{ type: 'uint256' }],
                    },
                  ],
                  functionName: 'balanceOf',
                  args: [walletClient.account.address],
                });
                newBalances[token.address] = ethers.formatUnits(balance as bigint, token.decimals);
              } catch (err) {
                console.error(`Error fetching balance for ${token.symbol}:`, err);
                newBalances[token.address] = '0';
              }
            }
          }

          setBalances(newBalances);
        } catch (err) {
          console.error('Error fetching balances:', err);
        }
      };

      fetchAllBalances();
    }
  }, [walletClient, publicClient]);

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
    const balance = balances[tokenIn.address];
    if (balance && parseFloat(balance) > 0) {
      if (tokenIn.address === NATIVE_ETH) {
        // Leave small amount for gas
        const maxAmount = parseFloat(balance) - 0.001;
        if (maxAmount > 0) {
          setAmountIn(maxAmount.toFixed(6));
        }
      } else {
        // For ERC20, use full balance
        setAmountIn(parseFloat(balance).toFixed(6));
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
    <div className="w-full mx-auto bg-transparent">
      {/* Collapsible Content */}
      <div className="p-4 sm:p-6">
        {/* Info Banner */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-xl flex items-start gap-3 shadow-inner">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Wallet className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">1inch Aggregator</p>
            <p className="text-xs text-blue-200/70 mt-0.5 leading-relaxed">
              Scanning all Base DEXs to find you the best swap rates automatically.
            </p>
          </div>
        </div>

        {/* Error Message */}
        {state.error && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-xl text-red-200 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="flex-1">{state.error}</span>
          </div>
        )}

        {/* Success Message */}
        {state.success && state.txHash && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-500/50 rounded-xl text-green-200 text-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-2">
              <Check className="h-5 w-5 text-green-400" />
              <span className="font-bold text-green-400">Swap Successful!</span>
            </div>
            <a
              href={`https://basescan.org/tx/${state.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-300 hover:text-white transition-colors underline underline-offset-4 decoration-green-500/50"
            >
              View transaction on BaseScan
              <ChevronDown className="h-3 w-3 -rotate-90" />
            </a>
          </div>
        )}

        <div className="space-y-6">
          {/* Token In */}
          <div className="p-4 bg-gray-800/40 border border-gray-700/50 rounded-2xl transition-all hover:border-blue-500/30">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">From</span>
              {balances[tokenIn.address] && (
                <button
                  onClick={handleMaxClick}
                  className="group flex items-center gap-2 text-xs text-gray-400 hover:text-blue-400 transition-colors"
                >
                  <Wallet className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                  <span>Balance: {parseFloat(balances[tokenIn.address]).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                  <Badge variant="secondary" className="h-5 px-1 bg-blue-500/10 text-blue-400 border-none hover:bg-blue-500/20 cursor-pointer">MAX</Badge>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <TokenSelector
                selectedToken={tokenIn}
                onSelect={(token) => {
                  setTokenIn(token);
                  setCustomTokenAddress('');
                }}
                tokens={BASE_TOKENS.filter(t => t.address !== tokenOut.address)}
                balances={balances}
                label="token"
              />
              <input
                type="number"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-white text-2xl font-bold border-none focus:outline-none text-right placeholder:text-gray-700"
              />
            </div>
            
            {/* Custom Token Option */}
            <div className="mt-4 pt-4 border-t border-gray-700/30">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-3 w-3 text-gray-500" />
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-tighter">Import Custom Asset</span>
              </div>
              <input
                type="text"
                value={customTokenAddress}
                onChange={(e) => handleCustomToken(e.target.value)}
                placeholder="Paste contract address (0x...)"
                className="w-full px-3 py-2 bg-gray-900/50 text-white text-xs rounded-lg border border-gray-700/50 focus:border-blue-500/50 focus:bg-gray-900 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Swap Direction Arrow */}
          <div className="flex justify-center -my-8 relative z-10">
            <button
              onClick={handleSwapTokens}
              className="p-3 rounded-xl bg-gray-800 border-4 border-gray-900 text-blue-400 hover:text-white hover:bg-blue-600 hover:border-blue-700 transition-all shadow-xl active:scale-90 group"
              title="Reverse tokens"
            >
              <ArrowDownUp className="h-5 w-5 transition-transform group-hover:rotate-180 duration-500" />
            </button>
          </div>

          {/* Token Out */}
          <div className="p-4 bg-gray-800/40 border border-gray-700/50 rounded-2xl transition-all hover:border-blue-500/30">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">To (estimated)</span>
              {balances[tokenOut.address] && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Wallet className="h-3 w-3 opacity-30" />
                  <span>Balance: {parseFloat(balances[tokenOut.address]).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <TokenSelector
                selectedToken={tokenOut}
                onSelect={setTokenOut}
                tokens={BASE_TOKENS.filter(t => t.address !== tokenIn.address)}
                balances={balances}
                label="token"
              />
              <div className="flex-1 text-right overflow-hidden">
                {state.quoteLoading ? (
                  <div className="flex justify-end gap-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-2 h-8 bg-gray-700 animate-pulse rounded" style={{ animationDelay: `${i * 100}ms` }} />
                    ))}
                  </div>
                ) : (
                  <span className={cn(
                    "text-2xl font-bold transition-colors",
                    state.quote ? "text-white" : "text-gray-700"
                  )}>
                    {state.quote ? parseFloat(state.quote.toAmount).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0.00'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Swap Details */}
          {(state.quote || state.quoteLoading) && (
            <div className="p-4 bg-gray-900/50 border border-gray-700/50 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Exchange Rate</span>
                <span className="text-white font-medium">
                  {state.quote ? `1 ${tokenIn.symbol} = ${(parseFloat(state.quote.toAmount) / (parseFloat(amountIn) || 1)).toFixed(6)} ${tokenOut.symbol}` : '---'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Price Impact</span>
                <span className="text-green-400 font-medium">{'< 0.01%'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Network Fee</span>
                <div className="flex items-center gap-1.5 text-white font-medium">
                  <Badge variant="outline" className="h-4 px-1 text-[10px] border-gray-700 text-gray-400">~{state.quote?.estimatedGas || '0'} gas</Badge>
                  <span>Base Network</span>
                </div>
              </div>
              
              <div className="pt-2 border-t border-gray-700/30">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Slippage Tolerance</label>
                  <span className="text-xs font-bold text-blue-400">{slippage}%</span>
                </div>
                <div className="flex gap-2">
                  {[0.5, 1, 3].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSlippage(val)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all border",
                        slippage === val 
                          ? "bg-blue-500 border-blue-600 text-white shadow-lg shadow-blue-500/20" 
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                      )}
                    >
                      {val}%
                    </button>
                  ))}
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      value={slippage}
                      onChange={(e) => setSlippage(parseFloat(e.target.value) || 1)}
                      className="w-full py-2 px-2 bg-gray-800 text-white text-xs font-bold rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-all pr-5"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleSwap}
            disabled={state.loading || state.quoteLoading || !walletClient || !amountIn || !state.quote}
            className={cn(
              "w-full h-16 rounded-2xl text-lg font-bold shadow-2xl transition-all active:scale-[0.97]",
              !state.quote || state.loading || state.quoteLoading
                ? "bg-gray-800 text-gray-500 cursor-not-allowed grayscale"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20"
            )}
          >
            {state.loading || state.quoteLoading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{state.quoteLoading ? 'Finding best price...' : 'Executing Swap...'}</span>
              </div>
            ) : !walletClient ? (
              'Connect Wallet'
            ) : !amountIn ? (
              'Enter Amount'
            ) : (
              `Swap ${tokenIn.symbol} to ${tokenOut.symbol}`
            )}
          </Button>
          
          <p className="text-[10px] text-center text-gray-500 font-medium">
            Non-custodial swap. You maintain full control of your private keys.
          </p>
        </div>
      </div>
    </div>
  );
}
