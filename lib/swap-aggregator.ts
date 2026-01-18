import { ethers, Contract, JsonRpcProvider, BaseContract } from 'ethers';

// Chain-specific router addresses
const ROUTER_ADDRESSES: Record<number, { v2: string; v3: string }> = {
  1: { // Ethereum
    v2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
    v3: '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 Router
  },
  8453: { // Base
    v2: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', // BaseSwap Router
    v3: '0x2626664c2603336E57B271c5C0b26F421741e481', // Uniswap V3 Router on Base
  },
  137: { // Polygon
    v2: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap Router
    v3: '0x1f2FC4E73b36e7e2d2DE830BE91FAC5A99CC316e', // Uniswap V3 Router on Polygon
  },
};

// ABI for router contracts
const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)'
];

const UNISWAP_V3_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
  'function getAmountsOut(uint256 amountIn, bytes memory path) external view returns (uint256[] memory amounts)'
];

// ABI for ERC20 tokens
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function transfer(address to, uint256 value) returns (bool)'
];

export interface SwapRoute {
  routerType: 'v2' | 'v3';
  routerAddress: string;
  path: string[];
  fee?: number; // Only for V3
  amountIn: bigint;
  amountOut: bigint;
  gasEstimate: bigint;
  priceImpact: number;
}

// Interface for swap parameters
export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  recipient: string;
  slippageTolerance: number; // Percentage (e.g., 0.5 for 0.5%)
  deadlineMinutes?: number; // Minutes from now (default: 20)
  chainId: number;
}

/**
 * Krystal-style DEX aggregator swap flow
 * Executes swaps fully on-chain with user wallet signing
 */
export class SwapAggregator {
  private provider: JsonRpcProvider;

  constructor(provider: JsonRpcProvider) {
    this.provider = provider;
  }

