/**
 * Authentication & Authorization Configuration
 * 
 * This module separates UI access control from transaction execution control:
 * - UI_CONTROLLER: Can view admin tabs and interfaces
 * - SAFE_ADDRESS: Executes all blockchain transactions via Gnosis Safe
 */

// UI Access Control - Controller who can view admin interfaces
export const UI_CONTROLLER_ADDRESS = process.env.NEXT_PUBLIC_UI_CONTROLLER || 
  process.env.NEXT_PUBLIC_ADMIN_WALLET || 
  "0xA1D4de75082562eA776b160e605acD587668111B";

// Transaction Execution Control - Safe address for on-chain actions
export const SAFE_TRANSACTION_ADDRESS = process.env.NEXT_PUBLIC_SAFE_ADDRESS || 
  "0xA1D4de75082562eA776b160e605acD587668111B";

/**
 * Check if address has UI access to admin panels
 * This allows viewing admin tabs without requiring Safe multi-sig
 */
export const hasUIAccess = (userAddress: string | undefined): boolean => {
  if (!userAddress) return false;
  return userAddress.toLowerCase() === UI_CONTROLLER_ADDRESS.toLowerCase();
};

/**
 * Check if address is the Safe address for transaction execution
 * All blockchain transactions must be executed through this address
 */
export const isSafeAddress = (userAddress: string | undefined): boolean => {
  if (!userAddress) return false;
  return userAddress.toLowerCase() === SAFE_TRANSACTION_ADDRESS.toLowerCase();
};

/**
 * Get display info about current auth status
 */
export const getAuthStatus = (userAddress: string | undefined) => {
  if (!userAddress) {
    return {
      hasUIAccess: false,
      isSafe: false,
      message: "Not connected",
      canViewAdmin: false,
      canExecuteTransactions: false
    };
  }

  const hasUI = hasUIAccess(userAddress);
  const isSafe = isSafeAddress(userAddress);

  return {
    hasUIAccess: hasUI,
    isSafe,
    message: hasUI 
      ? "UI Controller - View admin panels, execute via Safe" 
      : "Regular user",
    canViewAdmin: hasUI,
    canExecuteTransactions: isSafe,
    safeAddress: SAFE_TRANSACTION_ADDRESS,
    controllerAddress: UI_CONTROLLER_ADDRESS
  };
};

// Export for backwards compatibility with existing code
export const ADMIN_ADDRESS = UI_CONTROLLER_ADDRESS;

/**
 * Helper for displaying transaction execution instructions
 */
export const getTransactionInstructions = () => {
  return {
    safeUrl: `https://app.safe.global/base:${SAFE_TRANSACTION_ADDRESS}`,
    instructions: [
      "All administrative transactions must be executed through Safe",
      "UI controller can prepare transactions",
      "Safe multi-sig approval required for execution",
      "Connect with Safe address or use Safe UI for final execution"
    ]
  };
};
