'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { executeBaseSwap, isWalletOnBaseMainnet } from '../lib/swap-aggregator';
import { useAccount, useWalletClient } from 'wagmi';
import { toast } from 'sonner';

interface Token {
  symbol: string;
  address: string;
  name: string;
  decimals: number;
}

const BaseSwapComponent = () => {
  const [sellToken, setSellToken] = useState<Token>({ symbol: 'ETH', address: ethers.ZeroAddress, name: 'Ether', decimals: 18 });
  const [buyToken, setBuyToken] = useState<Token>({ symbol: 'BTC1USD', address: '', name: 'BTC1USD', decimals: 8 });
  const [sellAmount, setSellAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5); // 0.5%
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [balance, setBalance] = useState<string>('0');
  
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Common Base tokens
  const baseTokens: Token[] = [
    { symbol: 'ETH', address: ethers.ZeroAddress, name: 'Ether', decimals: 18 },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', name: 'USD Coin', decimals: 6 },
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', name: 'Wrapped Ether', decimals: 18 },
    { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', name: 'Dai Stablecoin', decimals: 18 },
    // Add more tokens as needed
  ];

  useEffect(() => {
    if (address && sellToken) {
      fetchBalance();
    }
  }, [address, sellToken]);

  const fetchBalance = async () => {
    if (!walletClient || !address || !sellToken) return;

    try {
      let balance;
      if (sellToken.address === ethers.ZeroAddress) {
        // Native ETH balance
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
        balance = await provider.getBalance(address);
      } else {
        // ERC20 token balance - this requires a direct provider call
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
        const tokenContract = new ethers.Contract(
          sellToken.address,
          ['function balanceOf(address owner) view returns (uint256)'],
          provider
        );
        balance = await tokenContract.balanceOf(address);
      }
      
      setBalance(ethers.formatUnits(balance, sellToken.decimals));
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const handleGetQuote = async () => {
    if (!sellAmount || !address || !walletClient) return;

    setIsLoading(true);
    setTxHash(null);
    
    try {
      // Convert sell amount to smallest unit
      const sellAmountInSmallestUnit = ethers.parseUnits(sellAmount, sellToken.decimals).toString();
      
      // Build query parameters
      const params = new URLSearchParams({
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        sellAmount: sellAmountInSmallestUnit,
        takerAddress: address,
        slippagePercentage: slippage.toString(),
      });

      const response = await fetch(`https://base.api.0x.org/swap/v1/quote?${params}`);
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`0x API Error: ${response.status} - ${errorData}`);
      }

      const quoteData = await response.json();
      setQuote(quoteData);
      toast('Quote retrieved', {
        description: `Expected to receive: ${ethers.formatUnits(quoteData.buyAmount, buyToken.decimals)} ${buyToken.symbol}`
      });
    } catch (error: any) {
      console.error('Error getting quote:', error);
      toast.error('Error getting quote', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!sellAmount || !address || !walletClient) return;

    setIsLoading(true);
    setTxHash(null);

    try {
      // Check if wallet is on Base Mainnet - we'll verify through walletClient
      if (walletClient.chain.id !== 8453) {
        throw new Error('Wallet must be connected to Base Mainnet');
      }

      // Get the signer from the wallet client
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();

      // Execute the swap
      const txHash = await executeBaseSwap(
        sellToken.address,
        buyToken.address,
        parseFloat(sellAmount),
        slippage,
        signer
      );

      setTxHash(txHash);
      toast.success('Swap successful!', {
        description: `Transaction: ${txHash.substring(0, 6)}...${txHash.substring(txHash.length - 4)}`
      });
    } catch (error: any) {
      console.error('Swap failed:', error);
      toast.error('Swap failed', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Connect Wallet to Swap</h2>
        <p className="text-gray-600">Please connect your wallet to perform token swaps on Base Mainnet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Base Token Swap</h2>
      
      <div className="space-y-4">
        {/* Sell token selection */}
        <div>
          <label className="block text-sm font-medium mb-1">Sell</label>
          <div className="flex space-x-2">
            <select
              value={sellToken.address}
              onChange={(e) => {
                const token = baseTokens.find(t => t.address === e.target.value);
                if (token) setSellToken(token);
              }}
              className="flex-1 border rounded p-2"
            >
              {baseTokens.map(token => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 border rounded p-2"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Balance: {balance} {sellToken.symbol}</p>
        </div>

        {/* Buy token selection */}
        <div>
          <label className="block text-sm font-medium mb-1">Buy</label>
          <div className="flex space-x-2">
            <select
              value={buyToken.address}
              onChange={(e) => {
                const token = baseTokens.find(t => t.address === e.target.value);
                if (token) setBuyToken(token);
              }}
              className="flex-1 border rounded p-2"
            >
              {baseTokens.filter(t => t.address !== sellToken.address).map(token => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
            {quote && (
              <p className="flex-1 border rounded p-2 bg-gray-50 text-right">
                ~{ethers.formatUnits(quote.buyAmount, buyToken.decimals)}
              </p>
            )}
          </div>
        </div>

        {/* Slippage setting */}
        <div>
          <label className="block text-sm font-medium mb-1">Slippage Tolerance (%)</label>
          <input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value))}
            min="0.1"
            max="5"
            step="0.1"
            className="w-full border rounded p-2"
          />
        </div>

        {/* Quote and action buttons */}
        <div className="space-y-2">
          {!quote ? (
            <button
              onClick={handleGetQuote}
              disabled={isLoading || !sellAmount}
              className={`w-full py-2 px-4 rounded ${
                isLoading || !sellAmount
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isLoading ? 'Getting Quote...' : 'Get Quote'}
            </button>
          ) : (
            <>
              <button
                onClick={handleSwap}
                disabled={isLoading}
                className={`w-full py-2 px-4 rounded ${
                  isLoading
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isLoading ? 'Swapping...' : 'Confirm Swap'}
              </button>
              <button
                onClick={() => setQuote(null)}
                className="w-full py-2 px-4 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Modify Swap
              </button>
            </>
          )}
        </div>

        {/* Transaction status */}
        {txHash && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-700 font-medium">Swap Successful!</p>
            <a 
              href={`https://basescan.org/tx/${txHash}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline break-all text-sm"
            >
              View on BaseScan: {txHash.substring(0, 6)}...{txHash.substring(txHash.length - 4)}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseSwapComponent;