import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, encodePacked, keccak256, type Address } from 'viem';
import { 
  PERMIT2_ADDRESS, 
  createPermit2TransferMessage, 
  generateNonce, 
  getPermit2Deadline,
  getPermit2Domain,
  PERMIT2_TYPES 
} from '@/lib/permit2-utils';
import { 
  splitSignature, 
  getPermitDeadline, 
  createPermitMessage,
  PERMIT_TYPES,
  getPermitDomain 
} from '@/lib/permit-utils';

export function usePermitTransactions() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Mint BTC1USD using Permit2 (for collateral approval)
   * Works with any ERC20 token (wBTC, cbBTC, tBTC)
   */
  const mintWithPermit2 = async (
    vaultAddress: Address,
    collateralAddress: Address,
    amount: bigint,
    chainId: number,
    onSuccess?: (hash: string) => void,
    onError?: (error: Error) => void
  ) => {
    if (!address || !walletClient || !publicClient) {
      const error = new Error('Wallet not connected');
      setStatus('Wallet not connected');
      onError?.(error);
      return;
    }

    try {
      setIsProcessing(true);
      setStatus('🔐 Generating Permit2 signature...');

      // Generate nonce and deadline for Permit2
      const nonce = generateNonce();
      const deadline = getPermit2Deadline(1); // 1 hour expiry

      // Create Permit2 message
      const message = createPermit2TransferMessage(
        collateralAddress,
        amount,
        vaultAddress, // spender is the Vault
        nonce,
        deadline
      );

      // Get domain for signing
      const domain = getPermit2Domain(chainId);

      setStatus('📝 Please sign the permit message...');

      // Sign the permit
      const signature = await walletClient.signTypedData({
        account: address,
        domain,
        types: PERMIT2_TYPES,
        primaryType: 'PermitTransferFrom',
        message,
      });

      setStatus('📤 Submitting mint transaction...');

      // Call mintWithPermit2 on vault
      const hash = await walletClient.writeContract({
        address: vaultAddress,
        abi: [{
          name: 'mintWithPermit2',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'collateral', type: 'address' },
            { name: 'amount', type: 'uint256' },
            {
              name: 'permit',
              type: 'tuple',
              components: [
                {
                  name: 'permitted',
                  type: 'tuple',
                  components: [
                    { name: 'token', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                  ],
                },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
              ],
            },
            { name: 'signature', type: 'bytes' },
          ],
          outputs: [],
        }],
        functionName: 'mintWithPermit2',
        args: [
          collateralAddress,
          amount,
          {
            permitted: {
              token: collateralAddress,
              amount,
            },
            nonce,
            deadline,
          },
          signature,
        ],
      });

      setStatus('⏳ Waiting for confirmation...');

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setStatus('✅ Mint successful!');
        onSuccess?.(hash);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Permit2 mint error:', error);
      const errorMsg = error?.message || 'Mint failed';
      setStatus(`❌ ${errorMsg}`);
      onError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Redeem BTC1USD using EIP-2612 Permit (for BTC1USD approval)
   */
  const redeemWithPermit = async (
    vaultAddress: Address,
    btc1usdAddress: Address,
    collateralAddress: Address,
    btc1Amount: bigint,
    chainId: number,
    onSuccess?: (hash: string) => void,
    onError?: (error: Error) => void
  ) => {
    if (!address || !walletClient || !publicClient) {
      const error = new Error('Wallet not connected');
      setStatus('Wallet not connected');
      onError?.(error);
      return;
    }

    try {
      setIsProcessing(true);
      setStatus('📊 Fetching nonce...');

      // Get current nonce from BTC1USD contract
      const nonce = await publicClient.readContract({
        address: btc1usdAddress,
        abi: [{
          name: 'nonces',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [{ type: 'uint256' }],
        }],
        functionName: 'nonces',
        args: [address],
      }) as bigint;

      // Generate deadline
      const deadline = getPermitDeadline(1); // 1 hour expiry

      // Create permit message
      const message = createPermitMessage(
        address,
        vaultAddress, // spender is the Vault
        btc1Amount,
        nonce,
        deadline
      );

      // Get domain for signing
      const domain = getPermitDomain(btc1usdAddress, 'BTC1USD', chainId);

      setStatus('📝 Please sign the permit message...');

      // Sign the permit
      const signature = await walletClient.signTypedData({
        account: address,
        domain,
        types: PERMIT_TYPES,
        primaryType: 'Permit',
        message,
      });

      // Split signature into v, r, s
      const { v, r, s } = splitSignature(signature);

      setStatus('📤 Submitting redeem transaction...');

      // Call redeemWithPermit on vault
      const hash = await walletClient.writeContract({
        address: vaultAddress,
        abi: [{
          name: 'redeemWithPermit',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'btc1Amount', type: 'uint256' },
            { name: 'collateral', type: 'address' },
            { name: 'deadline', type: 'uint256' },
            { name: 'v', type: 'uint8' },
            { name: 'r', type: 'bytes32' },
            { name: 's', type: 'bytes32' },
          ],
          outputs: [],
        }],
        functionName: 'redeemWithPermit',
        args: [btc1Amount, collateralAddress, deadline, v, r, s],
      });

      setStatus('⏳ Waiting for confirmation...');

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setStatus('✅ Redeem successful!');
        onSuccess?.(hash);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Permit redeem error:', error);
      const errorMsg = error?.message || 'Redeem failed';
      setStatus(`❌ ${errorMsg}`);
      onError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Check if user has approved Permit2 to spend their tokens
   */
  const checkPermit2Approval = async (
    tokenAddress: Address,
    userAddress: Address
  ): Promise<bigint> => {
    if (!publicClient) return 0n;

    try {
      // Check ERC20 allowance: user -> Permit2
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: [{
          name: 'allowance',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
          ],
          outputs: [{ type: 'uint256' }],
        }],
        functionName: 'allowance',
        args: [userAddress, PERMIT2_ADDRESS],
      }) as bigint;

      return allowance;
    } catch (error) {
      console.error('Error checking Permit2 approval:', error);
      return 0n;
    }
  };

  /**
   * Approve Permit2 to spend unlimited tokens (one-time setup)
   */
  const approvePermit2 = async (
    tokenAddress: Address,
    onSuccess?: (hash: string) => void,
    onError?: (error: Error) => void
  ) => {
    if (!walletClient || !publicClient) {
      const error = new Error('Wallet not connected');
      onError?.(error);
      return;
    }

    try {
      setIsProcessing(true);
      setStatus('📤 Approving Permit2...');

      const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: [{
          name: 'approve',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ type: 'bool' }],
        }],
        functionName: 'approve',
        args: [PERMIT2_ADDRESS, maxUint256],
      });

      setStatus('⏳ Waiting for confirmation...');

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setStatus('✅ Permit2 approved!');
        onSuccess?.(hash);
      } else {
        throw new Error('Approval failed');
      }
    } catch (error: any) {
      console.error('Permit2 approval error:', error);
      const errorMsg = error?.message || 'Approval failed';
      setStatus(`❌ ${errorMsg}`);
      onError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    mintWithPermit2,
    redeemWithPermit,
    checkPermit2Approval,
    approvePermit2,
    status,
    isProcessing,
  };
}
