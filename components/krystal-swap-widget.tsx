"use client";

/**
 * Universal Swap Widget
 * In-app token swap to BTC1 using Uniswap V3 SDK
 * Provides best routing and pricing for Base network
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
import { Token as SDKToken, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { AlphaRouter } from '@uniswap/smart-order-router';
import { ethers } from 'ethers';

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  isNative?: boolean;
}

// Base Chain ID
const BASE_CHAIN_ID = 8453;

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

// Helper function to create SDK tokens
function createSDKToken(tokenInfo: TokenInfo): SDKToken {
  return new SDKToken(
    BASE_CHAIN_ID,
    tokenInfo.address,
    tokenInfo.decimals,
    tokenInfo.symbol,
    tokenInfo.name
  );
}

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

  // Fetch quote using Uniswap V3 SDK with AlphaRouter
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

        // Create ethers provider for Base network
        const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl) as any;
        
        // Initialize AlphaRouter
        const router = new AlphaRouter({
          chainId: BASE_CHAIN_ID,
          provider: provider,
        });

        // Use WETH for native ETH
        const sellTokenAddress = fromToken.isNative 
          ? "0x4200000000000000000000000000000000000006" 
          : fromToken.address;

        // Create SDK tokens
        const tokenIn = new SDKToken(
          BASE_CHAIN_ID,
          sellTokenAddress,
          fromToken.decimals,
          fromToken.symbol,
          fromToken.name
        );
        
        const tokenOut = createSDKToken(BTC1_TOKEN);

        // Create currency amount
        const amountIn = CurrencyAmount.fromRawAmount(
          tokenIn,
          parseUnits(fromAmount, fromToken.decimals).toString()
        );

        // Get route from Uniswap
        const route = await router.route(
          amountIn,
          tokenOut,
          TradeType.EXACT_INPUT,
          {
            type: 1, // SwapRouter02
            recipient: address,
            slippageTolerance: new Percent(50, 10_000), // 0.5%
            deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
          }
        );

        if (route && route.quote) {
          const outputAmount = formatUnits(
            BigInt(route.quote.toExact().split('.')[0] || route.quote.quotient.toString()),
            BTC1_TOKEN.decimals
          );
          
          setToAmount(parseFloat(outputAmount).toFixed(6));
          setRouteData({
            provider: 'uniswap',
            route: route,
            methodParameters: route.methodParameters,
            gasEstimate: route.estimatedGasUsed?.toString(),
            gasEstimateUSD: route.estimatedGasUsedUSD?.toFixed(2),
            priceImpact: route.trade?.priceImpact?.toFixed(2),
          });
        } else {
          throw new Error('No route found');
        }
      } catch (err: any) {
        console.error("Uniswap route error:", err);
        
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
        setError('No liquidity route found. Showing estimate. You may need to add liquidity or use a different token.');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 1000);
    return () => clearTimeout(debounce);
  }, [fromAmount, fromToken, address]);

  // Execute swap using Uniswap V3 route
  const handleSwap = async () => {
    if (!routeData || !walletClient || !address) return;

    try {
      setSwapping(true);
      setError(null);
      setSuccess(false);

      // Handle Uniswap V3 swap
      if (routeData.provider === 'uniswap' && routeData.methodParameters) {
        const { calldata, value, to } = routeData.methodParameters;
        
        const hash = await walletClient.sendTransaction({
          to: to as `0x${string}`,
          data: calldata as `0x${string}`,
          value: BigInt(value),
          account: address as `0x${string}`,
          chain: walletClient.chain,
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
        setError('Opening Uniswap. Complete your swap there.');
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

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="bg-yellow-500/10 border-yellow-500/50">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <AlertDescription className="text-yellow-400">
            {error}
            {routeData?.isEstimate && (
              <span className="block mt-2 text-xs">
                💡 Use the buttons below to swap on Uniswap or Aerodrome directly
              </span>
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
          "Open Uniswap (No Route Found)"
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
            <span className="text-gray-500">Powered by:</span>
            <span className="text-orange-400 font-semibold">
              {routeData.provider === 'uniswap' ? 'Uniswap V3' : 'Estimated'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
