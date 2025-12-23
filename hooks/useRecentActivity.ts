import { useState, useEffect } from 'react'
import { useAccount, useWatchContractEvent, usePublicClient } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/lib/contracts'
import { formatUnits } from 'viem'

export interface ActivityEvent {
  id: string
  type: 'mint' | 'redeem' | 'claim' | 'distribution' | 'governance'
  title: string
  description: string
  amount?: string
  timestamp: number
  txHash?: string
  icon: 'plus' | 'minus' | 'gift' | 'calendar' | 'vote'
  color: 'green' | 'red' | 'orange' | 'blue' | 'purple'
}

const VAULT_ABI = [
  {
    "inputs": [
      { "indexed": true, "name": "user", "type": "address" },
      { "indexed": false, "name": "btcAmount", "type": "uint256" },
      { "indexed": false, "name": "tokensIssued", "type": "uint256" },
      { "indexed": false, "name": "collateralToken", "type": "address" }
    ],
    "name": "Mint",
    "type": "event"
  },
  {
    "inputs": [
      { "indexed": true, "name": "user", "type": "address" },
      { "indexed": false, "name": "tokensRedeemed", "type": "uint256" },
      { "indexed": false, "name": "btcAmount", "type": "uint256" },
      { "indexed": false, "name": "collateralToken", "type": "address" }
    ],
    "name": "Redeem",
    "type": "event"
  }
] as const

const DISTRIBUTOR_ABI = [
  {
    "inputs": [
      { "indexed": false, "name": "index", "type": "uint256" },
      { "indexed": false, "name": "account", "type": "address" },
      { "indexed": false, "name": "amount", "type": "uint256" }
    ],
    "name": "Claimed",
    "type": "event"
  }
] as const

const WEEKLY_DISTRIBUTION_ABI = [
  {
    "inputs": [
      { "indexed": true, "name": "distributionId", "type": "uint256" },
      { "indexed": false, "name": "collateralRatio", "type": "uint256" },
      { "indexed": false, "name": "rewardPerToken", "type": "uint256" },
      { "indexed": false, "name": "totalRewards", "type": "uint256" },
      { "indexed": false, "name": "timestamp", "type": "uint256" }
    ],
    "name": "WeeklyDistribution",
    "type": "event"
  }
] as const

