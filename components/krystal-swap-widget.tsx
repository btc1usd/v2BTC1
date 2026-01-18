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

// Uniswap V3 Contracts on Base
const UNISWAP_V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481"; // SwapRouter02
const UNISWAP_V3_QUOTER = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"; // QuoterV2
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base

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

  // Fetch quote using Uniswap V3 Quoter contract (same strategy as Uniswap interface)
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
        
        // Use WETH for native ETH
        const tokenIn = fromToken.isNative ? WETH_ADDRESS : fromToken.address;
        const tokenOut = BTC1_TOKEN.address;
        
        // Use Uniswap's QuoterV2 with correct ABI
        const quoterABI = [
          {
            inputs: [
              {
                components: [
                  { name: 'tokenIn', type: 'address' },
                  { name: 'tokenOut', type: 'address' },
                  { name: 'amountIn', type: 'uint256' },
                  { name: 'fee', type: 'uint24' },
                  { name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
                name: 'params',
                type: 'tuple',
              },
            ],
            name: 'quoteExactInputSingle',
            outputs: [
              { name: 'amountOut', type: 'uint256' },
              { name: 'sqrtPriceX96After', type: 'uint160' },
              { name: 'initializedTicksCrossed', type: 'uint32' },
              { name: 'gasEstimate', type: 'uint256' },
            ],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ];

        // Call quoter using viem
        const { createPublicClient, http } = await import('viem');
        const { base } = await import('viem/chains');
        
        const publicClient = createPublicClient({
          chain: base,
          transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
        });

        // Try different fee tiers (same as Uniswap interface)
        let bestQuote = null;
        let bestFee = 0;
        
        for (const fee of [100, 500, 3000, 10000]) {
          try {
            const result = await publicClient.readContract({
              address: UNISWAP_V3_QUOTER as `0x${string}`,
              abi: quoterABI,
              functionName: 'quoteExactInputSingle',
              args: [{
                tokenIn,
                tokenOut,
                amountIn,
                fee,
                sqrtPriceLimitX96: 0,
              }],
            }) as any;
            
            const amountOut = result[0];
            if (amountOut > 0 && (!bestQuote || amountOut > bestQuote)) {
              bestQuote = amountOut;
              bestFee = fee;
            }
          } catch (e: any) {
            // Pool doesn't exist for this fee tier, continue
            console.log(`No pool for fee tier ${fee / 10000}%:`, e.message);
          }
        }

        if (bestQuote && bestQuote > 0) {
          const outputAmount = formatUnits(bestQuote, BTC1_TOKEN.decimals);
          setToAmount(parseFloat(outputAmount).toFixed(6));
          setRouteData({
            provider: 'uniswap',
            tokenIn,
            tokenOut,
            amountIn: amountIn.toString(),
            amountOut: bestQuote.toString(),
            fee: bestFee,
          });
        } else {
          throw new Error('No liquidity pool found');
        }
      } catch (err: any) {
        console.error("Uniswap quote error:", err);
        
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
        setError('No BTC1 liquidity pool exists yet on Uniswap V3. Showing estimate based on market rates.');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 1000);
    return () => clearTimeout(debounce);
  }, [fromAmount, fromToken, address]);

  // Execute swap using Uniswap V3 Router
  const handleSwap = async () => {
    if (!routeData || !walletClient || !address) return;

    try {
      setSwapping(true);
      setError(null);
      setSuccess(false);

      // Handle Uniswap V3 swap
      if (routeData.provider === 'uniswap' && !routeData.isEstimate) {
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
        const amountOutMinimum = (BigInt(routeData.amountOut) * BigInt(99)) / BigInt(100); // 1% slippage

        // exactInputSingle function parameters
        const swapParams = {
          tokenIn: routeData.tokenIn,
          tokenOut: routeData.tokenOut,
          fee: routeData.fee,
          recipient: address,
          deadline: deadline,
          amountIn: BigInt(routeData.amountIn),
          amountOutMinimum: amountOutMinimum,
          sqrtPriceLimitX96: 0,
        };

        // Router ABI for exactInputSingle
        const routerABI = [
          {
            inputs: [
              {
                components: [
                  { name: 'tokenIn', type: 'address' },
                  { name: 'tokenOut', type: 'address' },
                  { name: 'fee', type: 'uint24' },
                  { name: 'recipient', type: 'address' },
                  { name: 'deadline', type: 'uint256' },
                  { name: 'amountIn', type: 'uint256' },
                  { name: 'amountOutMinimum', type: 'uint256' },
                  { name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
                name: 'params',
                type: 'tuple',
              },
            ],
            name: 'exactInputSingle',
            outputs: [{ name: 'amountOut', type: 'uint256' }],
            stateMutability: 'payable',
            type: 'function',
          },
        ];

        const calldata = encodeFunctionData({
          abi: routerABI,
          functionName: 'exactInputSingle',
          args: [swapParams],
        });

        const hash = await walletClient.sendTransaction({
          to: UNISWAP_V3_ROUTER as `0x${string}`,
          data: calldata,
          value: fromToken.isNative ? BigInt(routeData.amountIn) : BigInt(0),
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
