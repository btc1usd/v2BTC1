import { ethers } from 'ethers';
import { getTokenDecimals } from './utils'; // Import the utility function

interface SwapQuoteRequest {
  sellToken: string;
  buyToken: string;
  sellAmount: string; // Amount in smallest unit (wei/satoshi)
  takerAddress: string;
  slippagePercentage?: number;
}

interface SwapQuoteResponse {
  to: string;
  data: string;
  value: string;
  gas: string;
  price: string;
  estimatedGas: string;
  sellAmount: string;
  buyAmount: string;
  allowanceTarget: string;
}

interface TokenAllowanceCheck {
  tokenAddress: string;
  owner: string;
  spender: string;
  amount: string;
}

/**
 * SwapAggregator - Handles token swaps on Base Mainnet using 0x API
 * Implements a Krystal-style non-custodial swap flow
 */
export class SwapAggregator {
  private static readonly BASE_API_URL = 'https://base.api.0x.org/swap/v1/quote';
  public static readonly BASE_CHAIN_ID = BigInt(8453);
  
  /**
   * Execute a token swap on Base Mainnet
   * @param request Swap parameters
   * @param signer Ethers.js signer from connected wallet
   * @returns Transaction hash
   */
  static async executeSwap(
    request: SwapQuoteRequest,
    signer: ethers.Signer
  ): Promise<string> {
    try {
      // Verify wallet is connected to Base Mainnet
      const network = await signer.provider?.getNetwork();
      if (!network || network.chainId !== this.BASE_CHAIN_ID) {
        throw new Error(`Wallet must be connected to Base Mainnet (chainId: ${this.BASE_CHAIN_ID})`);
      }

      // Validate token addresses are valid on Base
      this.validateTokenAddresses(request.sellToken, request.buyToken);

      // Check user balance
      await this.checkUserBalance(signer, request.sellToken, request.sellAmount);

      // Get initial swap quote
      const quote = await this.getSwapQuote({
        ...request,
        slippagePercentage: request.slippagePercentage || 0.005 // Default 0.5% slippage
      });

      // Handle allowance if required (for ERC20 tokens)
      if (request.sellToken.toLowerCase() !== ethers.ZeroAddress.toLowerCase()) {
        await this.handleTokenAllowance(signer, request.sellToken, quote.allowanceTarget, request.sellAmount);
      }

      // Prepare transaction
      const transaction = {
        to: quote.to,
        data: quote.data,
        value: request.sellToken.toLowerCase() === ethers.ZeroAddress.toLowerCase() ? request.sellAmount : '0',
        gasLimit: BigInt(quote.gas),
      };

      // Sign and send transaction
      const txResponse = await signer.sendTransaction(transaction);
      
      // Wait for transaction confirmation
      const receipt = await txResponse.wait();
      
      if (receipt?.status === 1) {
        return txResponse.hash;
      } else {
        throw new Error('Transaction reverted on chain');
      }
    } catch (error: any) {
      console.error('Swap execution failed:', error);
      throw error;
    }
  }

  /**
   * Get swap quote from 0x API
   */
  private static async getSwapQuote(request: SwapQuoteRequest): Promise<SwapQuoteResponse> {
    try {
      const params = new URLSearchParams({
        sellToken: request.sellToken,
        buyToken: request.buyToken,
        sellAmount: request.sellAmount,
        takerAddress: request.takerAddress,
        slippagePercentage: request.slippagePercentage?.toString() || '0.005',
        // Add deadline parameter (30 minutes from now)
        excludedSources: 'UniswapV2,UniswapV3,SushiSwap', // Optional: exclude certain sources
      });

      const response = await fetch(`${this.BASE_API_URL}?${params}`);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`0x API Error: ${response.status} - ${errorData}`);
      }

