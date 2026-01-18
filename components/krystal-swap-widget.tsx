"use client";

/**
 * Universal Swap Widget
 * In-app token swap to BTC1 using direct Uniswap V3 quoter and router
 * Compatible with ethers v6 on Base network
 */

import { useState, useEffect } from "react";
import { useWalletClient, useBalance, useAccount } from 'wagmi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowDownUp, AlertCircle, CheckCircle2, Wallet } from "lucide-react";
import { useWeb3 } from "@/lib/web3-provider";
import { formatUnits, parseUnits, encodeFunctionData } from "viem";

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  isNative?: boolean;
}

// Base Chain ID
const BASE_CHAIN_ID = 8453;
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base

// 0x Protocol API endpoint for Base network
const ZEROX_API_URL = "https://base.api.0x.org";

// Popular tokens on Base network
const BASE_TOKENS: TokenInfo[] = [
  {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    symbol: "ETH",
    decimals: 18,
    name: "Ethereum",
    isNative: true,
  },
  {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
    name: "USD Coin",
  },
  {
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    decimals: 18,
    name: "Wrapped Ether",
  },
  {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    symbol: "DAI",
    decimals: 18,
    name: "Dai Stablecoin",
  },
  {
    address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    symbol: "USDbC",
    decimals: 6,
    name: "USD Base Coin",
  },
  {
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    symbol: "cbBTC",
    decimals: 8,
    name: "Coinbase Wrapped BTC",
  },
];

const BTC1_TOKEN: TokenInfo = {
  address: "0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5",
  symbol: "BTC1",
  decimals: 18,
  name: "BTC1 Token",
};

