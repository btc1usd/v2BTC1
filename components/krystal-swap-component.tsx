"use client";

/**
 * Krystal Swap Component
 * Custom React component that uses Krystal's Swap API for direct token swaps
 * Allows users to swap any token to BTC1
 */

import { useState, useEffect } from "react";
import { useWalletClient, useBalance } from 'wagmi';
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
import { Loader2, ArrowDownUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { useWeb3 } from "@/lib/web3-provider";

interface Token {
  address: string;
  symbol: string;
  decimals: number;
  logo?: string;
  name: string;
}

interface SwapQuote {
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  route: any;
}

// Common tokens on Base network
const BASE_TOKENS: Token[] = [
  {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    symbol: "ETH",
    decimals: 18,
    name: "Ethereum",
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
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    symbol: "cbETH",
    decimals: 18,
    name: "Coinbase Wrapped Staked ETH",
  },
];

const BTC1_BASE: Token = {
  address: "0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5",
  symbol: "BTC1",
  decimals: 18,
  name: "BTC1 Token",
};

export function KrystalSwapComponent() {
  const { address, chainId } = useWeb3();
  const { data: walletClient } = useWalletClient();
  
  const [fromToken, setFromToken] = useState<Token>(BASE_TOKENS[1]); // Default to USDC
  const [toToken] = useState<Token>(BTC1_BASE);
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [success, setSuccess] = useState(false);

  // Get token balance
  const { data: balance } = useBalance({
    address: address as `0x${string}`,
    token: fromToken.address === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" 
      ? undefined 
      : fromToken.address as `0x${string}`,
  });

  // Handle token selection change
  const handleTokenChange = (tokenAddress: string) => {
    const selected = BASE_TOKENS.find(t => t.address === tokenAddress);
    if (selected) {
      setFromToken(selected);
      setFromAmount("");
      setToAmount("");
      setQuote(null);
      setError(null);
    }
  };

  // Set max amount
  const handleMaxClick = () => {
    if (balance) {
      const maxAmount = parseFloat(balance.formatted);
      // Leave a bit for gas if it's ETH
      const amount = fromToken.symbol === "ETH" 
        ? Math.max(0, maxAmount - 0.001).toFixed(6)
        : maxAmount.toFixed(6);
      setFromAmount(amount);
    }
  };

  // Fetch quote when amount changes
  useEffect(() => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || !address) {
      setToAmount("");
      setQuote(null);
      return;
    }

    const fetchQuote = async () => {
      try {
        setLoading(true);
        setError(null);

        const amountInWei = (parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toFixed(0);
        
        // Krystal Swap API endpoint
        const url = `https://aggregator-api.krystal.app/base/route/encode?` +
          `tokenIn=${fromToken.address}&` +
          `tokenOut=${toToken.address}&` +
          `amountIn=${amountInWei}&` +
          `to=${address}&` +
          `saveGas=0&` +
          `slippageTolerance=50`;
        
        console.log('Fetching quote:', url);
        const response = await fetch(url);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error:', response.status, errorText);
          throw new Error(`Failed to fetch quote: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Krystal API Response:', data);
        
        if (data.outputAmount) {
          const outputAmountDecimal = parseFloat(data.outputAmount) / Math.pow(10, toToken.decimals);
          setToAmount(outputAmountDecimal.toFixed(6));
          setQuote({
            amountIn: fromAmount,
            amountOut: outputAmountDecimal.toString(),
            priceImpact: parseFloat(data.priceImpact || "0"),
            route: data,
          });
        } else {
          throw new Error('No liquidity available for this pair');
        }
      } catch (err: any) {
        console.error("Quote error:", err);
        setError(err.message || "Failed to get quote");
        setToAmount("");
        setQuote(null);
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
      setSuccess(false);

      // Execute swap transaction
      const txData = quote.route.encodedSwapData;
      const routerAddress = quote.route.routerAddress;
      const value = fromToken.symbol === "ETH" ? BigInt(quote.route.amountIn || 0) : BigInt(0);

      console.log('Executing swap:', { routerAddress, txData, value });

      const hash = await walletClient.sendTransaction({
        to: routerAddress as `0x${string}`,
        data: txData as `0x${string}`,
        value: value,
        account: address as `0x${string}`,
        chain: walletClient.chain,
      });

      console.log("Swap transaction sent:", hash);
      setSuccess(true);
      setFromAmount("");
      setToAmount("");
      setQuote(null);

      // Hide success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Swap error:", err);
      const isRejection = err?.message?.toLowerCase().includes('rejected') || 
                         err?.message?.toLowerCase().includes('denied');
      setError(isRejection ? 'Transaction rejected by user' : (err.message || "Swap failed"));
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
            Swap successful! Transaction confirmed.
          </AlertDescription>
        </Alert>
      )}

      {/* From Token */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm text-gray-400">From</label>
          {balance && (
            <button
              onClick={handleMaxClick}
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
            >
              Balance: {parseFloat(balance.formatted).toFixed(6)} {fromToken.symbol}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
          <Select value={fromToken.address} onValueChange={handleTokenChange}>
            <SelectTrigger className="w-[140px] bg-transparent border-none focus:ring-0 focus:ring-offset-0">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                    {fromToken.symbol[0]}
                  </div>
                  <span className="font-semibold text-white">{fromToken.symbol}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {BASE_TOKENS.map((token) => (
                <SelectItem key={token.address} value={token.address} className="hover:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
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