  /**
   * Main swap execution function
   * Fetches routes, selects best, handles approvals, and executes swap
   */
  async executeSwap(
    signer: ethers.Signer, 
    params: SwapParams
  ): Promise<{ hash: string; route: SwapRoute }> {
    try {
      // Step 1: Validate inputs
      if (!this.isValidAddress(params.tokenIn) || !this.isValidAddress(params.tokenOut)) {
        throw new Error('Invalid token addresses');
      }

      if (params.amountIn <= 0n) {
        throw new Error('Amount must be greater than 0');
      }

      // Step 2: Get all possible routes
      const routes = await this.getAllRoutes(params);

      if (routes.length === 0) {
        throw new Error('No valid routes found for the swap');
      }

      // Step 3: Select the best route based on output amount and gas efficiency
      const bestRoute = this.selectBestRoute(routes);
      
      // Step 4: Handle ERC20 approval if needed
      if (params.tokenIn !== ethers.ZeroAddress) { // Not native ETH
        await this.handleApproval(signer, params.tokenIn, bestRoute.routerAddress, params.amountIn);
      }

      // Step 5: Execute the swap based on router type
      const hash = await this.executeSwapOnRouter(signer, params, bestRoute);

      return { hash, route: bestRoute };
    } catch (error: any) {
      console.error('Swap execution failed:', error);
      throw new Error(`Swap failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get all possible routes across V2 and V3
   */
  private async getAllRoutes(params: SwapParams): Promise<SwapRoute[]> {
    const routes: SwapRoute[] = [];
    
    // Try V2 routes (single hop for simplicity, but can be extended to multi-hop)
    try {
      const v2Route = await this.getV2Route(params);
      if (v2Route) routes.push(v2Route);
    } catch (error) {
      console.warn('V2 route failed:', error);
    }

    // Try V3 routes
    try {
      const v3Routes = await this.getV3Routes(params);
      routes.push(...v3Routes);
    } catch (error) {
      console.warn('V3 routes failed:', error);
    }

    return routes;
  }

  /**
   * Get route from Uniswap V2
   */
  private async getV2Route(params: SwapParams): Promise<SwapRoute | null> {
    const { v2: routerAddress } = ROUTER_ADDRESSES[params.chainId] || {};
    if (!routerAddress) {
      return null;
    }

    const router = new Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, this.provider);
    
    try {
      // Get output amount for the path
      const path = [params.tokenIn, params.tokenOut];
      const amounts = await router.getAmountsOut.staticCall(params.amountIn, path);
      const amountOut = amounts[amounts.length - 1];
      
      if (amountOut <= 0n) {
        return null;
      }

      // Estimate gas
      const gasEstimate = await this.estimateV2Gas(router, params, path, amountOut);
      
      // Calculate price impact
      const priceImpact = this.calculatePriceImpact(params.amountIn, amountOut, path);

      return {
        routerType: 'v2',
        routerAddress,
        path,
        amountIn: params.amountIn,
        amountOut,
        gasEstimate,
        priceImpact
      };
    } catch (error) {
      console.warn('V2 route calculation failed:', error);
      return null;
    }
  }

  /**
   * Get routes from Uniswap V3 (multiple fee tiers)
   */
  private async getV3Routes(params: SwapParams): Promise<SwapRoute[]> {
    const { v3: routerAddress } = ROUTER_ADDRESSES[params.chainId] || {};
    if (!routerAddress) {
      return [];
    }

    const router = new Contract(routerAddress, UNISWAP_V3_ROUTER_ABI, this.provider);
    const routes: SwapRoute[] = [];

    // Common fee tiers in Uniswap V3: 0.01%, 0.05%, 0.3%, 1%
    const feeTiers = [100, 500, 3000, 10000];

    for (const fee of feeTiers) {
      try {
        // Prepare calldata for exactInputSingle
        const quoteParams = {
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          fee,
          amountIn: params.amountIn,
          sqrtPriceLimitX96: 0 // No price limit
        };

        // We can't call quoteExactInputSingle directly without the actual router implementation
        // So we'll try to simulate the swap to get the output
        const path = this.encodeV3Path([params.tokenIn, params.tokenOut], [fee]);
        const amounts = await router.getAmountsOut.staticCall(params.amountIn, path);
        const amountOut = amounts[amounts.length - 1];

        if (amountOut > 0n) {
          const gasEstimate = await this.estimateV3Gas(router, params, path, amountOut);
          const priceImpact = this.calculatePriceImpact(params.amountIn, amountOut, [params.tokenIn, params.tokenOut]);

          routes.push({
            routerType: 'v3',
            routerAddress,
            path: [params.tokenIn, params.tokenOut],
            fee,
            amountIn: params.amountIn,
            amountOut,
            gasEstimate,
            priceImpact
          });
        }
      } catch (error) {
        console.warn(`V3 route calculation failed for fee tier ${fee}:`, error);
      }
    }

    return routes;
  }

  /**
   * Encode V3 path for multi-hop trades
   */
  private encodeV3Path(path: string[], fees: number[]): string {
    if (path.length !== fees.length + 1) {
      throw new Error('Path length should be fees length + 1');
    }

    let encoded = '0x';
    for (let i = 0; i < fees.length; i++) {
      // For each pool in the path: tokenIn + fee + tokenOut
      encoded += path[i].slice(2).padStart(40, '0'); // tokenIn (20 bytes)
      encoded += fees[i].toString(16).padStart(6, '0'); // fee (3 bytes)
    }
    encoded += path[path.length - 1].slice(2).padStart(40, '0'); // tokenOut (20 bytes)

    return encoded;
  }

  /**
   * Estimate gas for V2 swap
   */
  private async estimateV2Gas(
    router: Contract,
    params: SwapParams,
    path: string[],
    amountOut: bigint
  ): Promise<bigint> {
    try {
      const minAmountOut = this.calculateMinAmountOut(amountOut, params.slippageTolerance);
      const deadline = this.getDeadline(params.deadlineMinutes || 20);
      
      // Estimate gas for the swap transaction
      const gasEstimate = await router.swapExactTokensForTokens.estimateGas(
        params.amountIn,
        minAmountOut,
        path,
        params.recipient,
        deadline
      );

      return gasEstimate;
    } catch (error) {
      console.warn('V2 gas estimation failed, using default:', error);
      return 200000n; // Default gas estimate
    }
  }

  /**
   * Estimate gas for V3 swap
   */
  private async estimateV3Gas(
    router: Contract,
    params: SwapParams,
    path: string,
    amountOut: bigint
  ): Promise<bigint> {
    try {
      const minAmountOut = this.calculateMinAmountOut(amountOut, params.slippageTolerance);
      const deadline = this.getDeadline(params.deadlineMinutes || 20);
      
      // For exactInput, estimate gas
      const swapParams = {
        path,
        recipient: params.recipient,
        deadline,
        amountIn: params.amountIn,
        amountOutMinimum: minAmountOut
      };

      const gasEstimate = await router.exactInput.estimateGas(swapParams, {
        value: params.tokenIn === ethers.ZeroAddress ? params.amountIn : 0
      });

      return gasEstimate;
    } catch (error) {
      console.warn('V3 gas estimation failed, using default:', error);
      return 150000n; // Default gas estimate
    }
  }

  /**
   * Calculate minimum output amount considering slippage
   */
  private calculateMinAmountOut(amountOut: bigint, slippageTolerance: number): bigint {
    const slippageFactor = 10000n - BigInt(Math.round(slippageTolerance * 100));
    return (amountOut * slippageFactor) / 10000n;
  }

  /**
   * Get deadline timestamp
   */
  private getDeadline(minutes: number): number {
    return Math.floor(Date.now() / 1000) + (minutes * 60);
  }

  /**
   * Calculate price impact
   */
  private calculatePriceImpact(amountIn: bigint, amountOut: bigint, path: string[]): number {
    // Simplified price impact calculation
    // In a real implementation, you'd compare against a reference price
    return 0; // Placeholder - implement based on your pricing logic
  }

  /**
   * Select the best route based on output amount and gas efficiency
   */
  private selectBestRoute(routes: SwapRoute[]): SwapRoute {
    // Sort by amountOut descending (highest output first)
    // If outputs are similar, prioritize lower gas cost
    return routes.sort((a, b) => {
      // Compare outputs first
      if (b.amountOut !== a.amountOut) {
        return Number(b.amountOut - a.amountOut);
      }
      // If outputs are equal, prefer lower gas
      return Number(a.gasEstimate - b.gasEstimate);
    })[0];
  }

  /**
   * Handle ERC20 approval if needed
   */
  private async handleApproval(
    signer: ethers.Signer,
    tokenAddress: string,
    spender: string,
    amount: bigint
  ): Promise<void> {
    // Create a new contract instance with the provider to read allowance
    const tokenContractRead = new Contract(tokenAddress, ERC20_ABI, this.provider);
    const ownerAddress = await signer.getAddress();

    // Check current allowance
    const currentAllowance = await tokenContractRead.allowance(ownerAddress, spender);

    // If allowance is already sufficient, return
    if (currentAllowance >= amount) {
      return;
    }

    // Create a new contract instance connected to the signer for approval
    const tokenContractWrite = new Contract(tokenAddress, ERC20_ABI, signer);
    const approveTx = await tokenContractWrite.approve(spender, amount);
    await approveTx.wait();
  }

  /**
   * Execute swap on the selected router
   */
  private async executeSwapOnRouter(
    signer: ethers.Signer,
    params: SwapParams,
    route: SwapRoute
  ): Promise<string> {
    if (route.routerType === 'v2') {
      return await this.executeV2Swap(signer, params, route);
    } else {
      return await this.executeV3Swap(signer, params, route);
    }
  }

  /**
   * Execute V2 swap
   */
  private async executeV2Swap(
    signer: ethers.Signer,
    params: SwapParams,
    route: SwapRoute
  ): Promise<string> {
    const router = new Contract(route.routerAddress, UNISWAP_V2_ROUTER_ABI, signer);
    
    const minAmountOut = this.calculateMinAmountOut(route.amountOut, params.slippageTolerance);
    const deadline = this.getDeadline(params.deadlineMinutes || 20);

    if (params.tokenIn === ethers.ZeroAddress) {
      // Swapping ETH for tokens
      const tx = await router.swapExactETHForTokens(
        minAmountOut,
        route.path,
        params.recipient,
        deadline,
        { value: params.amountIn }
      );
      return tx.hash;
    } else if (params.tokenOut === ethers.ZeroAddress) {
      // Swapping tokens for ETH
      const tx = await router.swapExactTokensForETH(
        params.amountIn,
        minAmountOut,
        route.path,
        params.recipient,
        deadline
      );
      return tx.hash;
    } else {
      // Swapping tokens for tokens
      const tx = await router.swapExactTokensForTokens(
        params.amountIn,
        minAmountOut,
        route.path,
        params.recipient,
        deadline
      );
      return tx.hash;
    }
  }

  /**
   * Execute V3 swap
   */
  private async executeV3Swap(
    signer: ethers.Signer,
    params: SwapParams,
    route: SwapRoute
  ): Promise<string> {
    const router = new Contract(route.routerAddress, UNISWAP_V3_ROUTER_ABI, signer);
    
    const minAmountOut = this.calculateMinAmountOut(route.amountOut, params.slippageTolerance);
    const deadline = this.getDeadline(params.deadlineMinutes || 20);

    if (route.path.length === 2 && route.fee !== undefined) {
      // Single hop trade
      const swapParams = {
        tokenIn: route.path[0],
        tokenOut: route.path[1],
        fee: route.fee,
        recipient: params.recipient,
        deadline,
        amountIn: params.amountIn,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0 // No price limit
      };

      const tx = await router.exactInputSingle(swapParams, {
        value: params.tokenIn === ethers.ZeroAddress ? params.amountIn : 0
      });
      
      return tx.hash;
    } else {
      // Multi-hop trade
      const path = this.encodeV3Path(route.path, [route.fee || 3000]); // Use default fee if not specified
      const swapParams = {
        path,
        recipient: params.recipient,
        deadline,
        amountIn: params.amountIn,
        amountOutMinimum: minAmountOut
      };

      const tx = await router.exactInput(swapParams, {
        value: params.tokenIn === ethers.ZeroAddress ? params.amountIn : 0
      });
      
      return tx.hash;
    }
  }

  /**
   * Validate address format
   */
  private isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }
}