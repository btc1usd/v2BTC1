"use client";

import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACT_ADDRESSES, ABIS } from '@/lib/contracts';

export interface LandingStats {
  totalSupply: number;
  btcReserves: number;
  collateralRatio: number;
  rewardPeriod: number;
  totalHolders: number;
  loading: boolean;
  error: string | null;
}

export function useLandingStats(): LandingStats {
  const [totalHolders, setTotalHolders] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Debug logging for contract addresses
  useEffect(() => {
    console.log('Contract Addresses:');
    console.log('BTC1USD:', CONTRACT_ADDRESSES.BTC1USD);
    console.log('VAULT:', CONTRACT_ADDRESSES.VAULT);
  }, []);

  // Fetch BTC1USD total supply
  const { data: totalSupplyData, isLoading: isTotalSupplyLoading, isError: isTotalSupplyError, error: totalSupplyError } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: [
      {
        inputs: [],
        name: "totalSupply",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: 'totalSupply',
    query: {
      enabled: !!CONTRACT_ADDRESSES.BTC1USD,
    },
  });

  // Fetch total collateral value from Vault
  const { data: btcReservesData, isLoading: isBtcReservesLoading, isError: isBtcReservesError, error: btcReservesError } = useReadContract({
    address: CONTRACT_ADDRESSES.VAULT as `0x${string}`,
    abi: [{
      inputs: [],
      name: "getTotalCollateralValue",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    }],
    functionName: 'getTotalCollateralValue',
    query: {
      enabled: !!CONTRACT_ADDRESSES.VAULT,
    },
  });

  // Fetch current collateral ratio - using correct function name
  const { data: collateralRatioData, isLoading: isCollateralRatioLoading, isError: isCollateralRatioError, error: collateralRatioError } = useReadContract({
    address: CONTRACT_ADDRESSES.VAULT as `0x${string}`,
    abi: [{
      inputs: [],
      name: "getCurrentCollateralRatio",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    }],
    functionName: 'getCurrentCollateralRatio',
    query: {
      enabled: !!CONTRACT_ADDRESSES.VAULT,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  });

  // Fetch holder count from API
  useEffect(() => {
    const fetchHolderCount = async () => {
      try {
        const response = await fetch('/api/holders-count');
        if (response.ok) {
          const data = await response.json();
          setTotalHolders(data.count || 0);
        }
      } catch (err) {
        console.error('Failed to fetch holder count:', err);
      }
    };

    fetchHolderCount();
    const interval = setInterval(fetchHolderCount, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Process the data only when not loading
  const isLoading = isTotalSupplyLoading || isBtcReservesLoading || isCollateralRatioLoading;
  
  const totalSupply = !isLoading && totalSupplyData ? 
    parseFloat(formatUnits(totalSupplyData as bigint, 8)) : 0;
    
  const btcReserves = !isLoading && btcReservesData ? 
    parseFloat(formatUnits(btcReservesData as bigint, 8)) : 0;
    
  const collateralRatio = !isLoading && collateralRatioData ? 
    parseFloat(formatUnits(collateralRatioData as bigint, 8)) : 0;

  // Debug logging
  useEffect(() => {
    console.log('=== Landing Stats Debug ===');
    console.log('Loading state:', isLoading);
    console.log('Total supply data:', totalSupplyData);
    console.log('BTC reserves data:', btcReservesData);
    console.log('Collateral ratio data:', collateralRatioData);
    console.log('Total supply formatted:', totalSupply);
    console.log('BTC reserves formatted:', btcReserves);
    console.log('Collateral ratio formatted:', collateralRatio);
    console.log('==========================');
    
    if (isTotalSupplyError) {
      console.error('Total supply error:', totalSupplyError);
      setError(totalSupplyError?.message || 'Failed to fetch total supply');
    }
    
    if (isBtcReservesError) {
      console.error('BTC reserves error:', btcReservesError);
      setError(prev => prev ? `${prev}; BTC reserves error: ${btcReservesError?.message}` : `BTC reserves error: ${btcReservesError?.message}`);
    }
    
    if (isCollateralRatioError) {
      console.error('Collateral ratio error:', collateralRatioError);
      setError(prev => prev ? `${prev}; Collateral ratio error: ${collateralRatioError?.message}` : `Collateral ratio error: ${collateralRatioError?.message}`);
    }
  }, [isLoading, totalSupplyData, btcReservesData, collateralRatioData, totalSupply, btcReserves, collateralRatio, isTotalSupplyError, totalSupplyError, isBtcReservesError, btcReservesError, isCollateralRatioError, collateralRatioError]);

  return {
    totalSupply,
    btcReserves,
    collateralRatio,
    rewardPeriod: 7, // Fixed value as per requirements
    totalHolders,
    loading: isLoading,
    error,
  };
}