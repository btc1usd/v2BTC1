"use client";

/**
 * Professional In-App Swap Widget
 * Powered by 0x Protocol API on Base Mainnet
 * Supports any ERC-20 or ETH → BTC1 with automatic routing
 */

import { useState, useEffect } from "react";
import { useWalletClient, useBalance, usePublicClient } from 'wagmi';
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
import { formatUnits, parseUnits, erc20Abi } from "viem";

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  isNative?: boolean;
}

interface ZeroXQuote {
  buyAmount: string;
  estimatedPriceImpact: string;
  estimatedGas: string;
  to: string;
  data: string;
  value: string;
  allowanceTarget: string;
  sources: Array<{ name: string; proportion: string }>;
}

const BASE_CHAIN_ID = 8453;
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const BASE_TOKENS: TokenInfo[] = [
  { address: ETH_ADDRESS, symbol: "ETH", decimals: 18, name: "Ethereum", isNative: true },
  { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6, name: "USD Coin" },
  { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
  { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", decimals: 18, name: "Dai Stablecoin" },
  { address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", symbol: "USDbC", decimals: 6, name: "USD Base Coin" },
  { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", symbol: "cbBTC", decimals: 8, name: "Coinbase Wrapped BTC" },
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
  const publicClient = usePublicClient();
  
  const [fromToken, setFromToken] = useState<TokenInfo>(BASE_TOKENS[1]);
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [quote, setQuote] = useState<ZeroXQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [approving, setApproving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string>("");
  const [needsApproval, setNeedsApproval] = useState(false);

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
      setQuote(null);
      setError(null);
      setNeedsApproval(false);
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

  // Fetch quote from 0x Protocol API directly
  useEffect(() => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || !address) {
      setToAmount("");
      setQuote(null);
      setNeedsApproval(false);
      return;
    }

    const fetchQuote = async () => {
      try {
        setLoading(true);
        setError(null);

        const sellAmount = parseUnits(fromAmount, fromToken.decimals).toString();
        // Use 'ETH' for native ETH, not the wrapped address
        const sellTokenParam = fromToken.isNative ? 'ETH' : fromToken.address;
        
        const params = new URLSearchParams({
          sellToken: sellTokenParam,
          buyToken: BTC1_TOKEN.address,
          sellAmount,
          takerAddress: address,
          slippagePercentage: '0.01',
        });

        // Call 0x API directly from frontend
        const response = await fetch(`https://base.api.0x.org/swap/v1/quote?${params}`, {
          headers: {
            '0x-api-key': process.env.zerox_API_KEY || '',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.reason || `0x API error: ${response.status}`);
        }

        const quoteData: ZeroXQuote = await response.json();
        setQuote(quoteData);
        setToAmount(formatUnits(BigInt(quoteData.buyAmount), BTC1_TOKEN.decimals));

        // Check if approval needed for ERC-20 tokens
        if (!fromToken.isNative && publicClient) {
          const allowance = await publicClient.readContract({
            address: fromToken.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address as `0x${string}`, quoteData.allowanceTarget as `0x${string}`],
          });
          setNeedsApproval(allowance < BigInt(sellAmount));
        } else {
          setNeedsApproval(false);
        }
      } catch (err: any) {
        console.error("Quote error:", err);
        setError(err.message || 'Failed to get quote');
        setQuote(null);
        setToAmount("");
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 800);
    return () => clearTimeout(debounce);
  }, [fromAmount, fromToken, address, publicClient]);

  // Approve token spending
  const handleApprove = async () => {
    if (!quote || !walletClient || !address || fromToken.isNative) return;

    try {
      setApproving(true);
      setError(null);

      const hash = await walletClient.writeContract({
        address: fromToken.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [quote.allowanceTarget as `0x${string}`, BigInt(parseUnits(fromAmount, fromToken.decimals).toString())],
        account: address as `0x${string}`,
        chain: walletClient.chain,
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      setNeedsApproval(false);
    } catch (err: any) {
      console.error("Approval error:", err);
      const isRejection = err?.message?.toLowerCase().includes('rejected') || 
                         err?.message?.toLowerCase().includes('denied');
      setError(isRejection ? 'Approval rejected' : 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  // Execute swap
  const handleSwap = async () => {
    if (!quote || !walletClient || !address) return;

    try {
      setSwapping(true);
      setError(null);
      setSuccess(false);

      const hash = await walletClient.sendTransaction({
        to: quote.to as `0x${string}`,
        data: quote.data as `0x${string}`,
        value: BigInt(quote.value),
        account: address as `0x${string}`,
        chain: walletClient.chain,
        gas: BigInt(quote.estimatedGas),
      });
      
      setTxHash(hash);
      setSuccess(true);
      setFromAmount("");
      setToAmount("");
      setQuote(null);

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
        <label className="text-sm text-gray-400">To</label>
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

      {quote && quote.sources && (
        <div className="text-xs text-gray-400 flex justify-between">
          <span>Route: {quote.sources.filter((s: any) => parseFloat(s.proportion) > 0).map((s: any) => s.name).join(', ')}</span>
          {quote.estimatedPriceImpact && (
            <span>Impact: {(parseFloat(quote.estimatedPriceImpact) * 100).toFixed(2)}%</span>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400">{error}</AlertDescription>
        </Alert>
      )}

      {needsApproval ? (
        <Button
          onClick={handleApprove}
          disabled={approving || !address}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold"
        >
          {approving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Approving...
            </>
          ) : (
            `Approve ${fromToken.symbol}`
          )}
        </Button>
      ) : (
        <Button
          onClick={handleSwap}
          disabled={!quote || swapping || loading || !address || parseFloat(fromAmount) <= 0}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold"
        >
          {swapping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Swapping...
            </>
          ) : !address ? (
            "Connect Wallet"
          ) : (
            "Swap Now"
          )}
        </Button>
      )}

      <div className="text-xs text-center text-gray-500">
        Powered by <span className="text-orange-400">0x Protocol</span>
      </div>
    </div>
  );
}
