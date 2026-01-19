import { ethers } from 'ethers';

/**
 * 1inch Aggregator for Base Mainnet
 * 
 * Complete implementation of non-custodial swap flow using 1inch v5.2 API
 * Network: Base Mainnet (chainId 8453)
 * 
 * Flow:
 * 1. Get quote
 * 2. Check allowance
 * 3. Approve if needed
 * 4. Execute swap
 */

// Base Mainnet Configuration
export const BASE_CHAIN_ID = 8453;
// Use Next.js API proxy to avoid CORS issues
const ONEINCH_PROXY_BASE = '/api/oneinch-proxy';

// Native ETH address for Base (used by 1inch)
const NATIVE_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

interface OneInchQuoteParams {
  src: string;           // Source token address
  dst: string;           // Destination token address
  amount: string;        // Amount in smallest unit (wei)
  from: string;          // User address
  slippage: number;      // Slippage tolerance (e.g., 1 for 1%)
}

interface OneInchQuoteResponse {
  toAmount: string;
  protocols: any[];
  estimatedGas: string;
}

interface OneInchSwapParams extends OneInchQuoteParams {
  receiver?: string;     // Optional receiver address (defaults to from)
  disableEstimate?: boolean;
  allowPartialFill?: boolean;
}

interface OneInchSwapResponse {
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
  toAmount: string;
  protocols: any[];
}

interface OneInchAllowanceResponse {
  allowance: string;
}

interface OneInchApprovalResponse {
  data: string;
  gasPrice: string;
  to: string;
  value: string;
}

/**
 * Verify wallet is connected to Base Mainnet
 */
export async function verifyBaseNetwork(signer: ethers.Signer): Promise<void> {
  const network = await signer.provider?.getNetwork();
  
  if (!network || network.chainId !== BigInt(BASE_CHAIN_ID)) {
    throw new Error(`Please connect to Base Mainnet (chainId ${BASE_CHAIN_ID})`);
  }
}

/**
 * Get quote from 1inch for a swap
 */
export async function getOneInchQuote(params: OneInchQuoteParams): Promise<OneInchQuoteResponse> {
  const queryParams = new URLSearchParams({
    endpoint: 'quote',
    src: params.src,
    dst: params.dst,
    amount: params.amount,
    from: params.from,
    slippage: params.slippage.toString(),
  });

  const url = `${ONEINCH_PROXY_BASE}?${queryParams}`;
  
  console.log('Fetching 1inch quote via proxy:', url);

  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('1inch quote error:', errorData);
    throw new Error(errorData.error || `Failed to get quote: ${response.statusText}`);
  }

  const quote = await response.json();
  return quote;
}

/**
 * Check ERC20 token allowance for 1inch router
 */
export async function checkOneInchAllowance(
  tokenAddress: string,
  walletAddress: string
): Promise<bigint> {
  // Native ETH doesn't need allowance
  if (tokenAddress.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
    return BigInt(ethers.MaxUint256);
  }

  const queryParams = new URLSearchParams({
    endpoint: 'approve/allowance',
    tokenAddress,
    walletAddress,
  });

  const url = `${ONEINCH_PROXY_BASE}?${queryParams}`;
  
  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to check allowance');
  }

  const data: OneInchAllowanceResponse = await response.json();
  return BigInt(data.allowance);
}

/**
 * Get approval transaction data from 1inch
 */
export async function getOneInchApprovalTx(
  tokenAddress: string,
  amount?: string
): Promise<OneInchApprovalResponse> {
  const queryParams = new URLSearchParams({
    endpoint: 'approve/transaction',
    tokenAddress,
  });

  if (amount) {
    queryParams.append('amount', amount);
  }

  const url = `${ONEINCH_PROXY_BASE}?${queryParams}`;
  
  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to get approval transaction');
  }

  return await response.json();
}

/**
 * Execute ERC20 approval for 1inch router
 */
export async function approveOneInchRouter(
  signer: ethers.Signer,
  tokenAddress: string,
  amount: string
): Promise<string> {
  console.log(`Approving 1inch router for token ${tokenAddress}, amount ${amount}`);

  // Get approval transaction from 1inch
  const approvalTx = await getOneInchApprovalTx(tokenAddress, amount);

  // Send approval transaction
  const tx = await signer.sendTransaction({
    to: approvalTx.to,
    data: approvalTx.data,
    value: BigInt(approvalTx.value),
    gasPrice: BigInt(approvalTx.gasPrice),
  });

  console.log('Approval transaction sent:', tx.hash);

  // Wait for confirmation
  const receipt = await tx.wait();
  
  if (receipt?.status !== 1) {
    throw new Error('Approval transaction failed');
  }

  console.log('Approval confirmed:', tx.hash);
  return tx.hash;
}

/**
 * Get swap transaction from 1inch
 */
