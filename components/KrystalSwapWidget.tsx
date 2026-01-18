'use client';

import { useState, useEffect } from 'react';
import { ethers, BrowserProvider, JsonRpcSigner } from 'ethers';
import { SwapAggregator, SwapParams } from '@/lib/swap-aggregator';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface SwapState {
  loading: boolean;
  error: string | null;
  success: boolean;
  txHash: string | null;
  route: any | null;
}

interface Props {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  chainId: number;
}

export default function KrystalSwapWidget({ provider, signer, chainId }: Props) {
  const [tokenIn, setTokenIn] = useState<Token>({
    address: ethers.ZeroAddress, // ETH
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
  });
  
  const [tokenOut, setTokenOut] = useState<Token>({
    address: '0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5', // BTC1
    symbol: 'BTC1',
    name: 'BTC1 Token',
    decimals: 18,
  });
  
  const [amountIn, setAmountIn] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [toAmount, setToAmount] = useState<string>('0');
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5); // 0.5%
  
  const [state, setState] = useState<SwapState>({
    loading: false,
    error: null,
    success: false,
    txHash: null,
    route: null,
  });

  // Auto-set recipient from signer
  useEffect(() => {
    const getSignerAddress = async () => {
      if (signer) {
        try {
          const address = await signer.getAddress();
          setRecipient(address);
          
          // Get ETH balance
          const ethBalance = await provider?.getBalance(address);
          if (ethBalance) {
            setBalance(ethers.formatEther(ethBalance));
          }
        } catch (err) {
          console.error('Error getting signer info:', err);
        }
      }
    };
    
    getSignerAddress();
  }, [signer, provider]);

  const handleSwap = async () => {
    if (!signer || !provider) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (!amountIn || parseFloat(amountIn) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    if (!recipient) {
      alert('Please enter a recipient address');
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

      // Initialize the swap aggregator
      const aggregator = new SwapAggregator(provider);
      
      // Execute the swap
      const result = await aggregator.executeSwap(signer, params);

      setState({
        loading: false,
        error: null,
        success: true,
        txHash: result.hash,
        route: result.route,
      });

      // Reset form
      setAmountIn('');
      setToAmount('0');

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
    if (tokenIn.address === ethers.ZeroAddress && balance) {
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
            href={`https://basescan.org/tx/${state.txHash}`} 
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
            {balance && tokenIn.address === ethers.ZeroAddress && (
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
                  { address: ethers.ZeroAddress, symbol: 'ETH', name: 'Ether', decimals: 18 },
                  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
                  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
                  { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', decimals: 8 },
                  { address: '0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5', symbol: 'BTC1', name: 'BTC1 Token', decimals: 18 },
                ];
                const selectedToken = tokens.find(t => t.address === e.target.value) || tokenIn;
                setTokenIn(selectedToken);
                
                // Reset balance if switching from ETH
                if (e.target.value !== ethers.ZeroAddress) {
                  setBalance('0');
                }
              }}
              className="bg-transparent text-white border-none focus:outline-none"
            >
              <option value={ethers.ZeroAddress}>ETH</option>
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
                  { address: ethers.ZeroAddress, symbol: 'ETH', name: 'Ether', decimals: 18 },
                  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
                  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
                  { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', decimals: 8 },
                  { address: '0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5', symbol: 'BTC1', name: 'BTC1 Token', decimals: 18 },
                ];
                const selectedToken = tokens.find(t => t.address === e.target.value) || tokenOut;
                setTokenOut(selectedToken);
              }}
              className="bg-transparent text-white border-none focus:outline-none"
            >
              <option value={ethers.ZeroAddress}>ETH</option>
              <option value="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913">USDC</option>
              <option value="0x4200000000000000000000000000000000000006">WETH</option>
              <option value="0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf">cbBTC</option>
              <option value="0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5">BTC1</option>
            </select>
            <input
              type="text"
              value={toAmount}
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
            onChange={(e) => setRecipient(e.target.value)}
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
          disabled={state.loading || !signer || !provider || !amountIn || !recipient}
          className={`w-full py-4 px-4 rounded-lg font-medium ${
            state.loading 
              ? 'bg-gray-600 cursor-not-allowed' 
              : !signer || !provider 
                ? 'bg-gray-700 cursor-not-allowed' 
                : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
          } text-white transition-colors text-lg`}
        >
          {state.loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Swapping...
            </span>
          ) : (
            'Swap'
          )}
        </button>
      </div>
    </div>
  );
}