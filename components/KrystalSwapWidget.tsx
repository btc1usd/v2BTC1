'use client';

import { useState, useEffect } from 'react';
import { ethers, JsonRpcProvider } from 'ethers';
import { PublicClient, WalletClient, Address, Hash } from 'viem';
import { SwapAggregator, SwapParams, SwapRoute } from '@/lib/swap-aggregator';

interface Token {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

interface SwapState {
  loading: boolean;
  error: string | null;
  success: boolean;
  txHash: Hash | null;
  route: SwapRoute | null;
  quoteLoading: boolean;
  quote: {
    amountOut: string;
    route: SwapRoute | null;
  } | null;
}

interface Props {
  provider: PublicClient | null;
  signer: WalletClient | null;
  chainId: number;
}

export default function KrystalSwapWidget({ provider, signer, chainId }: Props) {
  const [tokenIn, setTokenIn] = useState<Token>({
    address: '0x0000000000000000000000000000000000000000', // ETH
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
  });
  
  const [tokenOut, setTokenOut] = useState<Token>({
    address: '0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5', // BTC1
    symbol: 'BTC1',
    name: 'BTC1USD',
    decimals: 8,
  });
  
  const [amountIn, setAmountIn] = useState<string>('');
  const [recipient, setRecipient] = useState<Address>('0x0000000000000000000000000000000000000000');
  const [balance, setBalance] = useState<string>('0');
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5); // 0.5%
  
  const [state, setState] = useState<SwapState>({
    loading: false,
    quoteLoading: false,
    error: null,
    success: false,
    txHash: null,
    route: null,
    quote: null,
  });

  // Auto-set recipient from signer
  useEffect(() => {
    const getSignerAddress = async () => {
      if (signer) {
        try {
          const [address] = await signer.getAddresses();
          setRecipient(address as Address);
          
          // Get ETH balance using PublicClient
          if (provider) {
            const ethBalance = await provider.getBalance({ address: address as Address });
            setBalance(ethers.formatEther(ethBalance));
          }
        } catch (err) {
          console.error('Error getting signer info:', err);
        }
      }
    };
    
    getSignerAddress();
  }, [signer, provider]);

  // Fetch quote when amount changes
  useEffect(() => {
    if (amountIn && parseFloat(amountIn) > 0 && provider && signer) {
      fetchQuote();
    } else {
      setState(prev => ({ ...prev, quote: null }));
    }
  }, [amountIn, tokenIn, tokenOut, provider, signer, chainId]);

  const fetchQuote = async () => {
    if (!provider || !signer || !amountIn || parseFloat(amountIn) <= 0) return;
    
    setState(prev => ({ ...prev, quoteLoading: true, error: null }));
    
    try {
      const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
      
      const params: SwapParams = {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: amountInWei,
        recipient: recipient || '0x0000000000000000000000000000000000000000',
        slippageTolerance: slippageTolerance,
        deadlineMinutes: 20,
        chainId,
      };

      // Create a provider for the aggregator
      let rpcUrl = '';
      switch (chainId) {
        case 1: rpcUrl = 'https://mainnet.infura.io/v3/'; break;
        case 8453: rpcUrl = 'https://mainnet.base.org'; break;
        case 137: rpcUrl = 'https://polygon-rpc.com'; break;
        default: rpcUrl = 'https://mainnet.base.org';
      }
      
      const defaultProvider = new JsonRpcProvider(rpcUrl);
      
      // Initialize the swap aggregator
      const aggregator = new SwapAggregator(defaultProvider);
      
      // Get all possible routes
      const routes = await aggregator.getAllRoutesWithViem(provider, params);
      
      if (routes.length === 0) {
        setState(prev => ({ ...prev, quoteLoading: false, error: 'No routes found for this swap' }));
        return;
      }

      // Select the best route
      const bestRoute = aggregator.selectBestRoute(routes);
      
      // Format output amount
      const amountOutFormatted = ethers.formatUnits(bestRoute.amountOut, tokenOut.decimals);
      
      setState(prev => ({
        ...prev,
        quoteLoading: false,
        quote: {
          amountOut: amountOutFormatted,
          route: bestRoute
        }
      }));
    } catch (err: any) {
      console.error('Quote fetch failed:', err);
      setState(prev => ({
        ...prev,
        quoteLoading: false,
        error: err.message || 'Failed to fetch quote'
      }));
    }
  };