export async function getOneInchSwapTx(params: OneInchSwapParams): Promise<OneInchSwapResponse> {
  const queryParams = new URLSearchParams({
    endpoint: 'swap',
    src: params.src,
    dst: params.dst,
    amount: params.amount,
    from: params.from,
    slippage: params.slippage.toString(),
  });

  if (params.receiver) {
    queryParams.append('receiver', params.receiver);
  }

  if (params.disableEstimate !== undefined) {
    queryParams.append('disableEstimate', params.disableEstimate.toString());
  }

  if (params.allowPartialFill !== undefined) {
    queryParams.append('allowPartialFill', params.allowPartialFill.toString());
  }

  const url = `${ONEINCH_PROXY_BASE}?${queryParams}`;
  
  console.log('Fetching 1inch swap transaction via proxy:', url);

  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('1inch swap error:', errorData);
    throw new Error(errorData.error || `Failed to get swap transaction: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Check if user has sufficient balance
 */
async function checkBalance(
  signer: ethers.Signer,
  tokenAddress: string,
  amount: string
): Promise<void> {
  const userAddress = await signer.getAddress();
  let balance: bigint;

  if (tokenAddress.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
    // Check ETH balance
    balance = await signer.provider!.getBalance(userAddress);
  } else {
    // Check ERC20 balance
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      signer
    );
    balance = await tokenContract.balanceOf(userAddress);
  }

  if (balance < BigInt(amount)) {
    throw new Error(`Insufficient balance. Have: ${balance.toString()}, Need: ${amount}`);
  }
}

/**
 * Execute complete swap flow on Base Mainnet
 * 
 * This function handles the entire swap process:
 * 1. Verify Base network
 * 2. Validate tokens and balance
 * 3. Get quote from 1inch
 * 4. Check and handle allowance
 * 5. Execute swap
 * 
 * @param signer - Ethers.js signer from connected wallet
 * @param srcToken - Source token address (use 0xEee...eEe for ETH)
 * @param dstToken - Destination token address
 * @param amount - Amount in smallest unit (wei)
 * @param slippage - Slippage tolerance in percentage (e.g., 1 for 1%)
 * @returns Transaction hash of the swap
 */
export async function executeOneInchSwap(
  signer: ethers.Signer,
  srcToken: string,
  dstToken: string,
  amount: string,
  slippage: number = 1
): Promise<string> {
  try {
    // Step 1: Verify we're on Base Mainnet
    await verifyBaseNetwork(signer);
    console.log('✓ Connected to Base Mainnet');

    // Step 2: Get user address
    const userAddress = await signer.getAddress();
    console.log('User address:', userAddress);

    // Step 3: Validate token addresses
    if (!ethers.isAddress(srcToken) || !ethers.isAddress(dstToken)) {
      throw new Error('Invalid token address');
    }

    // Step 4: Check balance
    await checkBalance(signer, srcToken, amount);
    console.log('✓ Sufficient balance');

    // Step 5: Get quote from 1inch
    const quote = await getOneInchQuote({
      src: srcToken,
      dst: dstToken,
      amount,
      from: userAddress,
      slippage,
    });
    console.log('✓ Quote received:', {
      toAmount: quote.toAmount,
      estimatedGas: quote.estimatedGas,
    });

    // Step 6: Check allowance for ERC20 tokens
    if (srcToken.toLowerCase() !== NATIVE_ETH_ADDRESS.toLowerCase()) {
      const currentAllowance = await checkOneInchAllowance(srcToken, userAddress);
      console.log('Current allowance:', currentAllowance.toString());

      if (currentAllowance < BigInt(amount)) {
        console.log('Insufficient allowance, requesting approval...');
        
        // Request approval
        await approveOneInchRouter(signer, srcToken, amount);
        console.log('✓ Approval confirmed');
      } else {
        console.log('✓ Sufficient allowance');
      }
    }

    // Step 7: Get swap transaction from 1inch
    const swapTx = await getOneInchSwapTx({
      src: srcToken,
      dst: dstToken,
      amount,
      from: userAddress,
      slippage,
      disableEstimate: false,
      allowPartialFill: false,
    });

    console.log('✓ Swap transaction ready');

    // Step 8: Execute swap transaction
    const tx = await signer.sendTransaction({
      to: swapTx.tx.to,
      data: swapTx.tx.data,
      value: BigInt(swapTx.tx.value),
      gasLimit: BigInt(swapTx.tx.gas),
    });

    console.log('Swap transaction sent:', tx.hash);

    // Step 9: Wait for confirmation
    const receipt = await tx.wait();

    if (receipt?.status !== 1) {
      throw new Error('Swap transaction failed');
    }

    console.log('✓ Swap confirmed:', tx.hash);
    return tx.hash;

  } catch (error: any) {
    console.error('Swap execution failed:', error);
    
    // Handle specific error cases
    if (error.message?.includes('rejected') || error.message?.includes('denied')) {
      throw new Error('Transaction rejected by user');
    }
    
    if (error.message?.includes('insufficient funds')) {
      throw new Error('Insufficient funds for transaction');
    }

    throw error;
  }
}

/**
 * Utility: Format token amount to smallest unit
 */
export function formatToWei(amount: string, decimals: number): string {
  return ethers.parseUnits(amount, decimals).toString();
}

/**
 * Utility: Format from smallest unit to human readable
 */
export function formatFromWei(amount: string, decimals: number): string {
  return ethers.formatUnits(amount, decimals);
}

/**
 * Get token decimals
 */
export async function getTokenDecimals(
  tokenAddress: string,
  provider: ethers.Provider
): Promise<number> {
  if (tokenAddress.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
    return 18;
  }

  const tokenContract = new ethers.Contract(
    tokenAddress,
    ['function decimals() view returns (uint8)'],
    provider
  );

  return await tokenContract.decimals();
}
