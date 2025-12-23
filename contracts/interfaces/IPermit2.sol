// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPermit2
 * @notice Interface for Uniswap's Permit2 contract
 * @dev Enables gasless approvals for tokens without native EIP-2612 support
 * 
 * IMPORTANT: Users must first approve Permit2 to spend their tokens:
 *   token.approve(PERMIT2_ADDRESS, type(uint256).max)
 * 
 * This interface includes both SignatureTransfer and AllowanceTransfer.
 */
interface IPermit2 {
    // ============ SignatureTransfer ============
    
    /// @notice Token and amount in a permit message
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    /// @notice The permit message for SignatureTransfer
    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    /// @notice Transfer details for SignatureTransfer
    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    /// @notice Transfer tokens using a signed permit (SignatureTransfer)
    /// @dev The caller must be the spender specified in the signed permit
    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    // ============ AllowanceTransfer ============

    /// @notice The permit data for a token
    struct PermitDetails {
        address token;
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    /// @notice The permit message signed for a single token allowance
    struct PermitSingle {
        PermitDetails details;
        address spender;
        uint256 sigDeadline;
    }

    /// @notice The permit message signed for multiple token allowances
    struct PermitBatch {
        PermitDetails[] details;
        address spender;
        uint256 sigDeadline;
    }

    /// @notice Details for a token transfer
    struct AllowanceTransferDetails {
        address from;
        address to;
        uint160 amount;
        address token;
    }

    /// @notice Get allowance for a specific owner/token/spender
    function allowance(
        address owner,
        address token,
        address spender
    ) external view returns (uint160 amount, uint48 expiration, uint48 nonce);

    /// @notice Approve a spender to access your tokens directly (no signature)
    function approve(
        address token,
        address spender,
        uint160 amount,
        uint48 expiration
    ) external;

    /// @notice Permit a spender via signature (AllowanceTransfer)
    function permit(
        address owner,
        PermitSingle memory permitSingle,
        bytes calldata signature
    ) external;

    /// @notice Permit multiple tokens via signature (AllowanceTransfer)
    function permitBatch(
        address owner,
        PermitBatch memory permitBatch,
        bytes calldata signature
    ) external;

    /// @notice Transfer approved tokens (AllowanceTransfer)
    function transferFrom(
        address from,
        address to,
        uint160 amount,
        address token
    ) external;

    /// @notice Transfer approved tokens in a batch
    function transferFrom(AllowanceTransferDetails[] calldata transferDetails) external;

    /// @notice Gets the domain separator
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
