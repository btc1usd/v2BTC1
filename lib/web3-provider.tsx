"use client"

import React, { ReactNode, createContext, useContext, useState, useEffect } from "react"
import { useAccount, useDisconnect } from "wagmi"
import { useActiveAccount } from "thirdweb/react"
import { client as thirdwebClient } from "./thirdweb-client"
import { baseSepolia } from "thirdweb/chains"
import { WalletSelectionModal } from "@/components/wallet-selection-modal"

interface Web3ContextType {
  isConnected: boolean
  address: `0x${string}` | undefined
  chainId: number | undefined
  connectWallet: () => void
  disconnectWallet: () => void
  isModalOpen: boolean
  setModalOpen: (open: boolean) => void
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

export function Web3Provider({ children }: { children: ReactNode }) {
  const [isModalOpen, setModalOpen] = useState(false)
  // Use Wagmi's useAccount hook to get connection state
  const { address: wagmiAddress, isConnected: isWagmiConnected, chainId: wagmiChainId } = useAccount()
  const { disconnect: wagmiDisconnect } = useDisconnect()

  // Use Thirdweb's active account
  const thirdwebAccount = useActiveAccount()

  // Derived states
  const isConnected = !!thirdwebAccount || isWagmiConnected
  const address = (thirdwebAccount?.address as `0x${string}` | undefined) || wagmiAddress
  const chainId = thirdwebAccount ? baseSepolia.id : wagmiChainId // Base Sepolia (84532) for Thirdweb in-app wallets

  // Automatically close modal when connected
  useEffect(() => {
    if (isConnected && isModalOpen) {
      setModalOpen(false)
    }
  }, [isConnected, isModalOpen])

  const connectWallet = () => {
    setModalOpen(true)
  }

  const disconnectWallet = () => {
    if (isWagmiConnected) {
      wagmiDisconnect()
    }
    // For Thirdweb in-app wallets, the session is tied to the active account.
    // Reloading the page will clear the in-memory session and return to the landing state.
    if (thirdwebAccount) {
      window.location.reload()
    }
  }

  return (
    <Web3Context.Provider value={{
      isConnected,
      address: address as `0x${string}` | undefined,
      chainId,
      connectWallet,
      disconnectWallet,
      isModalOpen,
      setModalOpen
    }}>
      {children}
      <WalletSelectionModal open={isModalOpen} onOpenChange={setModalOpen} />
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