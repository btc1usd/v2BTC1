/**
 * React Native WebView Bridge Utility
 * Safe communication between Web and Native
 */

export type RNBridgeAction = 
  | "READY" 
  | "TX_SUCCESS" 
  | "TX_ERROR" 
  | "TX_SIGN_REQUEST"
  | "ONRAMP_LINK"
  | "CLOSE";

export interface RNBridgePayload {
  action: RNBridgeAction;
  data?: any;
}

/**
 * Sends a message to the React Native WebView
 */
export function sendToRN(payload: RNBridgePayload) {
  if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
    try {
      const message = JSON.stringify(payload);
      (window as any).ReactNativeWebView.postMessage(message);
      console.log("✓ Sent to RN:", payload.action);
    } catch (err) {
      console.error("Failed to send message to RN:", err);
    }
  } else {
    console.warn("ReactNativeWebView not available for action:", payload.action);
  }
}
