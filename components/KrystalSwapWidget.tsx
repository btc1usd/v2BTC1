'use client';

import { useState, useEffect } from 'react';
import { ethers, BrowserProvider } from 'ethers';
import { useSwapAggregator } from '@/hooks/use-swap-aggregator';
import { SwapParams } from '@/lib/swap-aggregator';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface Props {
  provider: BrowserProvider | null;
  signer: ethers.Signer | null;
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
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  });
  
  const [amountIn, setAmountIn] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  
  const {
    loading,
    error,
    success,
    txHash,
    executeSwap,
    reset
  } = useSwapAggregator(provider);

  // Auto-set recipient from signer
  useEffect(() => {
    const getSignerAddress = async () => {
      if (signer) {
        try {
          const address = await signer.getAddress();
          setRecipient(address);
        } catch (err) {
          console.error('Error getting signer address:', err);
        }
      }
    };
    
    getSignerAddress();
  }, [signer]);

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

    try {
      const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
      
      const params: SwapParams = {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: amountInWei,
        recipient,
        slippageTolerance: 0.5, // 0.5%
        deadlineMinutes: 20,
        chainId,
      };

      await executeSwap(signer, params);
    } catch (err: any) {
      console.error('Swap failed:', err);
      alert(`Swap failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-gray-900 rounded-xl border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-6">Swap Tokens</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-300">
          {error}
        </div>
      )}
      
      {success && txHash && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-500 rounded-lg text-green-300">
          Swap successful! 
          <a 
            href={`https://basescan.org/tx/${txHash}`} 
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
          <label className="block text-sm text-gray-400 mb-1">From</label>
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-3">
            <select
              value={tokenIn.address}
              onChange={(e) => {
                // In a real app, you'd have a list of supported tokens
                const tokens: Token[] = [
                  { address: ethers.ZeroAddress, symbol: 'ETH', name: 'Ether', decimals: 18 },
                  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
                  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
                ];
                const selectedToken = tokens.find(t => t.address === e.target.value) || tokenIn;
                setTokenIn(selectedToken);
              }}
              className="bg-transparent text-white border-none focus:outline-none"
            >
              <option value={ethers.ZeroAddress}>ETH</option>
              <option value="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913">USDC</option>
              <option value="0x4200000000000000000000000000000000000006">WETH</option>
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
                ];
                const selectedToken = tokens.find(t => t.address === e.target.value) || tokenOut;
                setTokenOut(selectedToken);
              }}
              className="bg-transparent text-white border-none focus:outline-none"
            >
              <option value={ethers.ZeroAddress}>ETH</option>
              <option value="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913">USDC</option>
              <option value="0x4200000000000000000000000000000000000006">WETH</option>
            </select>
            <input
              type="text"
              value="0.0" // Would be calculated from the swap route
              readOnly
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
        
        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={loading || !signer || !provider || !amountIn || !recipient}
          className={`w-full py-3 px-4 rounded-lg font-medium ${
            loading 
              ? 'bg-gray-600 cursor-not-allowed' 
              : !signer || !provider 
                ? 'bg-gray-700 cursor-not-allowed' 
                : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
          } text-white transition-colors`}
        >
          {loading ? (
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