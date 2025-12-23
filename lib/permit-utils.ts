import { parseUnits } from "viem";

/**
 * EIP-2612 Permit Utilities
 * Helpers for generating permit signatures for gasless approvals
 */

export interface PermitSignature {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  deadline: bigint;
}

/**
 * Split EIP-712 signature into v, r, s components
 */
export function splitSignature(signature: `0x${string}`): { v: number; r: `0x${string}`; s: `0x${string}` } {
  const r = signature.slice(0, 66) as `0x${string}`;
  const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
  const v = parseInt(signature.slice(130, 132), 16);
  
  return { v, r, s };
}

/**
 * Get EIP-712 domain for permit
 */
export function getPermitDomain(
  tokenAddress: `0x${string}`,
  tokenName: string,
  chainId: number
) {
  return {
    name: tokenName,
    version: "1",
    chainId,
    verifyingContract: tokenAddress,
  };
}

/**
 * Get EIP-712 types for permit
 */
export const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/**
 * Generate permit deadline (1 hour from now by default)
 */
export function getPermitDeadline(hours: number = 1): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + hours * 3600);
}

/**
 * Create permit message for EIP-712 signing
 */
export function createPermitMessage(
  owner: `0x${string}`,
  spender: `0x${string}`,
  value: bigint,
  nonce: bigint,
  deadline: bigint
) {
  return {
    owner,
    spender,
    value,
    nonce,
    deadline,
  };
}
