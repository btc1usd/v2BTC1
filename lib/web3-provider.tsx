"use client"

import React, { ReactNode, createContext, useContext } from "react"
import { useAccount, useDisconnect } from "wagmi"
import { useActiveAccount, useDisconnect as useThirdwebDisconnect } from "thirdweb/react"
import { client as thirdwebClient } from "./thirdweb-client"
import { base } from "thirdweb/chains"

interface Web3ContextType {
  isConnected: boolean
  address: `0x${string}` | undefined
  chainId: number | undefined
  connectWallet: () => void
  disconnectWallet: () => void
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

export function Web3Provider({ children }: { children: ReactNode }) {
  // Use Wagmi's useAccount hook to get connection state
  const { address: wagmiAddress, isConnected: isWagmiConnected, chainId: wagmiChainId } = useAccount()
  const { disconnect: wagmiDisconnect } = useDisconnect()

  // Use Thirdweb's active account
  const thirdwebAccount = useActiveAccount()
  const { disconnect: thirdwebDisconnect } = useThirdwebDisconnect()

  // Derived states
  const isConnected = isWagmiConnected || !!thirdwebAccount
  const address = wagmiAddress || (thirdwebAccount?.address as `0x${string}` | undefined)
  const chainId = wagmiChainId || (thirdwebAccount ? base.id : undefined) // Default to base if thirdweb connected

  const connectWallet = () => {
    // This is now handled by the WalletSelectionModal
    console.log("Use the Connect Wallet button to connect")
  }

  const disconnectWallet = () => {
    if (isWagmiConnected) {
      wagmiDisconnect()
    }
    if (thirdwebAccount) {
      thirdwebDisconnect(thirdwebClient)
    }
  }

  return (
    <Web3Context.Provider value={{
      isConnected,
      address: address as `0x${string}` | undefined,
      chainId,
      connectWallet,
      disconnectWallet
    }}>
      {children}
    </Web3Context.Provider>
  )
}

export function useWeb3() {
  const context = useContext(Web3Context)
  if (context === undefined) {
    throw new Error("useWeb3 must be used within a Web3Provider")
  }
  return context
}