  const handleSwap = async () => {
    if (!signer || !provider) {
      setState(prev => ({ ...prev, error: 'Please connect your wallet first' }));
      return;
    }
    
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setState(prev => ({ ...prev, error: 'Please enter a valid amount' }));
      return;
    }
    
    if (!recipient) {
      setState(prev => ({ ...prev, error: 'Please enter a recipient address' }));
      return;
    }

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      success: false,
      txHash: null,
      route: null,
    }));

    try {
      const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
      
      const params: SwapParams = {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: amountInWei,
        recipient,
        slippageTolerance: slippageTolerance,
        deadlineMinutes: 20,
        chainId,
      };

      // Create a provider for the aggregator
      let rpcUrl = '';
      switch (chainId) {
        case 1: rpcUrl = 'https://mainnet.infura.io/v3/'; break;
        case 8453: rpcUrl = 'https://mainnet.base.org'; break;
        case 137: rpcUrl = 'https://polygon-rpc.com'; break;
        default: rpcUrl = 'https://mainnet.base.org';
      }
      
      const defaultProvider = new JsonRpcProvider(rpcUrl);
      
      // Initialize the swap aggregator
      const aggregator = new SwapAggregator(defaultProvider);
      
      // Execute the swap using viem
      const result = await aggregator.executeSwapWithViem(signer, provider, params);

      setState({
        loading: false,
        quoteLoading: false,
        error: null,
        success: true,
        txHash: result.hash,
        route: result.route,
        quote: state.quote,
      });

      // Reset form
      setAmountIn('');

      // Reset success state after 5 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, success: false }));
      }, 5000);
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
    if (tokenIn.address === '0x0000000000000000000000000000000000000000' && balance) {
      // Leave small amount for gas
      const maxAmount = parseFloat(balance) - 0.001;
      if (maxAmount > 0) {
        setAmountIn(maxAmount.toFixed(6));
      }
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-gray-900 rounded-xl border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Krystal Swap</h2>
      
      {state.error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-300">
          {state.error}
        </div>
      )}
      
      {state.success && state.txHash && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-500 rounded-lg text-green-300 mb-4">
          Swap successful! 
          <a 
            href={`https://${chainId === 1 ? 'etherscan.io' : chainId === 8453 ? 'basescan.org' : 'polygonscan.com'}/tx/${state.txHash}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block underline mt-1"
          >
            View transaction
          </a>
        </div>
      )}
      
      <div className="space-y-4">
        {/* Token In */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm text-gray-400">From</label>
            {balance && tokenIn.address === '0x0000000000000000000000000000000000000000' && (
              <button
                onClick={handleMaxClick}
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                Balance: {parseFloat(balance).toFixed(6)}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-3">
            <select
              value={tokenIn.address}
              onChange={(e) => {
                const tokens: Token[] = [
                  { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Ether', decimals: 18 },
                  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
                  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
                  { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', decimals: 8 },
                  { address: '0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5', symbol: 'BTC1', name: 'BTC1 Token', decimals: 18 },
                ];
                const selectedToken = tokens.find(t => t.address === e.target.value as Address) || tokenIn;
                setTokenIn(selectedToken);
                
                // Reset balance if switching from ETH
                if (e.target.value !== '0x0000000000000000000000000000000000000000') {
                  setBalance('0');
                }
              }}
              className="bg-transparent text-white border-none focus:outline-none"
            >
              <option value={'0x0000000000000000000000000000000000000000'}>ETH</option>
              <option value="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913">USDC</option>
              <option value="0x4200000000000000000000000000000000000006">WETH</option>
              <option value="0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf">cbBTC</option>
              <option value="0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5">BTC1</option>
            </select>
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent text-white border-none focus:outline-none text-right"
            />
          </div>
        </div>
        
        {/* Quote Display */}
        {state.quoteLoading && (
          <div className="text-center py-2 text-gray-400">
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Calculating best route...
            </span>
          </div>
        )}
        
        {state.quote && !state.quoteLoading && (
          <div className="p-3 bg-gray-800 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">You receive:</span>
              <span className="text-white font-medium">{state.quote.amountOut} {tokenOut.symbol}</span>
            </div>
            <div className="mt-1 text-xs text-gray-400">
              Route: {state.quote.route?.routerType.toUpperCase()} • Est. gas: {Number(state.quote.route?.gasEstimate)/1e9} Gwei
            </div>
          </div>
        )}
        
        {/* Swap Direction */}
        <div className="flex justify-center">
          <div className="p-2 rounded-full bg-gray-800 border border-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="orange" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m17 14 3-3-3-3" />
              <path d="M7 20v-9H4.5M20.5 11H13V4" />
            </svg>
          </div>
        </div>
        
        {/* Token Out */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">To</label>
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-3">
            <select
              value={tokenOut.address}
              onChange={(e) => {
                const tokens: Token[] = [
                  { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Ether', decimals: 18 },
                  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
                  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
                  { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', decimals: 8 },
                  { address: '0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5', symbol: 'BTC1', name: 'BTC1USD', decimals: 8 },
                ];
                const selectedToken = tokens.find(t => t.address === e.target.value as Address) || tokenOut;
                setTokenOut(selectedToken);
              }}
              className="bg-transparent text-white border-none focus:outline-none"
            >
              <option value={'0x0000000000000000000000000000000000000000'}>ETH</option>
              <option value="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913">USDC</option>
              <option value="0x4200000000000000000000000000000000000006">WETH</option>
              <option value="0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf">cbBTC</option>
              <option value="0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5">BTC1</option>
            </select>
            <input
              type="text"
              value={state.quote ? state.quote.amountOut : '0.0'}
              readOnly
              placeholder="0.0"
              className="flex-1 bg-transparent text-gray-400 border-none focus:outline-none text-right"
            />
          </div>
        </div>
        
        {/* Recipient */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Recipient</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => {
              const value = e.target.value;
              // Basic validation for address format
              if (value === '' || /^0x[a-fA-F0-9]{40}$/.test(value)) {
                setRecipient(value as Address);
              }
            }}
            placeholder="Recipient address"
            className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-orange-500 focus:outline-none"
          />
        </div>
        
        {/* Slippage */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Slippage Tolerance</label>
          <div className="flex gap-2">
            {[0.1, 0.5, 1.0].map((value) => (
              <button
                key={value}
                onClick={() => setSlippageTolerance(value)}
                className={`flex-1 py-2 rounded-lg border ${
                  slippageTolerance === value
                    ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >
                {value}%
              </button>
            ))}
            <input
              type="number"
              value={slippageTolerance}
              onChange={(e) => setSlippageTolerance(parseFloat(e.target.value))}
              className="w-20 p-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-orange-500 focus:outline-none"
              step="0.1"
              min="0.1"
              max="5"
            />
          </div>
        </div>
        
        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={state.loading || !signer || !provider || !amountIn || !recipient || state.quoteLoading}
          className={`w-full py-4 px-4 rounded-lg font-medium ${
            state.loading || state.quoteLoading
              ? 'bg-gray-600 cursor-not-allowed' 
              : !signer || !provider 
                ? 'bg-gray-700 cursor-not-allowed' 
                : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
          } text-white transition-colors text-lg`}
        >
          {(state.loading || state.quoteLoading) ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {state.quoteLoading ? 'Calculating...' : 'Swapping...'}
            </span>
          ) : (
            'Swap'
          )}
        </button>
      </div>
    </div>
  );
}