      const quote: SwapQuoteResponse = await response.json();
      return quote;
    } catch (error) {
      console.error('Failed to get swap quote:', error);
      throw error;
    }
  }

  /**
   * Check if user has sufficient balance for the swap
   */
  private static async checkUserBalance(
    signer: ethers.Signer,
    tokenAddress: string,
    sellAmount: string
  ): Promise<void> {
    let balance: bigint;

    if (tokenAddress.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
      // Native ETH balance
      balance = await signer.provider!.getBalance(await signer.getAddress());
    } else {
      // ERC20 token balance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address owner) view returns (uint256)'],
        signer
      );
      balance = await tokenContract.balanceOf(await signer.getAddress());
    }

    if (balance < BigInt(sellAmount)) {
      throw new Error(`Insufficient balance. Have: ${balance.toString()}, Need: ${sellAmount}`);
    }
  }

  /**
   * Handle token allowance for ERC20 tokens
   */
  private static async handleTokenAllowance(
    signer: ethers.Signer,
    tokenAddress: string,
    spender: string,
    amount: string
  ): Promise<void> {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)'
      ],
      signer
    );

    const currentAllowance = await tokenContract.allowance(
      await signer.getAddress(),
      spender
    );

    // If allowance is less than the required amount, approve the spender
    if (currentAllowance < BigInt(amount)) {
      console.log(`Current allowance: ${currentAllowance.toString()}, Required: ${amount}`);
      
      // First approve the token for the spender
      const approveTx = await tokenContract.approve(spender, amount);
      await approveTx.wait();
      
      console.log(`Approval successful: ${approveTx.hash}`);
    }
  }

  /**
   * Validate token addresses are valid on Base
   */
  private static validateTokenAddresses(sellToken: string, buyToken: string): void {
    // Validate sell token address
    try {
      ethers.getAddress(sellToken);
    } catch (error) {
      throw new Error(`Invalid sell token address: ${sellToken}`);
    }

    // Validate buy token address
    try {
      ethers.getAddress(buyToken);
    } catch (error) {
      throw new Error(`Invalid buy token address: ${buyToken}`);
    }

    // Check for zero address inappropriately used as ERC20
    if (
      (sellToken.toLowerCase() === ethers.ZeroAddress.toLowerCase() && buyToken.toLowerCase() === ethers.ZeroAddress.toLowerCase())
    ) {
      throw new Error('Cannot swap ETH to ETH');
    }
  }

  /**
   * Get token decimals from contract
   */
  static async getTokenDecimals(tokenAddress: string, provider: ethers.Provider): Promise<number> {
    if (tokenAddress.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
      return 18; // ETH has 18 decimals
    }

    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function decimals() view returns (uint8)'],
      provider
    );

    const decimals = await tokenContract.decimals();
    return Number(decimals);
  }

  /**
   * Format amount to smallest unit (wei/satoshi)
   */
  static formatAmountToSmallestUnit(amount: number, decimals: number): string {
    return ethers.parseUnits(amount.toString(), decimals).toString();
  }

  /**
   * Parse amount from smallest unit (wei/satoshi) to human readable
   */
  static parseAmountFromSmallestUnit(amount: string, decimals: number): number {
    return Number(ethers.formatUnits(amount, decimals));
  }
}

/**
 * Utility function to execute a swap with simplified parameters
 */
export const executeBaseSwap = async (
  sellToken: string, // Token address or 'ETH' for native ETH
  buyToken: string,  // Token address or 'ETH' for native ETH
  sellAmount: number, // Human-readable amount
  slippagePercentage: number = 0.5, // 0.5% by default
  signer: ethers.Signer
): Promise<string> => {
  // Convert 'ETH' to ZeroAddress if needed
  const actualSellToken = sellToken.toUpperCase() === 'ETH' ? ethers.ZeroAddress : sellToken;
  const actualBuyToken = buyToken.toUpperCase() === 'ETH' ? ethers.ZeroAddress : buyToken;

  // Get token decimals
  const provider = signer.provider!;
  const sellTokenDecimals = await SwapAggregator.getTokenDecimals(actualSellToken, provider);
  
  // Format amount to smallest unit
  const sellAmountInSmallestUnit = SwapAggregator.formatAmountToSmallestUnit(sellAmount, sellTokenDecimals);

  // Get user's address
  const userAddress = await signer.getAddress();

  // Prepare swap request
  const swapRequest: SwapQuoteRequest = {
    sellToken: actualSellToken,
    buyToken: actualBuyToken,
    sellAmount: sellAmountInSmallestUnit,
    takerAddress: userAddress,
    slippagePercentage: slippagePercentage / 100,
  };

  // Execute the swap
  return await SwapAggregator.executeSwap(swapRequest, signer);
};

/**
 * Check if wallet is connected to Base Mainnet
 */
export const isWalletOnBaseMainnet = async (signer: ethers.Signer): Promise<boolean> => {
  try {
    const network = await signer.provider?.getNetwork();
    return network?.chainId === SwapAggregator.BASE_CHAIN_ID;
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
};