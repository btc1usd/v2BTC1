z"use client"

import { WagmiWalletConnect } from "@/components/wagmi-wallet-connect"
export * from "@/components/wagmi-wallet-connect"

interface EnhancedWalletConnectProps {
  onConnect?: () => void
  onDisconnect?: () => void
}

// This component is now a wrapper that uses the new Wagmi-based implementation
export function EnhancedWalletConnect({ onConnect, onDisconnect }: EnhancedWalletConnectProps) {
  // For backward compatibility, we're still exporting this component
  // But in practice, we should use WagmiWalletConnect directly
  return (
    <div className="w-full flex justify-center">
      <WagmiWalletConnect />
    </div>
  )
}