export function KrystalSwapWidget() {
  const { address } = useWeb3();
  const { data: walletClient } = useWalletClient();
  
  const [fromToken, setFromToken] = useState<TokenInfo>(BASE_TOKENS[1]); // Default USDC
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string>("");
  const [routeData, setRouteData] = useState<any>(null);

  // Get token balance
  const { data: balance } = useBalance({
    address: address as `0x${string}`,
    token: fromToken.isNative ? undefined : fromToken.address as `0x${string}`,
  });

  // Handle token selection
  const handleTokenChange = (tokenAddress: string) => {
    const selected = BASE_TOKENS.find(t => t.address === tokenAddress);
    if (selected) {
      setFromToken(selected);
      setFromAmount("");
      setToAmount("");
      setRouteData(null);
      setError(null);
    }
  };

  // Set max amount
  const handleMaxClick = () => {
    if (balance) {
      const maxAmount = parseFloat(balance.formatted);
      const amount = fromToken.isNative 
        ? Math.max(0, maxAmount - 0.001).toFixed(6)
        : maxAmount.toFixed(6);
      setFromAmount(amount);
    }
  };

  // Fetch quote from 0x Protocol API (aggregates ALL DEXes on Base)
  useEffect(() => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || !address) {
      setToAmount("");
      setRouteData(null);
      return;
    }

    const fetchQuote = async () => {
      try {
        setLoading(true);
        setError(null);

        const amountIn = parseUnits(fromAmount, fromToken.decimals);
        
        // Use WETH for native ETH, otherwise use actual token address
        const sellToken = fromToken.isNative ? WETH_ADDRESS : fromToken.address;
        const buyToken = BTC1_TOKEN.address;
        
        // Build 0x API request
        const params = new URLSearchParams({
          sellToken,
          buyToken,
          sellAmount: amountIn.toString(),
          takerAddress: address,
          slippagePercentage: '0.01', // 1% slippage
        });

        // Call 0x /swap/v1/price endpoint to get quote
        const response = await fetch(`${ZEROX_API_URL}/swap/v1/price?${params}`, {
          headers: {
            '0x-api-key': process.env.NEXT_PUBLIC_0X_API_KEY || '',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.reason || `0x API error: ${response.status}`);
        }

        const quote = await response.json();

        if (quote.buyAmount && BigInt(quote.buyAmount) > 0) {
          const outputAmount = formatUnits(BigInt(quote.buyAmount), BTC1_TOKEN.decimals);
          setToAmount(parseFloat(outputAmount).toFixed(6));
          
          // Extract sources (DEXes used in the route)
          const sources = quote.sources
            ?.filter((s: any) => parseFloat(s.proportion) > 0)
            .map((s: any) => s.name)
            .join(', ') || 'Multiple DEXes';

          setRouteData({
            provider: '0x-protocol',
            dexName: sources,
            sellToken,
            buyToken,
            sellAmount: amountIn.toString(),
            buyAmount: quote.buyAmount,
            price: quote.price,
            guaranteedPrice: quote.guaranteedPrice,
            estimatedPriceImpact: quote.estimatedPriceImpact,
            gas: quote.gas,
            gasPrice: quote.gasPrice,
            to: quote.to,
            data: quote.data,
            value: quote.value,
          });
        } else {
          throw new Error('No liquidity found');
        }
      } catch (err: any) {
        console.error("0x Protocol quote error:", err);
        
        // Fallback to estimate
        const estimatedRate = fromToken.symbol === 'USDC' || fromToken.symbol === 'USDbC' ? 1 :
                             fromToken.symbol === 'ETH' || fromToken.symbol === 'WETH' ? 3000 :
                             fromToken.symbol === 'DAI' ? 1 :
                             fromToken.symbol === 'cbBTC' ? 95000 : 1;
        
        const estimatedOutput = parseFloat(fromAmount) * estimatedRate;
        setToAmount(estimatedOutput.toFixed(6));
        setRouteData({
          provider: 'estimate',
          isEstimate: true,
        });
        setError('No BTC1 liquidity found. Add liquidity on any DEX (Uniswap, Aerodrome, etc.) to enable swaps.');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 1000);
    return () => clearTimeout(debounce);
  }, [fromAmount, fromToken, address]);

  // Execute swap using 0x Protocol transaction
  const handleSwap = async () => {
    if (!routeData || !walletClient || !address) return;

    try {
      setSwapping(true);
      setError(null);
      setSuccess(false);

      // Handle 0x Protocol swap
      if (!routeData.isEstimate && routeData.to && routeData.data) {
        // For getting swap transaction, we need to call /swap/v1/quote with full params
        const sellToken = fromToken.isNative ? WETH_ADDRESS : fromToken.address;
        const buyToken = BTC1_TOKEN.address;
        const sellAmount = routeData.sellAmount;
        
        const params = new URLSearchParams({
          sellToken,
          buyToken,
          sellAmount,
          takerAddress: address,
          slippagePercentage: '0.01',
        });

        const response = await fetch(`${ZEROX_API_URL}/swap/v1/quote?${params}`, {
          headers: {
            '0x-api-key': process.env.NEXT_PUBLIC_0X_API_KEY || '',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to get swap transaction');
        }

        const swapQuote = await response.json();

        // Execute the transaction
        const hash = await walletClient.sendTransaction({
          to: swapQuote.to as `0x${string}`,
          data: swapQuote.data as `0x${string}`,
          value: BigInt(swapQuote.value || '0'),
          account: address as `0x${string}`,
          chain: walletClient.chain,
          gas: swapQuote.gas ? BigInt(swapQuote.gas) : undefined,
          gasPrice: swapQuote.gasPrice ? BigInt(swapQuote.gasPrice) : undefined,
        });
        
        setTxHash(hash);
        setSuccess(true);
      } 
      // For estimates, open Uniswap
      else if (routeData.isEstimate) {
        const sellTokenAddress = fromToken.isNative 
          ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" 
          : fromToken.address;
        window.open(
          `https://app.uniswap.org/swap?chain=base&inputCurrency=${sellTokenAddress}&outputCurrency=${BTC1_TOKEN.address}`, 
          '_blank'
        );
        setError('Opening Uniswap. Add liquidity there to enable in-app swaps.');
        return;
      }
      
      setFromAmount("");
      setToAmount("");
      setRouteData(null);

      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Swap error:", err);
      const isRejection = err?.message?.toLowerCase().includes('rejected') || 
                         err?.message?.toLowerCase().includes('denied');
      setError(isRejection ? 'Transaction rejected' : (err.message || "Swap failed"));
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Success Message */}
      {success && (
        <Alert className="bg-green-500/10 border-green-500/50">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <AlertDescription className="text-green-400">
            Swap successful! 
            {txHash && (
              <a 
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 underline hover:text-green-300"
              >
                View transaction
              </a>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* From Token */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm text-gray-400">From</label>
          {balance && address && (
            <button
              onClick={handleMaxClick}
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
            >
              <Wallet className="h-3 w-3" />
              {parseFloat(balance.formatted).toFixed(6)} {fromToken.symbol}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
          <Select value={fromToken.address} onValueChange={handleTokenChange}>
            <SelectTrigger className="w-[130px] bg-transparent border-none focus:ring-0">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    {fromToken.symbol[0]}
                  </div>
                  <span className="font-semibold">{fromToken.symbol}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {BASE_TOKENS.map((token) => (
                <SelectItem key={token.address} value={token.address}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      {token.symbol[0]}
                    </div>
                    <div>
                      <div className="font-semibold">{token.symbol}</div>
                      <div className="text-xs text-gray-400">{token.name}</div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="0.0"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            className="flex-1 bg-transparent border-none text-right text-lg font-semibold focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Arrow Icon */}
      <div className="flex justify-center">
        <div className="p-2 rounded-full bg-gray-800 border border-gray-700">
          <ArrowDownUp className="h-4 w-4 text-orange-400" />
        </div>
      </div>

      {/* To Token (BTC1 - Fixed) */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">To (estimated)</label>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
          <div className="flex items-center gap-2 min-w-[130px]">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
              B
            </div>
            <span className="font-semibold text-white">BTC1</span>
          </div>
          <div className="flex-1 text-right text-lg font-semibold text-gray-300">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin ml-auto" />
            ) : (
              toAmount || "0.0"
            )}
          </div>
        </div>
      </div>

      {/* Error Display with helpful info */}
      {error && (
        <Alert variant="destructive" className="bg-yellow-500/10 border-yellow-500/50">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <AlertDescription className="text-yellow-400">
            {error}
            {routeData?.isEstimate && (
              <div className="mt-3 space-y-2 text-xs">
                <div className="font-semibold text-yellow-300">💡 How to enable swaps:</div>
                <div className="space-y-1 text-yellow-200/90">
                  <div>• <strong>Add Liquidity</strong> on Uniswap to create a BTC1 pool</div>
                  <div>• <strong>Or swap manually</strong> by clicking the button below</div>
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Swap Button */}
      <Button
        onClick={handleSwap}
        disabled={!routeData || swapping || !address || loading}
        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6 text-base disabled:opacity-50"
      >
        {swapping ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Swapping...
          </>
        ) : !address ? (
          "Connect Wallet"
        ) : loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Finding best route...
          </>
        ) : !routeData ? (
          "Enter Amount"
        ) : routeData.isEstimate ? (
          "Swap on Uniswap (Manual)"
        ) : (
          "Swap Now"
        )}
      </Button>

      {/* Route Details */}
      {routeData && !error && toAmount && fromAmount && (
        <div className="text-xs text-gray-400 space-y-1 p-3 rounded-lg bg-gray-800/30 border border-gray-700">
          <div className="flex justify-between">
            <span>Rate:</span>
            <span>
              1 {fromToken.symbol} ≈ {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)} BTC1
            </span>
          </div>
          {routeData.estimatedPriceImpact && (
            <div className="flex justify-between">
              <span>Price Impact:</span>
              <span className={parseFloat(routeData.estimatedPriceImpact) > 2 ? "text-yellow-400" : "text-green-400"}>
                {parseFloat(routeData.estimatedPriceImpact).toFixed(2)}%
              </span>
            </div>
          )}
          {routeData.estimatedGas && (
            <div className="flex justify-between">
              <span>Est. Gas:</span>
              <span className="text-gray-300">
                {parseInt(routeData.estimatedGas).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gray-700 mt-2">
            <span className="text-gray-500">Best route:</span>
            <span className="text-orange-400 font-semibold">
              {routeData.dexName || 'Estimated'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
