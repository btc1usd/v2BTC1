import { useState, useCallback } from 'react';
import { ethers, Signer } from 'ethers';
import { SwapAggregator, SwapParams } from '../lib/swap-aggregator';

interface SwapState {
  loading: boolean;
  error: string | null;
  success: boolean;
  txHash: string | null;
  route: any | null;
}

export const useSwapAggregator = (provider: any) => {
  const [state, setState] = useState<SwapState>({
    loading: false,
    error: null,
    success: false,
    txHash: null,
    route: null,
  });

  const aggregator = provider ? new SwapAggregator(provider) : null;

  const executeSwap = useCallback(async (
    signer: Signer,
    params: SwapParams
  ) => {
    if (!aggregator) {
      throw new Error('Provider not available');
    }

    try {
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
        success: false,
        txHash: null,
        route: null,
      }));

      const result = await aggregator.executeSwap(signer, params);

      setState({
        loading: false,
        error: null,
        success: true,
        txHash: result.hash,
        route: result.route,
      });

      // Reset success state after 5 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, success: false }));
      }, 5000);

      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Swap failed';
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        success: false,
      }));

      throw error;
    }
  }, [aggregator]);

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      success: false,
      txHash: null,
      route: null,
    });
  }, []);

  return {
    ...state,
    executeSwap,
    reset,
  };
};