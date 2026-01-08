"use client";

/**
 * Krystal Swap Component
 * Custom React component that uses Krystal's Swap API for direct token swaps
 */

import { useState, useEffect } from "react";
import { useWalletClient } from 'wagmi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowDownUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { useWeb3 } from "@/lib/web3-provider";

interface Token {
  address: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

interface SwapQuote {
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  route: any;
}

const USDC_BASE: Token = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  symbol: "USDC",
  decimals: 6,
};

const BTC1_BASE: Token = {
  address: "0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5",
  symbol: "BTC1",
  decimals: 18,
};

export function KrystalSwapComponent() {
  const { address, chainId } = useWeb3();
  const { data: walletClient } = useWalletClient();
  
  const [fromToken] = useState<Token>(USDC_BASE);
  const [toToken] = useState<Token>(BTC1_BASE);
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);

  // Fetch quote when amount changes
  useEffect(() => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount("");
      setQuote(null);
      return;
    }

    const fetchQuote = async () => {
      try {
        setLoading(true);
        setError(null);

        const amountInWei = (parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toString();
        
        // Krystal Swap API endpoint
        const response = await fetch(
          `https://aggregator-api.krystal.app/base/route/encode?` +
          `tokenIn=${fromToken.address}&` +
          `tokenOut=${toToken.address}&` +
          `amountIn=${amountInWei}&` +
          `to=${address || "0x0000000000000000000000000000000000000000"}&` +
          `saveGas=0&` +
          `slippageTolerance=50`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch quote");
        }

        const data = await response.json();
        
        if (data.outputAmount) {
          const outputAmount = parseFloat(data.outputAmount) / Math.pow(10, toToken.decimals);
          setToAmount(outputAmount.toFixed(6));
          setQuote({
            amountIn: fromAmount,
            amountOut: outputAmount.toString(),
            priceImpact: parseFloat(data.priceImpact || "0"),
            route: data,
          });
        }
      } catch (err: any) {
        console.error("Quote error:", err);
        setError(err.message || "Failed to get quote");
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [fromAmount, fromToken, toToken, address]);

  const handleSwap = async () => {
    if (!quote || !walletClient || !address) return;

    try {
      setSwapping(true);
      setError(null);

      // Execute swap transaction
      const txData = quote.route.encodedSwapData;
      const hash = await walletClient.sendTransaction({
        to: quote.route.routerAddress as `0x${string}`,
        data: txData as `0x${string}`,
        value: BigInt(0),
        account: address as `0x${string}`,
        chain: walletClient.chain,
      });

      console.log("Swap transaction sent:", hash);
      setFromAmount("");
      setToAmount("");
      setQuote(null);
    } catch (err: any) {
      console.error("Swap error:", err);
      setError(err.message || "Swap failed");
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* From Token */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">From</label>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
              {fromToken.symbol[0]}
            </div>
            <span className="font-semibold text-white">{fromToken.symbol}</span>
          </div>
          <Input
            type="number"
            placeholder="0.0"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            className="flex-1 bg-transparent border-none text-right text-xl font-semibold focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </div>

      {/* Swap Direction Icon */}
      <div className="flex justify-center">
        <div className="p-2 rounded-full bg-gray-800 border border-gray-700">
          <ArrowDownUp className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* To Token */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">To (estimated)</label>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold">
              {toToken.symbol[0]}
            </div>
            <span className="font-semibold text-white">{toToken.symbol}</span>
          </div>
          <div className="flex-1 text-right text-xl font-semibold text-gray-300">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin ml-auto" />
            ) : (
              toAmount || "0.0"
            )}
          </div>
        </div>
      </div>

      {/* Price Impact Warning */}
      {quote && quote.priceImpact > 2 && (
        <Alert className="bg-yellow-500/10 border-yellow-500/50">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <AlertDescription className="text-yellow-400">
            High price impact: {quote.priceImpact.toFixed(2)}%
          </AlertDescription>
        </Alert>
      )}

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
        disabled={!quote || swapping || !address}
        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6 text-lg"
      >
        {swapping ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Swapping...
          </>
        ) : !address ? (
          "Connect Wallet"
        ) : !quote ? (
          "Enter Amount"
        ) : (
          "Swap"
        )}
      </Button>

      {/* Quote Details */}
      {quote && !error && (
        <div className="text-xs text-gray-400 space-y-1 p-3 rounded-lg bg-gray-800/30">
          <div className="flex justify-between">
            <span>Rate:</span>
            <span>
              1 {fromToken.symbol} = {(parseFloat(quote.amountOut) / parseFloat(quote.amountIn)).toFixed(4)} {toToken.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Price Impact:</span>
            <span className={quote.priceImpact > 2 ? "text-yellow-400" : "text-green-400"}>
              {quote.priceImpact.toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
