"use client";

/**
 * Universal Swap Widget
 * Shows price quotes and provides direct links to swap on Uniswap/Aerodrome
 * Supports popular tokens on Base network
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

  // Fetch quote using direct Uniswap V3 quoter
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
        
        // Try 1inch API first (reliable for Base)
        try {
          const oneinchUrl = `https://api.1inch.dev/swap/v6.0/8453/quote?` +
            `src=${sellToken}&` +
            `dst=${BTC1_TOKEN.address}&` +
            `amount=${amountWei}`;
          
          const oneinchResponse = await fetch(oneinchUrl, {
            headers: {
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_1INCH_API_KEY || ''}`,
            },
          });
          
          if (oneinchResponse.ok) {
            const oneinchData = await oneinchResponse.json();
            
            if (oneinchData.dstAmount) {
              const outputAmount = formatUnits(
                BigInt(oneinchData.dstAmount), 
                BTC1_TOKEN.decimals
              );
              setToAmount(parseFloat(outputAmount).toFixed(6));
              setRouteData({
                provider: '1inch',
                srcToken: sellToken,
                dstToken: BTC1_TOKEN.address,
                srcAmount: amountWei,
                dstAmount: oneinchData.dstAmount,
                protocols: oneinchData.protocols,
                estimatedGas: oneinchData.estimatedGas,
              });
              setLoading(false);
              return;
            }
          }
        } catch (oneinchError) {
          console.log('1inch failed, trying Odos...');
        }
        
        // Try Odos API (good for Base network)
        try {
          const odosQuoteUrl = 'https://api.odos.xyz/sor/quote/v2';
          const odosQuoteBody = {
            chainId: 8453,
            inputTokens: [
              {
                tokenAddress: sellToken,
                amount: amountWei,
              }
            ],
            outputTokens: [
              {
                tokenAddress: BTC1_TOKEN.address,
                proportion: 1,
              }
            ],
            userAddr: address,
            slippageLimitPercent: 1,
            referralCode: 0,
            compact: true,
          };
          
          const odosResponse = await fetch(odosQuoteUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(odosQuoteBody),
          });
          
          if (odosResponse.ok) {
            const odosData = await odosResponse.json();
            
            if (odosData.outAmounts && odosData.outAmounts[0]) {
              const outputAmount = formatUnits(
                BigInt(odosData.outAmounts[0]), 
                BTC1_TOKEN.decimals
              );
              setToAmount(parseFloat(outputAmount).toFixed(6));
              setRouteData({
                provider: 'odos',
                pathId: odosData.pathId,
                srcToken: sellToken,
                dstToken: BTC1_TOKEN.address,
                srcAmount: amountWei,
                dstAmount: odosData.outAmounts[0],
                gasEstimate: odosData.gasEstimate,
              });
              setLoading(false);
              return;
            }
          }
        } catch (odosError) {
          console.log('Odos failed, using estimation...');
        }
        
        // Fallback: Simple price estimation
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
        setError('Quote unavailable. Showing estimate. Please swap on Uniswap or Aerodrome directly.');
      } catch (err: any) {
        console.error("Quote error:", err);
        setError(err.message || "Failed to get quote. Please use Uniswap or Aerodrome directly.");
        setToAmount("");
        setRouteData(null);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 800);
    return () => clearTimeout(debounce);
  }, [fromAmount, fromToken, address]);

  // Execute swap using 1inch or Odos
  const handleSwap = async () => {
    if (!routeData || !walletClient || !address) return;

    try {
      setSwapping(true);
      setError(null);
      setSuccess(false);

      // Handle 1inch swap
      if (routeData.provider === '1inch') {
        const swapUrl = `https://api.1inch.dev/swap/v6.0/8453/swap?` +
          `src=${routeData.srcToken}&` +
          `dst=${routeData.dstToken}&` +
          `amount=${routeData.srcAmount}&` +
          `from=${address}&` +
          `slippage=1`;
        
        const swapResponse = await fetch(swapUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_1INCH_API_KEY || ''}`,
          },
        });
        
        const swapData = await swapResponse.json();
        
        const hash = await walletClient.sendTransaction({
          to: swapData.tx.to as `0x${string}`,
          data: swapData.tx.data as `0x${string}`,
          value: fromToken.isNative ? BigInt(routeData.srcAmount) : BigInt(0),
          account: address as `0x${string}`,
          chain: walletClient.chain,
          gas: swapData.tx.gas ? BigInt(swapData.tx.gas) : undefined,
        });
        
        setTxHash(hash);
        setSuccess(true);
      } 
      // Handle Odos swap
      else if (routeData.provider === 'odos' && routeData.pathId) {
        const assembleUrl = 'https://api.odos.xyz/sor/assemble';
        const assembleBody = {
          userAddr: address,
          pathId: routeData.pathId,
          simulate: false,
        };
        
        const assembleResponse = await fetch(assembleUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(assembleBody),
        });
        
        const assembleData = await assembleResponse.json();
        
        if (assembleData.transaction) {
          const hash = await walletClient.sendTransaction({
            to: assembleData.transaction.to as `0x${string}`,
            data: assembleData.transaction.data as `0x${string}`,
            value: fromToken.isNative ? BigInt(routeData.srcAmount) : BigInt(assembleData.transaction.value || '0'),
            account: address as `0x${string}`,
            chain: walletClient.chain,
            gas: assembleData.transaction.gas ? BigInt(assembleData.transaction.gas) : undefined,
          });
          
          setTxHash(hash);
          setSuccess(true);
        } else {
          throw new Error('Failed to assemble transaction');
        }
      } 
      // For estimates, redirect to DEX
      else if (routeData.isEstimate) {
        window.open('https://app.uniswap.org/swap?chain=base', '_blank');
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
      setError(isRejection ? 'Transaction rejected' : (err.message || "Swap failed. Try Uniswap directly."));
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
        ) : routeData.isEstimate ? (
          "Open Uniswap to Swap"
        ) : (
          "Swap"
        )}
      </Button>

      {/* Direct DEX Links */}
      {address && routeData && (
        <div className="flex gap-2">
          <Button
            onClick={() => window.open('https://app.uniswap.org/swap?chain=base&inputCurrency=' + fromToken.address + '&outputCurrency=' + BTC1_TOKEN.address, '_blank')}
            variant="outline"
            className="flex-1 border-gray-700 hover:bg-gray-800 text-gray-300"
          >
            Swap on Uniswap
          </Button>
          <Button
            onClick={() => window.open('https://aerodrome.finance/swap?from=' + fromToken.address + '&to=' + BTC1_TOKEN.address, '_blank')}
            variant="outline"
            className="flex-1 border-gray-700 hover:bg-gray-800 text-gray-300"
          >
            Swap on Aerodrome
          </Button>
        </div>
      )}

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
              {routeData.provider === '1inch' ? '1inch' : 
               routeData.provider === 'odos' ? 'Odos' :
               routeData.isEstimate ? 'Estimated' : 'DEX Aggregator'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