export function useRecentActivity() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Watch Mint events
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.VAULT as `0x${string}`,
    abi: VAULT_ABI,
    eventName: 'Mint',
    onLogs(logs: any[]) {
      console.log('🟢 Mint event detected:', logs)
      const newActivities = logs
        .filter((log: any) => {
          const isMatch = log.args.user?.toLowerCase() === address?.toLowerCase()
          console.log('Mint check:', { logUser: log.args.user, currentUser: address, isMatch })
          return isMatch
        })
        .map((log: any) => {
          const btcAmount = parseFloat(formatUnits(log.args.btcAmount || 0n, 8)).toFixed(2)
          const tokenAmount = parseFloat(formatUnits(log.args.tokensIssued || 0n, 8)).toFixed(2)
          return {
            id: `mint-${log.transactionHash}-${log.logIndex}`,
            type: 'mint' as const,
            title: 'Minted BTC1',
            description: `Deposited ${btcAmount} BTC`,
            amount: `+${tokenAmount} BTC1`,
            timestamp: Date.now(),
            txHash: log.transactionHash,
            icon: 'plus' as const,
            color: 'green' as const
          }
        })

      if (newActivities.length > 0) {
        console.log('✅ Adding mint activities:', newActivities)
        setActivities((prev) => {
          // Filter out duplicates by ID
          const existingIds = new Set(prev.map(a => a.id))
          const uniqueNew = newActivities.filter(a => !existingIds.has(a.id))
          return [...uniqueNew, ...prev].slice(0, 10)
        })
      }
    },
  })

  // Watch Redeem events
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.VAULT as `0x${string}`,
    abi: VAULT_ABI,
    eventName: 'Redeem',
    onLogs(logs: any[]) {
      console.log('🔴 Redeem event detected:', logs)
      const newActivities = logs
        .filter((log: any) => {
          const isMatch = log.args.user?.toLowerCase() === address?.toLowerCase()
          console.log('Redeem check:', { logUser: log.args.user, currentUser: address, isMatch })
          return isMatch
        })
        .map((log: any) => {
          const btcAmount = parseFloat(formatUnits(log.args.btcAmount || 0n, 8)).toFixed(2)
          const tokenAmount = parseFloat(formatUnits(log.args.tokensRedeemed || 0n, 8)).toFixed(2)
          return {
            id: `redeem-${log.transactionHash}-${log.logIndex}`,
            type: 'redeem' as const,
            title: 'Redeemed BTC1',
            description: `Received ${btcAmount} BTC`,
            amount: `-${tokenAmount} BTC1`,
            timestamp: Date.now(),
            txHash: log.transactionHash,
            icon: 'minus' as const,
            color: 'red' as const
          }
        })

      if (newActivities.length > 0) {
        console.log('✅ Adding redeem activities:', newActivities)
        setActivities((prev) => {
          // Filter out duplicates by ID
          const existingIds = new Set(prev.map(a => a.id))
          const uniqueNew = newActivities.filter(a => !existingIds.has(a.id))
          return [...uniqueNew, ...prev].slice(0, 10)
        })
      }
    },
  })

  // Watch Claim events
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.MERKLE_DISTRIBUTOR as `0x${string}`,
    abi: DISTRIBUTOR_ABI,
    eventName: 'Claimed',
    onLogs(logs: any[]) {
      console.log('🎁 Claim event detected:', logs)
      const newActivities = logs
        .filter((log: any) => {
          const isMatch = log.args.account?.toLowerCase() === address?.toLowerCase()
          console.log('Claim check:', { logAccount: log.args.account, currentUser: address, isMatch })
          return isMatch
        })
        .map((log: any) => {
          const claimAmount = parseFloat(formatUnits(log.args.amount || 0n, 8)).toFixed(2)
          return {
            id: `claim-${log.transactionHash}-${log.logIndex}`,
            type: 'claim' as const,
            title: 'Claimed Rewards',
            description: `Claimed successfully`,
            amount: `+${claimAmount} BTC1`,
            timestamp: Date.now(),
            txHash: log.transactionHash,
            icon: 'gift' as const,
            color: 'orange' as const
          }
        })

      if (newActivities.length > 0) {
        console.log('✅ Adding claim activities:', newActivities)
        setActivities((prev) => {
          // Filter out duplicates by ID
          const existingIds = new Set(prev.map(a => a.id))
          const uniqueNew = newActivities.filter(a => !existingIds.has(a.id))
          return [...uniqueNew, ...prev].slice(0, 10)
        })
      }
    },
  })

  // Watch Distribution events (all users)
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.WEEKLY_DISTRIBUTION as `0x${string}`,
    abi: WEEKLY_DISTRIBUTION_ABI,
    eventName: 'WeeklyDistribution',
    onLogs(logs: any[]) {
      console.log('📅 Distribution event detected:', logs)
      const newActivities = logs.map((log: any) => {
        const rewardPerToken = parseFloat(formatUnits(log.args.rewardPerToken || 0n, 18)).toFixed(2)
        return {
          id: `distribution-${log.transactionHash}-${log.logIndex}`,
          type: 'distribution' as const,
          title: 'Distribution Executed',
          description: `Distribution #${log.args.distributionId} (weekly)`,
          amount: `${rewardPerToken}¢ per token`,
          timestamp: Date.now(),
          txHash: log.transactionHash,
          icon: 'calendar' as const,
          color: 'blue' as const
        }
      })

      if (newActivities.length > 0) {
        console.log('✅ Adding distribution activities:', newActivities)
        setActivities((prev) => {
          // Filter out duplicates by ID
          const existingIds = new Set(prev.map(a => a.id))
          const uniqueNew = newActivities.filter(a => !existingIds.has(a.id))
          return [...uniqueNew, ...prev].slice(0, 10)
        })
      }
    },
  })

  // Fetch historical events from blockchain
  useEffect(() => {
    async function fetchHistoricalActivities() {
      if (!address || !publicClient) {
        console.log('⚠️ No address or publicClient available')
        setActivities([])
        return
      }

      console.log('🔍 Fetching historical activities for:', address)
      setIsLoading(true)
      try {
        const currentBlock = await publicClient.getBlockNumber()
        // Fetch last 100,000 blocks (approximately last 2-3 days on Base with ~2 sec block time)
        // Increase range to ensure we capture activity
        const fromBlock = currentBlock > 100000n ? currentBlock - 100000n : 0n

        const allActivities: ActivityEvent[] = []

        // Fetch Mint events
        try {
          const mintLogs = await publicClient.getLogs({
            address: CONTRACT_ADDRESSES.VAULT as `0x${string}`,
            event: VAULT_ABI[0],
            args: {
              user: address,
            },
            fromBlock,
            toBlock: 'latest',
          })

          const mintActivities = await Promise.all(mintLogs.map(async (log: any) => {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber })
            const btcAmount = parseFloat(formatUnits(log.args.btcAmount || 0n, 8)).toFixed(2)
            const tokenAmount = parseFloat(formatUnits(log.args.tokensIssued || 0n, 8)).toFixed(2)
            return {
              id: `mint-${log.transactionHash}-${log.logIndex}`,
              type: 'mint' as const,
              title: 'Minted BTC1',
              description: `Deposited ${btcAmount} BTC`,
              amount: `+${tokenAmount} BTC1`,
              timestamp: Number(block.timestamp) * 1000,
              txHash: log.transactionHash,
              icon: 'plus' as const,
              color: 'green' as const,
            }
          }))
          allActivities.push(...mintActivities)
        } catch (error) {
          console.error('Error fetching mint events:', error)
        }

        // Fetch Redeem events
        try {
          const redeemLogs = await publicClient.getLogs({
            address: CONTRACT_ADDRESSES.VAULT as `0x${string}`,
            event: VAULT_ABI[1],
            args: {
              user: address,
            },
            fromBlock,
            toBlock: 'latest',
          })

          const redeemActivities = await Promise.all(redeemLogs.map(async (log: any) => {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber })
            const btcAmount = parseFloat(formatUnits(log.args.btcAmount || 0n, 8)).toFixed(2)
            const tokenAmount = parseFloat(formatUnits(log.args.tokensRedeemed || 0n, 8)).toFixed(2)
            return {
              id: `redeem-${log.transactionHash}-${log.logIndex}`,
              type: 'redeem' as const,
              title: 'Redeemed BTC1',
              description: `Received ${btcAmount} BTC`,
              amount: `-${tokenAmount} BTC1`,
              timestamp: Number(block.timestamp) * 1000,
              txHash: log.transactionHash,
              icon: 'minus' as const,
              color: 'red' as const,
            }
          }))
          allActivities.push(...redeemActivities)
        } catch (error) {
          console.error('Error fetching redeem events:', error)
        }

        // Fetch Claim events
        try {
          const claimLogs = await publicClient.getLogs({
            address: CONTRACT_ADDRESSES.MERKLE_DISTRIBUTOR as `0x${string}`,
            event: DISTRIBUTOR_ABI[0],
            args: {
              account: address,
            },
            fromBlock,
            toBlock: 'latest',
          })

          const claimActivities = await Promise.all(claimLogs.map(async (log: any) => {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber })
            const claimAmount = parseFloat(formatUnits(log.args.amount || 0n, 8)).toFixed(2)
            return {
              id: `claim-${log.transactionHash}-${log.logIndex}`,
              type: 'claim' as const,
              title: 'Claimed Rewards',
              description: `Claimed successfully`,
              amount: `+${claimAmount} BTC1`,
              timestamp: Number(block.timestamp) * 1000,
              txHash: log.transactionHash,
              icon: 'gift' as const,
              color: 'orange' as const,
            }
          }))
          allActivities.push(...claimActivities)
        } catch (error) {
          console.error('Error fetching claim events:', error)
        }

        // Fetch Distribution events (for all users, not filtered by address)
        try {
          const distributionLogs = await publicClient.getLogs({
            address: CONTRACT_ADDRESSES.WEEKLY_DISTRIBUTION as `0x${string}`,
            event: WEEKLY_DISTRIBUTION_ABI[0],
            fromBlock,
            toBlock: 'latest',
          })

          const distributionActivities = await Promise.all(distributionLogs.map(async (log: any) => {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber })
            const rewardPerToken = parseFloat(formatUnits(log.args.rewardPerToken || 0n, 18)).toFixed(2)
            return {
              id: `distribution-${log.transactionHash}-${log.logIndex}`,
              type: 'distribution' as const,
              title: 'Distribution Executed',
              description: `Distribution #${log.args.distributionId} (weekly)`,
              amount: `${rewardPerToken}¢ per token`,
              timestamp: Number(block.timestamp) * 1000,
              txHash: log.transactionHash,
              icon: 'calendar' as const,
              color: 'blue' as const,
            }
          }))
          allActivities.push(...distributionActivities)
        } catch (error) {
          console.error('Error fetching distribution events:', error)
        }

        // Sort by timestamp (most recent first) and limit to 10
        const sortedActivities = allActivities
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10)

        console.log(`✅ Fetched ${sortedActivities.length} total activities`)
        setActivities(sortedActivities)
        
        // If no activities found, log it clearly
        if (sortedActivities.length === 0) {
          console.log('ℹ️ No recent activity found for this wallet in the last 100,000 blocks')
        }
      } catch (error) {
        console.error('Error fetching historical activities:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistoricalActivities()
  }, [address, publicClient])

  // Add periodic deduplication to ensure no duplicates ever persist
  useEffect(() => {
    const deduplicateInterval = setInterval(() => {
      setActivities((prev) => {
        const uniqueActivities = Array.from(
          new Map(prev.map((a) => [a.id, a])).values()
        )
        // Only update if we found duplicates
        if (uniqueActivities.length !== prev.length) {
          console.log(`🔧 Removed ${prev.length - uniqueActivities.length} duplicate activities`)
          return uniqueActivities
        }
        return prev
      })
    }, 5000) // Check every 5 seconds

    return () => clearInterval(deduplicateInterval)
  }, [])

  return { activities, isLoading }
}
