/**
 * Permit2 Utilities (SignatureTransfer)
 * Enables gasless approvals for tokens without native EIP-2612 support
 * Using Uniswap's Permit2 standard - SignatureTransfer variant
 * 
 * IMPORTANT: Users must first approve Permit2 to spend their tokens:
 *   token.approve(PERMIT2_ADDRESS, type(uint256).max)
 * 
 * Then they can use gasless permits for any protocol.
 */

// Permit2 is deployed at the same address on all chains
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

// Permit2 SignatureTransfer ABI
export const PERMIT2_ABI = [
  // Check if user has approved Permit2
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "token", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [
      { internalType: "uint160", name: "amount", type: "uint160" },
      { internalType: "uint48", name: "expiration", type: "uint48" },
      { internalType: "uint48", name: "nonce", type: "uint48" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // SignatureTransfer - permitTransferFrom (single)
  {
    inputs: [
      {
        components: [
          {
            components: [
              { internalType: "address", name: "token", type: "address" },
              { internalType: "uint256", name: "amount", type: "uint256" },
            ],
            internalType: "struct ISignatureTransfer.TokenPermissions",
            name: "permitted",
            type: "tuple",
          },
          { internalType: "uint256", name: "nonce", type: "uint256" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
        ],
        internalType: "struct ISignatureTransfer.PermitTransferFrom",
        name: "permit",
        type: "tuple",
      },
      {
        components: [
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "requestedAmount", type: "uint256" },
        ],
        internalType: "struct ISignatureTransfer.SignatureTransferDetails",
        name: "transferDetails",
        type: "tuple",
      },
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "permitTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Get nonce bitmap for unordered nonces
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint256", name: "word", type: "uint256" },
    ],
    name: "nonceBitmap",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Domain separator
  {
    inputs: [],
    name: "DOMAIN_SEPARATOR",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// EIP-712 Types for Permit2 SignatureTransfer
export const PERMIT2_TYPES = {
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
} as const;

/**
 * Get Permit2 domain for EIP-712 signing
 */
export function getPermit2Domain(chainId: number) {
  return {
    name: "Permit2",
    chainId,
    verifyingContract: PERMIT2_ADDRESS,
  };
}

/**
 * Create Permit2 SignatureTransfer message for signing
 * @param token - Token address to transfer
 * @param amount - Amount to transfer
 * @param spender - The contract that will call permitTransferFrom (Vault)
 * @param nonce - Unique nonce (use generateNonce())
 * @param deadline - Unix timestamp when signature expires
 */
export function createPermit2TransferMessage(
  token: `0x${string}`,
  amount: bigint,
  spender: `0x${string}`,
  nonce: bigint,
  deadline: bigint
) {
  return {
    permitted: {
      token,
      amount,
    },
    spender,
    nonce,
    deadline,
  };
}

/**
 * Generate a random nonce for SignatureTransfer
 * Permit2 uses unordered nonces - each nonce can only be used once
 */
export function generateNonce(): bigint {
  // Use random 248 bits for word position, random 8 bits for bit position
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return BigInt('0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
}

/**
 * Get deadline (default 1 hour from now)
 */
export function getPermit2Deadline(hours: number = 1): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + hours * 3600);
}

/**
 * Get expiration for AllowanceTransfer (30 days from now)
 */
export function getPermit2Expiration(days: number = 30): number {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

/**
 * Get signature deadline (alias for getPermit2Deadline)
 */
export function getPermit2SigDeadline(hours: number = 1): bigint {
  return getPermit2Deadline(hours);
}

/**
 * Max uint160 for unlimited approval
 */
export const MAX_UINT160 = BigInt(2 ** 160 - 1);

/**
 * Max uint256 for unlimited amounts
 */
export const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

/**
 * Max uint48 for no expiration
 */
export const MAX_UINT48 = 2 ** 48 - 1;

// Legacy exports for backward compatibility
export function createPermit2Message(
  token: `0x${string}`,
  amount: bigint,
  expiration: number,
  nonce: number,
  spender: `0x${string}`,
  sigDeadline: bigint
) {
  return {
    details: {
      token,
      amount: amount > MAX_UINT160 ? MAX_UINT160 : amount,
      expiration,
      nonce,
    },
    spender,
    sigDeadline,
  };
}
