"use client";

/**
 * Universal Swap Widget
 * Direct token swap to BTC1 using 0x Protocol DEX Aggregator
 * Supports any ERC20 token on Base network
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

interface Token {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  isNative?: boolean;
}

// Popular tokens on Base network
const BASE_TOKENS: Token[] = [
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

const BTC1_TOKEN: Token = {
  address: "0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5",
  symbol: "BTC1",
  decimals: 18,
  name: "BTC1 Token",
};

export function KrystalSwapWidget() {
  const { address } = useWeb3();
  const { data: walletClient } = useWalletClient();
  
  const [fromToken, setFromToken] = useState<Token>(BASE_TOKENS[1]); // Default USDC
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

  // Fetch quote from multiple DEX aggregators with fallback
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

        const amountWei = parseUnits(fromAmount, fromToken.decimals).toString();
        
        // Use WETH address for native ETH
        const sellToken = fromToken.isNative 
          ? "0x4200000000000000000000000000000000000006" // WETH on Base
          : fromToken.address;
        
        // Try ParaSwap first (good for Base network)
        try {
          const paraswapParams = new URLSearchParams({
            srcToken: sellToken,
            destToken: BTC1_TOKEN.address,
            amount: amountWei,
            srcDecimals: fromToken.decimals.toString(),
            destDecimals: BTC1_TOKEN.decimals.toString(),
            side: "SELL",
            network: "8453",
            userAddress: address,
          });
          
          const paraswapUrl = `https://apiv5.paraswap.io/prices/?${paraswapParams}`;
          const paraswapResponse = await fetch(paraswapUrl);
          
          if (paraswapResponse.ok) {
            const paraswapData = await paraswapResponse.json();
            
            if (paraswapData.priceRoute) {
              const outputAmount = formatUnits(
                BigInt(paraswapData.priceRoute.destAmount), 
                BTC1_TOKEN.decimals
              );
              setToAmount(parseFloat(outputAmount).toFixed(6));
              setRouteData({
                provider: 'paraswap',
                priceRoute: paraswapData.priceRoute,
                sellAmount: amountWei,
                buyAmount: paraswapData.priceRoute.destAmount,
                estimatedGas: paraswapData.priceRoute.gasCost,
              });
              setLoading(false);
              return;
            }
          }
        } catch (paraswapError) {
          console.log('ParaSwap failed, trying alternative...');
        }
        
        // Fallback: Simple price estimation using Uniswap-like formula
        // This gives users an estimate even if APIs fail
        try {
          // Estimate: 1 USDC ≈ 1 BTC1 (adjust based on your pool ratios)
          const estimatedRate = fromToken.symbol === 'USDC' || fromToken.symbol === 'USDbC' ? 1 :
                               fromToken.symbol === 'ETH' || fromToken.symbol === 'WETH' ? 3000 :
                               fromToken.symbol === 'DAI' ? 1 :
                               fromToken.symbol === 'cbBTC' ? 95000 : 1;
          
          const estimatedOutput = parseFloat(fromAmount) * estimatedRate;
          setToAmount(estimatedOutput.toFixed(6));
          setRouteData({
            provider: 'estimate',
            sellAmount: amountWei,
            buyAmount: parseUnits(estimatedOutput.toString(), BTC1_TOKEN.decimals).toString(),
            isEstimate: true,
          });
          setError('Using estimated rate. Actual price may vary. Consider using direct DEX.');
        } catch (estimateError) {
          throw new Error('Unable to fetch quote from any source');
        }
      } catch (err: any) {
        console.error("Quote error:", err);
        setError(err.message || "Failed to get quote. Please try again or use a different token.");
        setToAmount("");
        setRouteData(null);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 800);
    return () => clearTimeout(debounce);
  }, [fromAmount, fromToken, address]);

  // Execute swap using ParaSwap or direct swap
  const handleSwap = async () => {
    if (!routeData || !walletClient || !address) return;

    try {
      setSwapping(true);
      setError(null);
      setSuccess(false);

      // If using ParaSwap, build and execute transaction
      if (routeData.provider === 'paraswap' && routeData.priceRoute) {
        // Build transaction data from ParaSwap
        const buildParams = new URLSearchParams({
          srcToken: fromToken.isNative ? "0x4200000000000000000000000000000000000006" : fromToken.address,
          destToken: BTC1_TOKEN.address,
          srcAmount: routeData.sellAmount,
          destAmount: routeData.buyAmount,
          priceRoute: JSON.stringify(routeData.priceRoute),
          userAddress: address,
          slippage: "100", // 1%
        });
        
        const buildResponse = await fetch(`https://apiv5.paraswap.io/transactions/8453?${buildParams}`);
        const txData = await buildResponse.json();
        
        const hash = await walletClient.sendTransaction({
          to: txData.to as `0x${string}`,
          data: txData.data as `0x${string}`,
          value: fromToken.isNative ? BigInt(routeData.sellAmount) : BigInt(0),
          account: address as `0x${string}`,
          chain: walletClient.chain,
          gas: txData.gas ? BigInt(txData.gas) : undefined,
        });
        
        setTxHash(hash);
        setSuccess(true);
      } else if (routeData.isEstimate) {
        // For estimates, show message to use direct DEX
        setError('Please use a direct DEX like Uniswap or Aerodrome for this swap. Visit app.uniswap.org or aerodrome.finance');
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
      setError(isRejection ? 'Transaction rejected' : (err.message || "Swap failed. Try using Uniswap or Aerodrome directly."));
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
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400">{error}</AlertDescription>
        </Alert>
      )}

      {/* Swap Button */}
      <Button
        onClick={handleSwap}
        disabled={!routeData || swapping || !address}
        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6 text-base disabled:opacity-50"
      >
        {swapping ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Swapping...
          </>
        ) : !address ? (
          "Connect Wallet"
        ) : !routeData ? (
          "Enter Amount"
        ) : (
          "Swap"
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
              {routeData.provider === 'paraswap' ? 'ParaSwap' : routeData.isEstimate ? 'Estimated' : 'DEX Aggregator'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
