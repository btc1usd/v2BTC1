'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'

// Network configuration - easily switch between testnet and mainnet
const NETWORK_CONFIG = {
  // Current: Base Sepolia (Testnet)
  chainId: 84532,
  name: 'Base Sepolia',
  // For Mainnet deployment: Change to 8453 and 'Base'
  // chainId: 8453,
  // name: 'Base',
}

export function NetworkGuard() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()
  const [showAlert, setShowAlert] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    if (isConnected && chainId !== NETWORK_CONFIG.chainId) {
      setShowAlert(true)
      setIsDismissed(false)
    } else {
      setShowAlert(false)
      setIsDismissed(false)
    }
  }, [isConnected, chainId])

  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: NETWORK_CONFIG.chainId })
    } catch (error) {
      console.error('Failed to switch network:', error)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
  }

  if (!showAlert || !isConnected || isDismissed) {
    return null
  }

  // Get a readable name for any network (covers 50+ networks)
  const getNetworkName = (id: number) => {
    const networks: Record<number, string> = {
      // Ethereum
      1: 'Ethereum Mainnet',
      5: 'Goerli',
      11155111: 'Sepolia',
      17000: 'Holesky',
      // Base
      8453: 'Base',
      84532: 'Base Sepolia',
      // Polygon
      137: 'Polygon',
      80001: 'Mumbai',
      1442: 'Polygon zkEVM',
      1101: 'Polygon zkEVM',
      // Arbitrum
      42161: 'Arbitrum One',
      42170: 'Arbitrum Nova',
      421613: 'Arbitrum Goerli',
      421614: 'Arbitrum Sepolia',
      // Optimism
      10: 'Optimism',
      420: 'Optimism Goerli',
      11155420: 'Optimism Sepolia',
      // BSC
      56: 'BNB Chain',
      97: 'BNB Testnet',
      // Avalanche
      43114: 'Avalanche C-Chain',
      43113: 'Avalanche Fuji',
      // Fantom
      250: 'Fantom',
      4002: 'Fantom Testnet',
      // Celo
      42220: 'Celo',
      44787: 'Celo Alfajores',
      // Moonbeam
      1284: 'Moonbeam',
      1285: 'Moonriver',
      1287: 'Moonbase Alpha',
      // Other L2s
      592: 'Astar',
      336: 'Shiden',
      100: 'Gnosis',
      324: 'zkSync Era',
      280: 'zkSync Era Testnet',
      59144: 'Linea',
      59140: 'Linea Goerli',
      534352: 'Scroll',
      534351: 'Scroll Sepolia',
      7777777: 'Zora',
      999: 'Zora Testnet',
      1313161554: 'Aurora',
      1313161555: 'Aurora Testnet',
      // Manta
      169: 'Manta Pacific',
      3441005: 'Manta Sepolia',
      // Blast
      81457: 'Blast',
      168587773: 'Blast Sepolia',
      // Mode
      34443: 'Mode',
      919: 'Mode Testnet',
    }
    return networks[id] || `Chain ${id}`
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in slide-in-from-top-5 duration-300">
      <Alert className="border-2 border-orange-500/50 bg-gradient-to-br from-orange-950/95 to-red-950/95 backdrop-blur-md shadow-2xl">
        <div className="flex items-start gap-2.5">
          <div className="flex-shrink-0 mt-0.5">
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 bg-orange-500 rounded-full blur opacity-40 animate-pulse"></div>
              <AlertTriangle className="h-5 w-5 text-orange-400 relative" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0 space-y-2">
            <AlertTitle className="text-orange-50 font-semibold text-base leading-tight pr-6">
              Wrong Network
            </AlertTitle>
            <AlertDescription className="text-orange-100/90 space-y-2">
              <p className="text-xs leading-snug">
                Please switch to the correct network.
              </p>
              
              <div className="bg-black/30 rounded-md p-2 space-y-1 border border-orange-500/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-orange-200/70">Current:</span>
                  <span className="font-semibold text-red-400 truncate ml-2">
                    {getNetworkName(chainId)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-orange-200/70">Required:</span>
                  <span className="font-semibold text-emerald-400">
                    {NETWORK_CONFIG.name}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSwitchNetwork}
                disabled={isPending}
                className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 border-0 h-9 text-sm"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                    Switching...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                    Switch to {NETWORK_CONFIG.name}
                  </>
                )}
              </Button>
            </AlertDescription>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-orange-300 hover:text-orange-100 transition-colors p-0.5 rounded hover:bg-white/10 -mt-1 -mr-1"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Alert>
    </div>
  )
}
