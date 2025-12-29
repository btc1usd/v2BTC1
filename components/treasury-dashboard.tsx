"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Users,
  Plus,
  Send,
  CheckCircle,
  AlertCircle,
  Wallet,
  Building,
  Coins,
  Heart,
  TrendingUp,
  Calendar,
  Vote,
  ExternalLink,
  Target,
  Trash2,
  Copy,
  Shield,
  Terminal,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from "wagmi"
import { CONTRACT_ADDRESSES, ABIS, ENDOWMENT_CATEGORIES, CATEGORY_NAMES } from "@/lib/contracts"
import { parseUnits, formatUnits, encodeFunctionData } from "viem"
import { readContract } from "viem/actions"

interface Payee {
  id: string
  name: string
  wallet: string
  amount: string
  description: string
  selected: boolean
}

interface NonProfit {
  id: string
  name: string
  wallet: string
  amount: string
  description: string
  category: string
  selected: boolean
  website?: string
  totalReceived?: string
  verified?: boolean
}

interface Proposal {
  id: number
  name: string
  description: string
  wallet: string
  categoryId: number
  votesFor: string
  votesAgainst: string
  executed: boolean
  approved: boolean
  proposalTimestamp: number
  votingDeadline: number
  hasVoted?: boolean
}

interface Distribution {
  id: number
  timestamp: number
  amount: string
  recipientCount: number
  executed: boolean
}

interface EndowmentStats {
  balance: string
  totalDistributed: string
  activeNonProfits: number
  distributionCount: number
  nextDistribution: number
  canDistribute: boolean
}

import { WalletManagement } from "@/components/wallet-management"
import { MerkleFeeDistributor } from "@/components/merkle-fee-distributor"

export function TreasuryDashboard({ isAdmin }: { isAdmin: boolean }) {
  const { address, isConnected } = useAccount()
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash })
  const publicClient = usePublicClient()
  // Add contract read hooks for distribution stats
  // Read dev wallet distribution stats
  const { data: devWalletStats, refetch: refetchDevWalletStats } = useReadContract({
    address: CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`,
    abi: ABIS.DEV_WALLET,
    functionName: 'getDistributionStats',
    args: [CONTRACT_ADDRESSES.BTC1USD as `0x${string}`],
  })

  // Read endowment wallet distribution stats
  const { data: endowmentWalletStats, refetch: refetchEndowmentWalletStats } = useReadContract({
    address: CONTRACT_ADDRESSES.ENDOWMENT_WALLET as `0x${string}`,
    abi: ABIS.ENDOWMENT_WALLET,
    functionName: 'getDistributionStats',
    args: [CONTRACT_ADDRESSES.BTC1USD as `0x${string}`],
  })

  // Read total distribution counts
  const { data: devTotalDistributionCount, refetch: refetchDevTotalCount } = useReadContract({
    address: CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`,
    abi: ABIS.DEV_WALLET,
    functionName: 'getTotalDistributionCount',
  })

  const { data: endowmentTotalDistributionCount, refetch: refetchEndowmentTotalCount } = useReadContract({
    address: CONTRACT_ADDRESSES.ENDOWMENT_WALLET as `0x${string}`,
    abi: ABIS.ENDOWMENT_WALLET,
    functionName: 'getTotalDistributionCount',
  })

  const [activeTab, setActiveTab] = useState<string>("overview")
  const [stats, setStats] = useState<EndowmentStats | null>(null)
  const [nonProfits, setNonProfits] = useState<NonProfit[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [distributions, setDistributions] = useState<Distribution[]>([])
  const [devPayees, setDevPayees] = useState<Payee[]>([])
  const [newDevPayee, setNewDevPayee] = useState<Omit<Payee, "id" | "selected">>({
    name: "",
    wallet: "",
    amount: "",
    description: "",
  })
  const [newNonProfit, setNewNonProfit] = useState<Omit<NonProfit, "id" | "selected" | "totalReceived" | "verified">>({
    name: "",
    wallet: "",
    amount: "",
    description: "",
    category: "Humanitarian",
    website: "",
  })
  const [showAddNonProfit, setShowAddNonProfit] = useState<boolean>(false)
  const [showAddDevWallet, setShowAddDevWallet] = useState<boolean>(false)
  const [showAddMerkleFeeWallet, setShowAddMerkleFeeWallet] = useState<boolean>(false)
  
  // Safe Transaction Modal states
  const [showDevWalletSafeModal, setShowDevWalletSafeModal] = useState(false)
  const [showNonProfitSafeModal, setShowNonProfitSafeModal] = useState(false)
  const [showMerkleFeeWalletSafeModal, setShowMerkleFeeWalletSafeModal] = useState(false)
  const [showDevDistributionSafeModal, setShowDevDistributionSafeModal] = useState(false)
  const [showMerkleFeeDistributionSafeModal, setShowMerkleFeeDistributionSafeModal] = useState(false)
  const [showEndowmentDistributionSafeModal, setShowEndowmentDistributionSafeModal] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  
  // Helper function for copying to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }
  
  const [proposalForm, setProposalForm] = useState<
    Omit<NonProfit, "id" | "selected" | "totalReceived" | "verified" | "amount">
  >({ name: "", description: "", wallet: "", category: "Humanitarian", website: "" })

  // Merkle Fee Wallet state
  const [merkleFeeWallets, setMerkleFeeWallets] = useState<Array<{
    address: string;
    name: string;
    description: string;
    amount: string;
    selected: boolean;
  }>>([])

  // Track distribution stats
  const [devDistributionStats, setDevDistributionStats] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('devDistributionStats')
      const stats = saved ? JSON.parse(saved) : { totalDistributed: 0, distributionCount: 0 }
      console.log('Initial Dev Distribution Stats:', stats)
      return stats
    }
    return { totalDistributed: 0, distributionCount: 0 }
  })

  const [endowmentDistributionStats, setEndowmentDistributionStats] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('endowmentDistributionStats')
      const stats = saved ? JSON.parse(saved) : { totalDistributed: 0, distributionCount: 0 }
      console.log('Initial Endowment Distribution Stats:', stats)
      return stats
    }
    return { totalDistributed: 0, distributionCount: 0 }
  })

  const [lastDistributionType, setLastDistributionType] = useState<'dev' | 'endowment' | null>(null)

  // Transaction status and error handling
  const [transactionStatus, setTransactionStatus] = useState("")
  const [transactionType, setTransactionType] = useState<string | null>(null)
  const [selectedToken, setSelectedToken] = useState<string>('BTC1') // Token selection for distributions

  // Read contract data - Dev Wallet balance
  const { data: devWalletBalance, refetch: refetchDevBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: ABIS.BTC1USD,
    functionName: 'balanceOf',
    args: [CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`],
  })

  // Read Dev Wallet collateral balances
  const { data: devWalletWbtcBalance, refetch: refetchDevWbtcBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.WBTC_TOKEN as `0x${string}`,
    abi: ABIS.ERC20,
    functionName: 'balanceOf',
    args: [CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`],
  })

  const { data: devWalletCbbtcBalance, refetch: refetchDevCbbtcBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.CBBTC_TOKEN as `0x${string}`,
    abi: ABIS.ERC20,
    functionName: 'balanceOf',
    args: [CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`],
  })

  const { data: devWalletTbtcBalance, refetch: refetchDevTbtcBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.TBTC_TOKEN as `0x${string}`,
    abi: ABIS.ERC20,
    functionName: 'balanceOf',
    args: [CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`],
  })

  // Read contract data - Endowment Wallet balance
  const { data: endowmentWalletBalance, refetch: refetchEndowmentBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: ABIS.BTC1USD,
    functionName: 'balanceOf',
    args: [CONTRACT_ADDRESSES.ENDOWMENT_WALLET as `0x${string}`],
  })

  // Read contract data - Endowment stats
  const { data: canDistribute } = useReadContract({
    address: CONTRACT_ADDRESSES.ENDOWMENT_MANAGER as `0x${string}`,
    abi: ABIS.ENDOWMENT_MANAGER,
    functionName: 'canDistribute',
  })

  const { data: nextDistributionTime } = useReadContract({
    address: CONTRACT_ADDRESSES.ENDOWMENT_MANAGER as `0x${string}`,
    abi: ABIS.ENDOWMENT_MANAGER,
    functionName: 'getNextDistributionTime',
  })

  const { data: distributionCount } = useReadContract({
    address: CONTRACT_ADDRESSES.ENDOWMENT_MANAGER as `0x${string}`,
    abi: ABIS.ENDOWMENT_MANAGER,
    functionName: 'distributionCount',
  })

  // Read dev wallet addresses
  const { data: devWalletAddresses, refetch: refetchDevWallets } = useReadContract({
    address: CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`,
    abi: ABIS.DEV_WALLET,
    functionName: 'getWalletAddresses',
  })

  // Read Merkle Fee Collector balance
  const { data: merkleFeeCollectorBalance, refetch: refetchMerkleFeeCollectorBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: ABIS.BTC1USD,
    functionName: 'balanceOf',
    args: [CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR as `0x${string}`],
  })

  // Read Merkle Fee Collector distribution stats
  const { data: merkleFeeCollectorStats, refetch: refetchMerkleFeeCollectorStats } = useReadContract({
    address: CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR as `0x${string}`,
    abi: ABIS.MERKLE_FEE_COLLECTOR,
    functionName: 'getDistributionStats',
    args: [CONTRACT_ADDRESSES.BTC1USD as `0x${string}`],
  })

  // Read Merkle Fee Collector total distribution count
  const { data: merkleFeeTotalDistributionCount, refetch: refetchMerkleFeeTotalDistributionCount } = useReadContract({
    address: CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR as `0x${string}`,
    abi: ABIS.MERKLE_FEE_COLLECTOR,
    functionName: 'getTotalDistributionCount',
  })

  // Read Merkle Fee Collector wallet addresses
  const { data: merkleFeeWalletAddresses, refetch: refetchMerkleFeeWallets } = useReadContract({
    address: CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR as `0x${string}`,
    abi: ABIS.MERKLE_FEE_COLLECTOR,
    functionName: 'getWalletAddresses',
  })

  // Read approved non-profits
  const { data: approvedNonProfits, refetch: refetchNonProfits } = useReadContract({
    address: CONTRACT_ADDRESSES.ENDOWMENT_MANAGER as `0x${string}`,
    abi: ABIS.ENDOWMENT_MANAGER,
    functionName: 'getApprovedNonProfits',
  })

  // Helper functions to get category name and color
  const getCategoryById = (id: number): string => {
    const categoryName = CATEGORY_NAMES[id] || "Unknown";
    return categoryName;
  }

  const getCategoryColor = (categoryName: string): string => {
    switch (categoryName) {
      case "Humanitarian":
        return "bg-gradient-to-br from-blue-500 to-blue-700"
      case "Zakat":
        return "bg-gradient-to-br from-green-500 to-green-700"
      case "Development":
        return "bg-gradient-to-br from-purple-500 to-purple-700"
      case "Poverty":
        return "bg-gradient-to-br from-red-500 to-red-700"
      case "Education":
        return "bg-gradient-to-br from-yellow-500 to-yellow-700"
      case "Healthcare":
        return "bg-gradient-to-br from-pink-500 to-pink-700"
      case "Environment":
        return "bg-gradient-to-br from-teal-500 to-teal-700"
      default:
        return "bg-gradient-to-br from-gray-500 to-gray-700"
    }
  }

  // Fetch endowment stats
  // Load stats from blockchain
  useEffect(() => {
    if (endowmentWalletBalance !== undefined && distributionCount !== undefined && nextDistributionTime !== undefined) {
      setStats({
        balance: formatUnits(endowmentWalletBalance as bigint, 8),
        totalDistributed: "0", // Would need to track from events
        activeNonProfits: (approvedNonProfits as readonly `0x${string}`[])?.length || 0,
        distributionCount: Number(distributionCount),
        nextDistribution: Number(nextDistributionTime),
        canDistribute: (canDistribute as boolean) || false,
      })
    }
  }, [endowmentWalletBalance, distributionCount, nextDistributionTime, approvedNonProfits, canDistribute])

  // Load dev wallets from blockchain with full info
  useEffect(() => {
    const fetchWalletInfo = async () => {
      if (!publicClient || !devWalletAddresses || (devWalletAddresses as readonly `0x${string}`[]).length === 0) {
        console.log("No dev wallets to fetch:", { publicClient: !!publicClient, devWalletAddresses })
        setDevPayees([])
        return
      }

      const addresses = devWalletAddresses as readonly `0x${string}`[]
      console.log("Fetching info for dev wallets:", addresses)

      // Fetch wallet info for each address
      const walletPromises = addresses.map(async (addr) => {
        try {
          const result = await readContract(publicClient, {
            address: CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`,
            abi: ABIS.DEV_WALLET,
            functionName: 'getWalletInfo',
            args: [addr],
          }) as [string, string, boolean]

          const [walletName, description, isActive] = result

          console.log(`Dev wallet ${addr} info:`, { walletName, isActive })

          // Only include active wallets
          if (!isActive) {
            console.log(`Skipping inactive wallet: ${addr}`)
            return null
          }

          return {
            id: addr,
            name: walletName || `Wallet ${addr.slice(0, 6)}`,
            wallet: addr,
            amount: "0",
            description: description || "",
            selected: false,
          }
        } catch (err) {
          console.error(`Failed to fetch info for ${addr}:`, err)
          return {
            id: addr,
            name: `Wallet ${addr.slice(0, 6)}`,
            wallet: addr,
            amount: "0",
            description: "",
            selected: false,
          }
        }
      })

      const wallets = await Promise.all(walletPromises)
      const filteredWallets = wallets.filter(w => w !== null) as Payee[]
      console.log("Loaded dev wallets:", filteredWallets)
      setDevPayees(filteredWallets)
    }

    fetchWalletInfo()
  }, [devWalletAddresses, publicClient])

  // Load Merkle Fee wallets from blockchain with full info
  useEffect(() => {
    const fetchMerkleFeeWalletInfo = async () => {
      if (!publicClient || !merkleFeeWalletAddresses || (merkleFeeWalletAddresses as readonly `0x${string}`[]).length === 0) {
        console.log("No Merkle fee wallets to fetch:", { publicClient: !!publicClient, merkleFeeWalletAddresses })
        setMerkleFeeWallets([])
        return
      }

      const addresses = merkleFeeWalletAddresses as readonly `0x${string}`[]
      console.log("Fetching info for Merkle fee wallets:", addresses)

      // Fetch wallet info for each address
      const walletPromises = addresses.map(async (addr) => {
        try {
          const result = await readContract(publicClient, {
            address: CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR as `0x${string}`,
            abi: ABIS.MERKLE_FEE_COLLECTOR,
            functionName: 'getWalletInfo',
            args: [addr],
          }) as [string, string, boolean]

          const [walletName, description, isActive] = result

          console.log(`Merkle fee wallet ${addr} info:`, { walletName, isActive })

          // Only include active wallets
          if (!isActive) {
            console.log(`Skipping inactive wallet: ${addr}`)
            return null
          }

          return {
            address: addr,
            name: walletName || `Wallet ${addr.slice(0, 6)}`,
            description: description || "",
            amount: "0",
            selected: false,
          }
        } catch (err) {
          console.error(`Failed to fetch info for ${addr}:`, err)
          return {
            address: addr,
            name: `Wallet ${addr.slice(0, 6)}`,
            description: "",
            amount: "0",
            selected: false,
          }
        }
      })

      const wallets = await Promise.all(walletPromises)
      const filteredWallets = wallets.filter(w => w !== null) as Array<{
        address: string;
        name: string;
        description: string;
        amount: string;
        selected: boolean;
      }>;
      console.log("Loaded Merkle fee wallets:", filteredWallets)
      setMerkleFeeWallets(filteredWallets)
    }

    fetchMerkleFeeWalletInfo()
  }, [merkleFeeWalletAddresses, publicClient])

  // Load non-profits from blockchain with full info
  useEffect(() => {
    const fetchNonProfitInfo = async () => {
      if (!publicClient || !approvedNonProfits || (approvedNonProfits as readonly `0x${string}`[]).length === 0) {
        console.log("No non-profits to fetch:", { publicClient: !!publicClient, approvedNonProfits })
        setNonProfits([])
        return
      }

      const addresses = approvedNonProfits as readonly `0x${string}`[]
      console.log("Fetching info for non-profits:", addresses)

      // Fetch non-profit info for each address
      const orgPromises = addresses.map(async (addr) => {
        try {
          const result = await readContract(publicClient, {
            address: CONTRACT_ADDRESSES.ENDOWMENT_MANAGER as `0x${string}`,
            abi: ABIS.ENDOWMENT_MANAGER,
            functionName: 'getNonProfitInfo',
            args: [addr],
          }) as [string, boolean, bigint, string, string, number, bigint, boolean, bigint]

          const [name, approved, totalReceived, description, website, category, addedTimestamp, verified, allocationWeight] = result

          console.log(`Non-profit ${addr} info:`, { name, approved, category, verified })

          // Only include approved non-profits
          if (!approved) {
            console.log(`Skipping non-approved non-profit: ${addr}`)
            return null
          }

          return {
            id: addr,
            name: name || `Organization ${addr.slice(0, 6)}`,
            wallet: addr,
            description: description || "",
            totalReceived: formatUnits(totalReceived, 8),
            verified: verified,
            category: category.toString(),
            website: website || "",
            selected: false,
            amount: "0",
          }
        } catch (err) {
          console.error(`Failed to fetch info for ${addr}:`, err)
          return {
            id: addr,
            name: `Organization ${addr.slice(0, 6)}`,
            wallet: addr,
            description: "",
            totalReceived: "0",
            verified: true,
            category: "0",
            website: "",
            selected: false,
            amount: "0",
          }
        }
      })

      const orgs = await Promise.all(orgPromises)
      const filteredOrgs = orgs.filter(o => o !== null) as NonProfit[]
      console.log("Loaded non-profits:", filteredOrgs)
      setNonProfits(filteredOrgs)
    }

    fetchNonProfitInfo()
  }, [approvedNonProfits, publicClient])

  // Helper function to get user-friendly error message
  const getSimpleErrorMessage = (error: any): string => {
    const errorString = error?.message || error?.toString() || ""

    // User rejected transaction
    if (
      errorString.includes("User rejected") ||
      errorString.includes("user rejected") ||
      errorString.includes("User denied")
    ) {
      return "Transaction cancelled by user"
    }

    // Insufficient funds
    if (
      errorString.includes("insufficient funds") ||
      errorString.includes("Insufficient")
    ) {
      return "Insufficient funds for transaction"
    }

    // Network/connection issues
    if (
      errorString.includes("network") ||
      errorString.includes("Network") ||
      errorString.includes("timeout")
    ) {
      return "Network error - please try again"
    }

    // Contract-specific errors
    if (errorString.includes("already exists")) {
      return "Wallet already exists"
    }

    if (errorString.includes("not found")) {
      return "Wallet not found"
    }

    if (errorString.includes("not authorized") || errorString.includes("Ownable")) {
      return "Not authorized - admin only"
    }

    // Default minimal message
    return "Transaction failed - please try again"
  }

  // Monitor transaction state changes with better UX
  useEffect(() => {
    if (isPending) {
      setTransactionStatus("⏳ Please confirm transaction in your wallet...")
    } else if (isConfirming) {
      setTransactionStatus("🔄 Transaction submitted! Waiting for confirmation...")
    }
  }, [isPending, isConfirming])

  // Monitor write errors with beautiful error messages
  useEffect(() => {
    if (writeError) {
      console.error("❌ Write error detected:", writeError)
      const simpleError = getSimpleErrorMessage(writeError)
      setTransactionStatus(`❌ ${simpleError}`)

      // Clear status after 5 seconds
      const timer = setTimeout(() => setTransactionStatus(""), 5000)
      return () => clearTimeout(timer)
    }
  }, [writeError])

  // Monitor receipt errors
  useEffect(() => {
    if (receiptError) {
      console.error("❌ Receipt error detected:", receiptError)
      const simpleError = getSimpleErrorMessage(receiptError)
      setTransactionStatus(`❌ ${simpleError}`)

      // Clear status after 5 seconds
      const timer = setTimeout(() => setTransactionStatus(""), 5000)
      return () => clearTimeout(timer)
    }
  }, [receiptError])

  // Refetch data when transaction succeeds
  useEffect(() => {
    if (isSuccess) {
      console.log("✅ Transaction succeeded! Refetching all data across all tabs...")

      // Set success message based on transaction type
      const successMessage = transactionType === 'addWallet' ? '✅ Wallet added successfully!' :
                            transactionType === 'removeWallet' ? '✅ Wallet removed successfully!' :
                            transactionType === 'addNonProfit' ? '✅ Organization added successfully!' :
                            transactionType === 'removeNonProfit' ? '✅ Organization removed successfully!' :
                            transactionType === 'devDistribution' ? '✅ Development fees distributed successfully!' :
                            transactionType === 'endowmentDistribution' ? '✅ Endowment distributed successfully!' :
                            transactionType === 'merkleFeeDistribution' ? '✅ Merkle fees distributed successfully!' :
                            '✅ Transaction successful!'

      setTransactionStatus(successMessage)

      // Clear status after 5 seconds
      const statusTimer = setTimeout(() => setTransactionStatus(""), 5000)

      // Update distribution stats if this was a distribution
      if (lastDistributionType === 'dev') {
        const pendingAmount = sessionStorage.getItem('pendingDevDistribution')
        console.log('Dev distribution completed, pending amount:', pendingAmount)
        if (pendingAmount) {
          const amount = parseFloat(pendingAmount)
          setDevDistributionStats((prevStats: { totalDistributed: number; distributionCount: number; }) => {
            const newStats = {
              totalDistributed: prevStats.totalDistributed + amount,
              distributionCount: prevStats.distributionCount + 1
            }
            console.log('Updating Dev Distribution Stats from', prevStats, 'to', newStats)
            localStorage.setItem('devDistributionStats', JSON.stringify(newStats))
            return newStats
          })
          sessionStorage.removeItem('pendingDevDistribution')

          // Reset selected payees and amounts
          setDevPayees(prev => prev.map(p => ({ ...p, selected: false, amount: "0" })))
        }
        setLastDistributionType(null)
      } else if (lastDistributionType === 'endowment') {
        const pendingAmount = sessionStorage.getItem('pendingEndowmentDistribution')
        console.log('Endowment distribution completed, pending amount:', pendingAmount)
        if (pendingAmount) {
          const amount = parseFloat(pendingAmount)
          setEndowmentDistributionStats((prevStats: { totalDistributed: number; distributionCount: number; }) => {
            const newStats = {
              totalDistributed: prevStats.totalDistributed + amount,
              distributionCount: prevStats.distributionCount + 1
            }
            console.log('Updating Endowment Distribution Stats from', prevStats, 'to', newStats)
            localStorage.setItem('endowmentDistributionStats', JSON.stringify(newStats))
            return newStats
          })
          sessionStorage.removeItem('pendingEndowmentDistribution')

          // Reset selected organizations and amounts
          setNonProfits(prev => prev.map(o => ({ ...o, selected: false, amount: "0" })))
        }
        setLastDistributionType(null)
      }

      // Refetch all data in parallel for instant updates across ALL tabs
      const refetchAllData = async () => {
        try {
          console.log("🔄 Starting parallel data refetch for all tabs...")

          // Wait a brief moment for blockchain state to propagate
          await new Promise(resolve => setTimeout(resolve, 1000))

          await Promise.all([
            // Dev Wallet data (Tab 1)
            refetchDevWallets().then(() => console.log("✅ Dev wallets refetched")),
            refetchDevBalance().then(() => console.log("✅ Dev balance refetched")),
            refetchDevWalletStats().then(() => console.log("✅ Dev stats refetched")),
            refetchDevTotalCount().then(() => console.log("✅ Dev count refetched")),

            // Endowment data (Tab 2)
            refetchNonProfits().then(() => console.log("✅ Non-profits refetched")),
            refetchEndowmentBalance().then(() => console.log("✅ Endowment balance refetched")),
            refetchEndowmentWalletStats().then(() => console.log("✅ Endowment stats refetched")),
            refetchEndowmentTotalCount().then(() => console.log("✅ Endowment count refetched")),

            // Merkle Fee Collector data (Tab 3)
            refetchMerkleFeeWallets().then(() => console.log("✅ Merkle wallets refetched")),
            refetchMerkleFeeCollectorBalance().then(() => console.log("✅ Merkle balance refetched")),
            refetchMerkleFeeCollectorStats().then(() => console.log("✅ Merkle stats refetched")),
            refetchMerkleFeeTotalDistributionCount().then(() => console.log("✅ Merkle count refetched")),
          ])

          console.log("✅ All data refetched successfully! All tabs are now up-to-date.")
        } catch (err) {
          console.error("❌ Error during data refetch:", err)
        }
      }

      refetchAllData()

      // Close dialogs and reset forms on success
      if (showAddDevWallet) {
        console.log("Closing dev wallet dialog")
        setShowAddDevWallet(false)
        setNewDevPayee({ name: "", wallet: "", amount: "", description: "" })
      }
      if (showAddNonProfit) {
        console.log("Closing non-profit dialog")
        setShowAddNonProfit(false)
        setProposalForm({ name: "", description: "", wallet: "", category: "Humanitarian", website: "" })
      }
      if (showAddMerkleFeeWallet) {
        console.log("Closing Merkle fee wallet dialog")
        setShowAddMerkleFeeWallet(false)
        setNewDevPayee({ name: "", wallet: "", amount: "", description: "" })
      }

      // Reset transaction type
      setTransactionType(null)

      // Cleanup timer
      return () => clearTimeout(statusTimer)
    }
  }, [isSuccess, refetchDevWallets, refetchNonProfits, refetchDevBalance, refetchEndowmentBalance, refetchDevWalletStats, refetchEndowmentWalletStats, refetchDevTotalCount, refetchEndowmentTotalCount, refetchMerkleFeeWallets, refetchMerkleFeeCollectorBalance, refetchMerkleFeeCollectorStats, refetchMerkleFeeTotalDistributionCount, showAddDevWallet, showAddNonProfit, showAddMerkleFeeWallet, lastDistributionType, transactionType])

  const handleAddDevPayee = () => {
    console.log("handleAddDevPayee called", {
      newDevPayee,
      isConnected,
      address,
      isPending,
      isConfirming,
      isAdmin,
      adminAddress: CONTRACT_ADDRESSES.ADMIN,
    })

    // Validation: Check wallet connection
    if (!isConnected) {
      setTransactionStatus("⚠️ Please connect your wallet first")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    if (!address) {
      setTransactionStatus("⚠️ No wallet address detected. Please reconnect")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    // Debug: Check admin status
    console.log("🔍 Admin Check:", {
      connectedAddress: address,
      configuredAdmin: CONTRACT_ADDRESSES.ADMIN,
      addressesMatch: address?.toLowerCase() === CONTRACT_ADDRESSES.ADMIN?.toLowerCase(),
      isAdmin: isAdmin,
      devWalletContract: CONTRACT_ADDRESSES.DEV_WALLET,
    })

    // Validation: Check required fields
    if (!newDevPayee.name?.trim()) {
      setTransactionStatus("⚠️ Wallet name is required")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    if (!newDevPayee.wallet?.trim()) {
      setTransactionStatus("⚠️ Wallet address is required")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    // Validation: Check name length
    if (newDevPayee.name.length > 100) {
      setTransactionStatus("⚠️ Wallet name too long (max 100 characters)")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    // Validation: Check wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(newDevPayee.wallet)) {
      setTransactionStatus("⚠️ Invalid wallet address format")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    // Validation: Check if trying to add zero address
    if (newDevPayee.wallet.toLowerCase() === "0x0000000000000000000000000000000000000000") {
      setTransactionStatus("⚠️ Cannot add zero address")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    // Validation: Check if wallet already exists in the list
    if (devPayees.some(p => p.wallet.toLowerCase() === newDevPayee.wallet.toLowerCase())) {
      setTransactionStatus("⚠️ Wallet already exists in the list")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    console.log("✅ Validation passed. Calling writeContract for DevWallet.addWallet", {
      devWalletAddress: CONTRACT_ADDRESSES.DEV_WALLET,
      args: [newDevPayee.wallet, newDevPayee.name, newDevPayee.description || ""],
    })

    // Safe Integration: Check if user has UI access
    const uiControllerAddress = process.env.NEXT_PUBLIC_UI_CONTROLLER || 
      process.env.NEXT_PUBLIC_ADMIN_WALLET || 
      "0xA1D4de75082562eA776b160e605acD587668111B"
    const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS || uiControllerAddress
    
    const hasUIAccess = address?.toLowerCase() === uiControllerAddress.toLowerCase()
    const isSafeConnected = address?.toLowerCase() === safeAddress.toLowerCase()
    
    if (!hasUIAccess && !isSafeConnected) {
      setTransactionStatus(`❌ Access Denied: Only authorized addresses can add wallets`)
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }
    
    // If UI Controller is connected but not Safe, show modal with transaction data
    if (hasUIAccess && !isSafeConnected && safeAddress !== uiControllerAddress) {
      console.log('=== DEV WALLET SAFE TRANSACTION ===');
      console.log('Contract Address:', CONTRACT_ADDRESSES.DEV_WALLET);
      console.log('Function: addWallet(address,string,string)');
      console.log('Parameters:', newDevPayee);
      
      setShowDevWalletSafeModal(true)
      return
    }

    // Set transaction type for success message
    setTransactionType('addWallet')

    try {
      writeContract({
        address: CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`,
        abi: ABIS.DEV_WALLET,
        functionName: "addWallet",
        args: [
          newDevPayee.wallet as `0x${string}`,
          newDevPayee.name,
          newDevPayee.description || "",
        ],
      })
      
      console.log("✅ writeContract call initiated successfully")
    } catch (error) {
      console.error("❌ Failed to initiate transaction:", error)
      
      // Enhanced error handling
      const errorMessage = getSimpleErrorMessage(error)
      if (errorMessage.includes("Not authorized")) {
        setTransactionStatus(`❌ ${errorMessage}. Connected wallet: ${address?.slice(0, 6)}...${address?.slice(-4)}. Required owner of DevWallet contract.`)
      } else {
        setTransactionStatus(`❌ ${errorMessage}`)
      }
      
      setTimeout(() => setTransactionStatus(""), 8000)
    }
  }

  const handleRemoveDevPayee = (id: string) => {
    if (!confirm("Are you sure you want to remove this dev wallet?")) {
      return
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`,
        abi: ABIS.DEV_WALLET,
        functionName: "removeWallet",
        args: [id as `0x${string}`],
      })
    } catch (err) {
      console.error("Failed to remove dev wallet:", err)
      alert("Failed to remove dev wallet. Please check the console for details.")
    }
  }

  const handleToggleDevPayee = (id: string) => {
    setDevPayees(devPayees.map((payee) => (payee.id === id ? { ...payee, selected: !payee.selected } : payee)))
  }

  const handleDevPayeeAmountChange = (id: string, amount: string) => {
    setDevPayees(devPayees.map((payee) => (payee.id === id ? { ...payee, amount: amount } : payee)))
  }

  const handleDevPayment = () => {
    // Validation: Check wallet connection
    if (!isConnected || !address) {
      setTransactionStatus("⚠️ Please connect your wallet first")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    const selectedPayees = devPayees.filter((payee) => payee.selected)

    // Validation: Check if at least one recipient is selected
    if (selectedPayees.length === 0) {
      setTransactionStatus("⚠️ Please select at least one recipient")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    // Validation: Check if all selected payees have amounts
    const hasEmptyAmounts = selectedPayees.some(payee => !payee.amount || Number.parseFloat(payee.amount) <= 0)
    if (hasEmptyAmounts) {
      setTransactionStatus("⚠️ Please enter valid amounts for all selected recipients")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    const totalAmount = selectedPayees.reduce((sum, payee) => sum + Number.parseFloat(payee.amount || "0"), 0)

    // Validation: Check total amount
    if (totalAmount <= 0) {
      setTransactionStatus("⚠️ Total amount must be greater than zero")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    // Validation: Check if total amount exceeds available balance
    const tokenAddressMap: Record<string, string> = {
      'BTC1': CONTRACT_ADDRESSES.BTC1USD,
      'WBTC': CONTRACT_ADDRESSES.WBTC_TOKEN,
      'cbBTC': CONTRACT_ADDRESSES.CBBTC_TOKEN,
      'tBTC': CONTRACT_ADDRESSES.TBTC_TOKEN,
    }

    const tokenAddress = tokenAddressMap[selectedToken]
    const tokenBalanceMap: Record<string, bigint | undefined> = {
      'BTC1': devWalletBalance,
      'WBTC': devWalletWbtcBalance,
      'cbBTC': devWalletCbbtcBalance,
      'tBTC': devWalletTbtcBalance,
    }

    const currentBalance = tokenBalanceMap[selectedToken]
    const devBalance = currentBalance ? Number.parseFloat(formatUnits(currentBalance as bigint, 8)) : 0
    
    if (totalAmount > devBalance) {
      setTransactionStatus(`⚠️ Insufficient balance! Need ${totalAmount.toFixed(2)} ${selectedToken} but only ${devBalance.toFixed(2)} available`)
      setTimeout(() => setTransactionStatus(""), 5000)
      return
    }

    // Prepare batch transfer data
    const recipients = selectedPayees.map(payee => payee.wallet as `0x${string}`)
    const amounts = selectedPayees.map(payee => parseUnits(payee.amount || "0", 8)) // All tokens use 8 decimals

    console.log("✅ Validation passed. Distributing development fees:", {
      recipients: selectedPayees.length,
      totalAmount: `${totalAmount.toFixed(2)} ${selectedToken}`,
      availableBalance: `${devBalance.toFixed(2)} ${selectedToken}`,
      tokenAddress
    })

    // Safe Integration: Check if user has UI access
    const uiControllerAddress = process.env.NEXT_PUBLIC_UI_CONTROLLER || 
      process.env.NEXT_PUBLIC_ADMIN_WALLET || 
      "0xA1D4de75082562eA776b160e605acD587668111B"
    const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS || uiControllerAddress
    
    const hasUIAccess = address?.toLowerCase() === uiControllerAddress.toLowerCase()
    const isSafeConnected = address?.toLowerCase() === safeAddress.toLowerCase()
    
    if (!hasUIAccess && !isSafeConnected) {
      setTransactionStatus(`❌ Access Denied: Only authorized addresses can distribute dev fees`)
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }
    
    // If UI Controller is connected but not Safe, show modal with transaction data
    if (hasUIAccess && !isSafeConnected && safeAddress !== uiControllerAddress) {
      console.log('=== DEV FEE DISTRIBUTION SAFE TRANSACTION ===');
      console.log('Contract Address:', CONTRACT_ADDRESSES.DEV_WALLET);
      console.log('Function: batchTransfer(address,address[],uint256[])');
      console.log('Selected Payees:', selectedPayees);
      console.log('Total Amount:', totalAmount);
      
      setShowDevDistributionSafeModal(true)
      return
    }

    try {
      // Set distribution type and amount for tracking
      setLastDistributionType('dev')
      setTransactionType('devDistribution')
      sessionStorage.setItem('pendingDevDistribution', totalAmount.toString())

      // Call batchTransfer on DevWallet contract
      writeContract({
        address: CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`,
        abi: ABIS.DEV_WALLET,
        functionName: "batchTransfer",
        args: [
          tokenAddress as `0x${string}`,
          recipients,
          amounts,
        ],
      })
    } catch (err) {
      console.error("Failed to initiate transaction:", err)
      setTransactionStatus(`❌ ${getSimpleErrorMessage(err)}`)
      setTimeout(() => setTransactionStatus(""), 5000)
    }
  }

  // Merkle Fee Wallet functions

  const handleRemoveMerkleFeeWallet = (address: string) => {
    if (!confirm("Are you sure you want to remove this Merkle fee wallet?")) {
      return
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR as `0x${string}`,
        abi: ABIS.MERKLE_FEE_COLLECTOR,
        functionName: "removeWallet",
        args: [address as `0x${string}`],
      })
    } catch (err) {
      console.error("Failed to remove Merkle fee wallet:", err)
      alert("Failed to remove Merkle fee wallet. Please check the console for details.")
    }
  }

  const handleToggleMerkleFeeWallet = (address: string) => {
    setMerkleFeeWallets(merkleFeeWallets.map((wallet) => (wallet.address === address ? { ...wallet, selected: !wallet.selected } : wallet)))
  }

  const handleMerkleFeeWalletAmountChange = (address: string, amount: string) => {
    setMerkleFeeWallets(merkleFeeWallets.map((wallet) => (wallet.address === address ? { ...wallet, amount: amount } : wallet)))
  }

  const handleMerkleFeePayment = () => {
    const selectedWallets = merkleFeeWallets.filter((wallet) => wallet.selected)
    if (selectedWallets.length === 0) {
      alert("Please select at least one recipient.")
      return
    }

    const totalAmount = selectedWallets.reduce((sum, wallet) => sum + Number.parseFloat(wallet.amount || "0"), 0)
    if (totalAmount <= 0) {
      alert("Total amount must be greater than zero.")
      return
    }

    // Check if total amount exceeds available balance
    const merkleFeeBalance = merkleFeeCollectorBalance ? Number.parseFloat(formatUnits(merkleFeeCollectorBalance as bigint, 8)) : 0
    if (totalAmount > merkleFeeBalance) {
      alert(`Insufficient balance! Total amount (${totalAmount.toFixed(2)} BTC1) exceeds available Merkle Fee Collector balance (${merkleFeeBalance.toFixed(2)} BTC1).`)
      return
    }

    // Prepare batch transfer data
    const recipients = selectedWallets.map(wallet => wallet.address as `0x${string}`)
    const amounts = selectedWallets.map(wallet => parseUnits(wallet.amount || "0", 8)) // BTC1USD uses 8 decimals

    // Safe Integration: Check if user has UI access
    const uiControllerAddress = process.env.NEXT_PUBLIC_UI_CONTROLLER || 
      process.env.NEXT_PUBLIC_ADMIN_WALLET || 
      "0xA1D4de75082562eA776b160e605acD587668111B"
    const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS || uiControllerAddress
    
    const hasUIAccess = address?.toLowerCase() === uiControllerAddress.toLowerCase()
    const isSafeConnected = address?.toLowerCase() === safeAddress.toLowerCase()
    
    if (!hasUIAccess && !isSafeConnected) {
      alert(`Access Denied: Only authorized addresses can distribute Merkle fees`)
      return
    }
    
    // If UI Controller is connected but not Safe, show modal with transaction data
    if (hasUIAccess && !isSafeConnected && safeAddress !== uiControllerAddress) {
      console.log('=== MERKLE FEE DISTRIBUTION SAFE TRANSACTION ===');
      console.log('Contract Address:', CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR);
      console.log('Function: batchTransfer(address,address[],uint256[])');
      console.log('Selected Wallets:', selectedWallets);
      console.log('Total Amount:', totalAmount);
      
      setShowMerkleFeeDistributionSafeModal(true)
      return
    }

    try {
      // Call batchTransfer on MerkleFeeCollector contract
      writeContract({
        address: CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR as `0x${string}`,
        abi: ABIS.MERKLE_FEE_COLLECTOR,
        functionName: "batchTransfer",
        args: [
          CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
          recipients,
          amounts,
        ],
      })
    } catch (err) {
      console.error("Failed to initiate transaction:", err)
      alert("Failed to initiate transaction. Please check the console for details.")
    }
  }

  const handleAddMerkleFeeWallet = () => {
    console.log("handleAddMerkleFeeWalletToContract called", {
      newDevPayee,
      isConnected,
      address,
      isPending,
      isConfirming,
      writeError,
      hash
    })

    if (!isConnected) {
      alert("Please connect your wallet first.")
      return
    }

    if (!address) {
      alert("No wallet address detected. Please reconnect your wallet.")
      return
    }

    if (!newDevPayee.name || !newDevPayee.wallet) {
      alert("Please provide both name and wallet address for the recipient.")
      return
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(newDevPayee.wallet)) {
      alert("Invalid wallet address format. Please enter a valid Ethereum address.")
      return
    }

    console.log("Calling writeContract for MerkleFeeCollector.addWallet", {
      merkleFeeCollectorAddress: CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR,
      args: [newDevPayee.wallet, newDevPayee.name, newDevPayee.description || ""],
      abi: ABIS.MERKLE_FEE_COLLECTOR
    })

    // Safe Integration: Check if user has UI access
    const uiControllerAddress = process.env.NEXT_PUBLIC_UI_CONTROLLER || 
      process.env.NEXT_PUBLIC_ADMIN_WALLET || 
      "0xA1D4de75082562eA776b160e605acD587668111B"
    const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS || uiControllerAddress
    
    const hasUIAccess = address?.toLowerCase() === uiControllerAddress.toLowerCase()
    const isSafeConnected = address?.toLowerCase() === safeAddress.toLowerCase()
    
    if (!hasUIAccess && !isSafeConnected) {
      alert(`Access Denied: Only authorized addresses can add Merkle Fee wallets`)
      return
    }
    
    // If UI Controller is connected but not Safe, show modal with transaction data
    if (hasUIAccess && !isSafeConnected && safeAddress !== uiControllerAddress) {
      console.log('=== MERKLE FEE WALLET SAFE TRANSACTION ===');
      console.log('Contract Address:', CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR);
      console.log('Function: addWallet(address,string,string)');
      console.log('Parameters:', newDevPayee);
      
      setShowMerkleFeeWalletSafeModal(true)
      return
    }

    writeContract({
      address: CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR as `0x${string}`,
      abi: ABIS.MERKLE_FEE_COLLECTOR,
      functionName: "addWallet",
      args: [
        newDevPayee.wallet as `0x${string}`,
        newDevPayee.name,
        newDevPayee.description || "",
      ],
    })

    console.log("writeContract called, waiting for user confirmation...")
  }

  const handleAddNonProfit = () => {
    if (!newNonProfit.name || !newNonProfit.wallet) {
      alert("Please provide both name and wallet address for the organization.")
      return
    }
    const newOrg: NonProfit = {
      ...newNonProfit,
      id: Date.now().toString(),
      selected: false,
      amount: "0",
      totalReceived: "0",
      verified: false,
    }
    setNonProfits([...nonProfits, newOrg])
    setNewNonProfit({ name: "", wallet: "", amount: "", description: "", category: "Humanitarian", website: "" })
    setShowAddNonProfit(false)
  }

  const handleRemoveNonProfit = (id: string) => {
    if (!confirm("Are you sure you want to remove this organization?")) {
      return
    }

    // Find the organization by id to get its wallet address
    const org = nonProfits.find(org => org.id === id);
    if (!org) {
      alert("Organization not found.");
      return;
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESSES.ENDOWMENT_MANAGER as `0x${string}`,
        abi: ABIS.ENDOWMENT_MANAGER,
        functionName: "removeNonProfit",
        args: [org.wallet as `0x${string}`],
      })
    } catch (err) {
      console.error("Failed to remove organization:", err)
      alert("Failed to remove organization. Please check the console for details.")
    }
  }

  const handleToggleNonProfit = (id: string) => {
    setNonProfits(nonProfits.map((org) => (org.id === id ? { ...org, selected: !org.selected } : org)))
  }

  const handleNonProfitAmountChange = (id: string, amount: string) => {
    setNonProfits(nonProfits.map((org) => (org.id === id ? { ...org, amount: amount } : org)))
  }

  const handleEndowmentPayment = () => {
    // Validation: Check wallet connection
    if (!isConnected || !address) {
      setTransactionStatus("⚠️ Please connect your wallet first")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    const selectedOrgs = nonProfits.filter((org) => org.selected)

    // Validation: Check if at least one organization is selected
    if (selectedOrgs.length === 0) {
      setTransactionStatus("⚠️ Please select at least one organization")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    // Validation: Check if all selected organizations have amounts
    const hasEmptyAmounts = selectedOrgs.some(org => !org.amount || Number.parseFloat(org.amount) <= 0)
    if (hasEmptyAmounts) {
      setTransactionStatus("⚠️ Please enter valid amounts for all selected organizations")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    const totalAmount = selectedOrgs.reduce((sum, org) => sum + Number.parseFloat(org.amount || "0"), 0)

    // Validation: Check total amount
    if (totalAmount <= 0) {
      setTransactionStatus("⚠️ Total amount must be greater than zero")
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }

    // Validation: Check if total amount exceeds available balance
    const endowmentBalance = endowmentWalletBalance ? Number.parseFloat(formatUnits(endowmentWalletBalance as bigint, 8)) : 0
    if (totalAmount > endowmentBalance) {
      setTransactionStatus(`⚠️ Insufficient balance! Need ${totalAmount.toFixed(2)} BTC1 but only ${endowmentBalance.toFixed(2)} available`)
      setTimeout(() => setTransactionStatus(""), 5000)
      return
    }

    // Prepare batch transfer data
    const recipients = selectedOrgs.map(org => org.wallet as `0x${string}`)
    const amounts = selectedOrgs.map(org => parseUnits(org.amount || "0", 8)) // BTC1USD uses 8 decimals

    console.log("✅ Validation passed. Distributing endowment:", {
      organizations: selectedOrgs.length,
      totalAmount: `${totalAmount.toFixed(2)} BTC1`,
      availableBalance: `${endowmentBalance.toFixed(2)} BTC1`
    })

    try {
      // Set distribution type and amount for tracking
      setLastDistributionType('endowment')
      setTransactionType('endowmentDistribution')
      sessionStorage.setItem('pendingEndowmentDistribution', totalAmount.toString())

      // Call batchTransfer on EndowmentWallet contract
      writeContract({
        address: CONTRACT_ADDRESSES.ENDOWMENT_WALLET as `0x${string}`,
        abi: ABIS.ENDOWMENT_WALLET,
        functionName: "batchTransfer",
        args: [
          CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
          recipients,
          amounts,
        ],
      })
    } catch (err) {
      console.error("Failed to initiate transaction:", err)
      setTransactionStatus(`❌ ${getSimpleErrorMessage(err)}`)
      setTimeout(() => setTransactionStatus(""), 5000)
    }
  }

  const handleExecuteDistribution = () => {
    if (!stats?.canDistribute) {
      alert("Distributions are not ready to be executed.")
      return
    }

    // Safe Integration: Check if user has UI access
    const uiControllerAddress = process.env.NEXT_PUBLIC_UI_CONTROLLER || 
      process.env.NEXT_PUBLIC_ADMIN_WALLET || 
      "0xA1D4de75082562eA776b160e605acD587668111B"
    const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS || uiControllerAddress
    
    const hasUIAccess = address?.toLowerCase() === uiControllerAddress.toLowerCase()
    const isSafeConnected = address?.toLowerCase() === safeAddress.toLowerCase()
    
    if (!hasUIAccess && !isSafeConnected) {
      alert(`Access Denied: Only authorized addresses can execute endowment distribution`)
      return
    }
    
    // If UI Controller is connected but not Safe, show modal with transaction data
    if (hasUIAccess && !isSafeConnected && safeAddress !== uiControllerAddress) {
      console.log('=== ENDOWMENT DISTRIBUTION SAFE TRANSACTION ===');
      console.log('Contract Address:', CONTRACT_ADDRESSES.ENDOWMENT_MANAGER);
      console.log('Function: executeMonthlyDistribution()');
      
      setShowEndowmentDistributionSafeModal(true)
      return
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESSES.ENDOWMENT_MANAGER as `0x${string}`,
        abi: ABIS.ENDOWMENT_MANAGER,
        functionName: "executeMonthlyDistribution",
        args: [],
      })
    } catch (err) {
      console.error("Failed to initiate transaction:", err)
      alert("Failed to initiate transaction. Please check the console for details.")
    }
  }

  const handleAddNonProfitToContract = () => {
    if (!proposalForm.name || !proposalForm.description || !proposalForm.wallet || !proposalForm.category) {
      alert("Please fill in all required fields.")
      return
    }

    // Safe Integration: Check if user has UI access
    const uiControllerAddress = process.env.NEXT_PUBLIC_UI_CONTROLLER || 
      process.env.NEXT_PUBLIC_ADMIN_WALLET || 
      "0xA1D4de75082562eA776b160e605acD587668111B"
    const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS || uiControllerAddress
    
    const hasUIAccess = address?.toLowerCase() === uiControllerAddress.toLowerCase()
    const isSafeConnected = address?.toLowerCase() === safeAddress.toLowerCase()
    
    if (!hasUIAccess && !isSafeConnected) {
      setTransactionStatus(`❌ Access Denied: Only authorized addresses can add non-profits`)
      setTimeout(() => setTransactionStatus(""), 3000)
      return
    }
    
    // If UI Controller is connected but not Safe, show modal with transaction data
    if (hasUIAccess && !isSafeConnected && safeAddress !== uiControllerAddress) {
      console.log('=== NON-PROFIT SAFE TRANSACTION ===');
      console.log('Contract Address:', CONTRACT_ADDRESSES.ENDOWMENT_MANAGER);
      console.log('Function:', isAdmin ? 'addNonProfit' : 'proposeNonProfit');
      console.log('Parameters:', proposalForm);
      
      setShowNonProfitSafeModal(true)
      return
    }

    try {
      // Submit the proposal or add non-profit directly
      writeContract({
        address: CONTRACT_ADDRESSES.ENDOWMENT_MANAGER as `0x${string}`,
        abi: ABIS.ENDOWMENT_MANAGER,
        functionName: isAdmin ? "addNonProfit" : "proposeNonProfit",
        args: [
          proposalForm.wallet as `0x${string}`,
          proposalForm.name,
          proposalForm.description,
          proposalForm.website || "",
          ENDOWMENT_CATEGORIES[proposalForm.category as keyof typeof ENDOWMENT_CATEGORIES],
        ],
      })
    } catch (err) {
      console.error("Failed to submit proposal:", err)
      alert("Failed to submit proposal. Please check the console for details.")
    }
  }

  const handleVoteOnProposal = (proposalId: number, vote: boolean) => {
    try {
      writeContract({
        address: CONTRACT_ADDRESSES.ENDOWMENT_MANAGER as `0x${string}`,
        abi: ABIS.ENDOWMENT_MANAGER,
        functionName: "voteOnProposal",
        args: [BigInt(proposalId), vote],
      })
    } catch (err) {
      console.error("Failed to cast vote:", err)
      alert("Failed to cast vote. Please check the console for details.")
    }
  }

  const handleExecuteProposal = (proposalId: number) => {
    try {
      writeContract({
        address: CONTRACT_ADDRESSES.ENDOWMENT_MANAGER as `0x${string}`,
        abi: ABIS.ENDOWMENT_MANAGER,
        functionName: "executeProposal",
        args: [BigInt(proposalId)],
      })
    } catch (err) {
      console.error("Failed to initiate transaction:", err)
      alert("Failed to initiate transaction. Please check the console for details.")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Beautiful Transaction Status Banner */}
        {transactionStatus && (
          <div
            className={`
              fixed top-4 left-1/2 transform -translate-x-1/2 z-50
              w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl
              px-4 py-3 sm:px-6 sm:py-4 rounded-xl shadow-2xl backdrop-blur-md
              border-2 animate-in slide-in-from-top duration-300
              ${
                transactionStatus.includes('✅')
                  ? 'bg-gradient-to-r from-emerald-500/90 to-emerald-600/90 border-emerald-400 text-white'
                  : transactionStatus.includes('❌')
                  ? 'bg-gradient-to-r from-red-500/90 to-red-600/90 border-red-400 text-white'
                  : transactionStatus.includes('⚠️')
                  ? 'bg-gradient-to-r from-yellow-500/90 to-yellow-600/90 border-yellow-400 text-white'
                  : transactionStatus.includes('⏳') || transactionStatus.includes('🔄')
                  ? 'bg-gradient-to-r from-blue-500/90 to-blue-600/90 border-blue-400 text-white'
                  : 'bg-gradient-to-r from-gray-700/90 to-gray-800/90 border-gray-600 text-white'
              }
            `}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                {(transactionStatus.includes('⏳') || transactionStatus.includes('🔄')) && (
                  <div className="w-5 h-5 border-3 border-current border-t-transparent rounded-full animate-spin"></div>
                )}
                <p className="font-semibold text-base">{transactionStatus}</p>
              </div>
              <button
                onClick={() => setTransactionStatus("")}
                className="text-white/80 hover:text-white transition-colors p-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 bg-transparent p-0">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=inactive]:bg-gray-800 data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:bg-gray-700 transition-all duration-200 py-3 rounded-lg border border-border/50 shadow-md hover:shadow-lg font-semibold text-sm min-h-[50px]"
            >
              <Target className="h-4 w-4 mr-2" />
              <span className="whitespace-nowrap">Overview</span>
            </TabsTrigger>
            <TabsTrigger
              value="dev-fee"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-orange-700 data-[state=active]:text-white data-[state=inactive]:bg-gray-800 data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:bg-gray-700 transition-all duration-200 py-3 rounded-lg border border-border/50 shadow-md hover:shadow-lg font-semibold text-sm min-h-[50px]"
            >
              <Wallet className="h-4 w-4 mr-2" />
              <span className="whitespace-nowrap">Development Fee</span>
            </TabsTrigger>
            <TabsTrigger
              value="endowment"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-pink-500 data-[state=active]:to-pink-700 data-[state=active]:text-white data-[state=inactive]:bg-gray-800 data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:bg-gray-700 transition-all duration-200 py-3 rounded-lg border border-border/50 shadow-md hover:shadow-lg font-semibold text-sm min-h-[50px]"
            >
              <Heart className="h-4 w-4 mr-2" />
              <span className="whitespace-nowrap">Endowment</span>
            </TabsTrigger>
            <TabsTrigger
              value="merkle-fee"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-yellow-500 data-[state=active]:to-yellow-700 data-[state=active]:text-white data-[state=inactive]:bg-gray-800 data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:bg-gray-700 transition-all duration-200 py-3 rounded-lg border border-border/50 shadow-md hover:shadow-lg font-semibold text-sm min-h-[50px]"
            >
              <Coins className="h-4 w-4 mr-2" />
              <span className="whitespace-nowrap">Merkle Fee</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Simplified Treasury Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Dev Fee Overview */}
              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2 text-lg">
                    <Wallet className="h-5 w-5 text-orange-500" />
                    Development Wallet
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-400">
                    Manage development fee distributions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                      <div className="font-medium text-white">
                        Active Recipients
                      </div>
                      <Badge variant="outline" className="border-orange-500 text-orange-500">
                        {devPayees.length}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => setActiveTab("dev-fee")}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm sm:text-base py-2 px-4 relative z-10"
                    >
                      Manage Dev Fees
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Endowment Overview */}
              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2 text-lg">
                    <Heart className="h-5 w-5 text-pink-500" />
                    Endowment Wallet
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-400">
                    Manage endowment distributions to non-profits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                      <div className="font-medium text-white">
                        Registered Organizations
                      </div>
                      <Badge variant="outline" className="border-pink-500 text-pink-500">
                        {nonProfits.length}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => setActiveTab("endowment")}
                      className="w-full bg-pink-500 hover:bg-pink-600 text-white text-sm sm:text-base py-2 px-4"
                    >
                      Manage Endowment
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Merkle Fee Overview */}
              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2 text-lg">
                    <Coins className="h-5 w-5 text-yellow-500" />
                    Merkle Fee Wallet
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-400">
                    Manage Merkle fee distributions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                      <div className="font-medium text-white">
                        Active Recipients
                      </div>
                      <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                        {merkleFeeWallets ? merkleFeeWallets.length : 0}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => setActiveTab("merkle-fee")}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white text-sm sm:text-base py-2 px-4"
                    >
                      Manage Merkle Fees
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="dev-fee" className="space-y-4 mt-4">
            {/* Dev Fee Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">
                    Balance
                  </CardTitle>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                    <Coins className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {devWalletBalance ? Number.parseFloat(formatUnits(devWalletBalance as bigint, 8)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">BTC1</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">
                    Active Recipients
                  </CardTitle>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl sm:text-3xl font-bold text-white">{devPayees.length}</div>
                  <p className="text-xs text-gray-400 mt-1">Wallets</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">
                    Total Distributed
                  </CardTitle>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl sm:text-3xl font-bold text-white">
                    {devWalletStats ? (
                      Number.parseFloat(formatUnits(devWalletStats[1] as bigint, 8)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    ) : (
                      '0.00'
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">BTC1</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">
                    Distributions
                  </CardTitle>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl sm:text-3xl font-bold text-white">
                    {devTotalDistributionCount ? Number(devTotalDistributionCount) : 0}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Completed</p>
                </CardContent>
              </Card>
            </div>

            {/* Dev Fee Actions */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-semibold text-white">Development Wallets</h3>
              <Button
                onClick={() => setShowAddDevWallet(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white shadow-md text-sm sm:text-base"
                disabled={!isConnected}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Dev Wallet
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Dev Wallets List with Distribution */}
              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <Wallet className="h-5 w-5 text-orange-500" />
                    Select Recipients
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-400">
                    Choose wallets to receive development fees
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 max-h-96 overflow-y-auto p-3 border border-gray-600 rounded-lg bg-gray-700/30">
                    {devPayees.map((payee) => (
                      <div
                        key={payee.id}
                        className="flex items-start space-x-3 p-3 hover:bg-gray-700/50 rounded-lg"
                      >
                        <Checkbox
                          id={`dev-${payee.id}`}
                          checked={payee.selected}
                          onCheckedChange={() => handleToggleDevPayee(payee.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <Label htmlFor={`dev-${payee.id}`} className="font-medium text-white cursor-pointer text-sm sm:text-base">
                            {payee.name}
                          </Label>
                          <div className="text-xs text-gray-400 truncate font-mono">
                            {payee.wallet}
                          </div>
                          {payee.description && (
                            <div className="text-xs text-gray-400 mt-1">
                              {payee.description}
                            </div>
                          )}
                          <Input
                            type="number"
                            placeholder={`Amount (${selectedToken})`}
                            value={payee.amount}
                            onChange={(e) => handleDevPayeeAmountChange(payee.id, e.target.value)}
                            className="w-32 text-sm mt-2 bg-gray-700 border-gray-600 text-white"
                            step="0.01"
                            min="0"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDevPayee(payee.id)}
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {devPayees.length === 0 && (
                      <div className="text-center text-gray-400 py-6 text-sm">
                        No development wallets added yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Dev Fee Distribution Form */}
              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <Send className="h-5 w-5 text-orange-500" />
                    Distribute Funds
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-400">
                    Execute batch transfer from Dev Wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Token Selection */}
                  <div className="p-4 bg-gradient-to-br from-gray-700/50 to-gray-800/50 border border-gray-600 rounded-lg">
                    <Label className="text-sm font-medium text-gray-300 mb-2 block">
                      Select Token
                    </Label>
                    <select
                      value={selectedToken}
                      onChange={(e) => setSelectedToken(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="BTC1">BTC1 (BTC1USD)</option>
                      <option value="WBTC">WBTC (Wrapped Bitcoin)</option>
                      <option value="cbBTC">cbBTC (Coinbase BTC)</option>
                      <option value="tBTC">tBTC (Threshold BTC)</option>
                    </select>
                  </div>

                  {/* Available Balance Display */}
                  <div className="p-4 bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-lg">
                    <Label className="text-sm font-medium text-gray-300">
                      Available Balance
                    </Label>
                    <div className="text-2xl font-bold text-orange-400 mt-1">
                      {selectedToken === 'BTC1' && devWalletBalance ? Number.parseFloat(formatUnits(devWalletBalance as bigint, 8)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : 
                       selectedToken === 'WBTC' && devWalletWbtcBalance ? Number.parseFloat(formatUnits(devWalletWbtcBalance as bigint, 8)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) :
                       selectedToken === 'cbBTC' && devWalletCbbtcBalance ? Number.parseFloat(formatUnits(devWalletCbbtcBalance as bigint, 8)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) :
                       selectedToken === 'tBTC' && devWalletTbtcBalance ? Number.parseFloat(formatUnits(devWalletTbtcBalance as bigint, 8)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '0.0000'}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedToken} in Dev Wallet
                    </p>
                  </div>

                  {/* Total Amount Display */}
                  <div className="space-y-2 p-4 rounded-lg bg-gray-700/30 border border-gray-600">
                    <Label className="text-sm font-medium text-gray-300">
                      Total Distribution Amount
                    </Label>
                    <div className="text-3xl font-bold text-orange-500">
                      {devPayees
                        .filter((payee) => payee.selected)
                        .reduce((total, payee) => total + (Number.parseFloat(payee.amount) || 0), 0)
                        .toFixed(2)}
                    </div>
                    <p className="text-xs text-gray-400">
                      Sum of all selected wallets' amounts
                    </p>
                  </div>

                  {/* Selected Recipients Count */}
                  <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                    <div className="text-sm text-gray-300">
                      Selected Recipients
                    </div>
                    <Badge variant="outline" className="border-orange-500 text-orange-500">
                      {devPayees.filter(p => p.selected).length}
                    </Badge>
                  </div>

                  <Button
                    onClick={handleDevPayment}
                    disabled={!isConnected || isPending || isConfirming}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 text-sm sm:text-base relative z-10"
                  >
                    {isPending || isConfirming ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Distribute Dev Fees
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-400 text-center">
                    Uses batch transfer from Dev Wallet contract
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="endowment" className="space-y-4 mt-4">
            {/* Endowment Stats Overview - Matching Overview Tab Style */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      Balance
                    </CardTitle>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center">
                      <Coins className="h-5 w-5 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">
                      {Number.parseFloat(stats.balance || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">BTC1</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      Total Distributed
                    </CardTitle>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl sm:text-3xl font-bold text-white">
                      {endowmentWalletStats ? (
                        Number.parseFloat(formatUnits(endowmentWalletStats[1] as bigint, 8)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      ) : (
                        '0.00'
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">BTC1</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      Organizations
                    </CardTitle>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <Building className="h-5 w-5 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl sm:text-3xl font-bold text-white">{nonProfits.length}</div>
                    <p className="text-xs text-gray-400 mt-1">Active</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      Distributions
                    </CardTitle>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl sm:text-3xl font-bold text-white">
                      {endowmentTotalDistributionCount ? Number(endowmentTotalDistributionCount) : 0}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Completed</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-semibold text-white">Non-Profit Organizations</h3>
              <div className="flex flex-wrap gap-2">
                {isAdmin && stats?.canDistribute && (
                  <Button
                    onClick={handleExecuteDistribution}
                    className="bg-pink-500 hover:bg-pink-600 text-white shadow-md text-sm sm:text-base"
                    disabled={!isConnected || isConfirming}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Execute Distribution
                  </Button>
                )}
                <Button
                  onClick={() => setShowAddNonProfit(true)}
                  className="bg-pink-500 hover:bg-pink-600 text-white shadow-md text-sm sm:text-base"
                  disabled={!isConnected}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isAdmin ? "Add Non-Profit" : "Propose"}
                </Button>
              </div>
            </div>

            {/* Organizations Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Organizations List with Selection */}
              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <Building className="h-5 w-5 text-pink-500" />
                    Select Organizations
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-400">
                    Choose organizations to receive endowment funds
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 max-h-96 overflow-y-auto p-3 border border-gray-600 rounded-lg bg-gray-700/30">
                    {nonProfits.map((org) => {
                      const categoryId = Object.keys(ENDOWMENT_CATEGORIES).findIndex(
                        (key) =>
                          ENDOWMENT_CATEGORIES[key as keyof typeof ENDOWMENT_CATEGORIES].toString() === org.category,
                      )
                      const categoryName = getCategoryById(categoryId)
                      const categoryColor = getCategoryColor(categoryName)

                      return (
                        <div
                          key={org.id}
                          className="flex items-start space-x-3 p-3 hover:bg-gray-700/50 rounded-lg border border-gray-600/50"
                        >
                          <Checkbox
                            id={`org-${org.id}`}
                            checked={org.selected}
                            onCheckedChange={() => handleToggleNonProfit(org.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`org-${org.id}`} className="font-medium text-white cursor-pointer">
                                {org.name}
                              </Label>
                              {org.verified && <CheckCircle className="w-3 h-3 text-green-500" />}
                              <Badge className={`${categoryColor} text-white text-xs`}>
                                {categoryName}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-400 truncate font-mono mt-1">
                              {org.wallet}
                            </div>
                            {org.description && (
                              <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                                {org.description}
                              </div>
                            )}
                            <Input
                              type="number"
                              placeholder="Amount (BTC1)"
                              value={org.amount}
                              onChange={(e) => handleNonProfitAmountChange(org.id, e.target.value)}
                              className="w-32 text-sm mt-2 bg-gray-700 border-gray-600 text-white"
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            {org.website && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(org.website, "_blank")}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7 w-7 p-0"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveNonProfit(org.id)}
                              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-7 w-7 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                    {nonProfits.length === 0 && (
                      <div className="text-center text-gray-400 py-6 text-sm">
                        No organizations added yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Endowment Distribution Form */}
              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <Send className="h-5 w-5 text-pink-500" />
                    Distribute Funds
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-400">
                    Execute batch transfer from Endowment Wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Available Balance Display */}
                  <div className="p-4 bg-gradient-to-br from-pink-500/20 to-pink-600/10 border border-pink-500/30 rounded-lg">
                    <Label className="text-sm font-medium text-gray-300">
                      Available Balance
                    </Label>
                    <div className="text-2xl font-bold text-pink-400 mt-1">
                      {endowmentWalletBalance ? Number.parseFloat(formatUnits(endowmentWalletBalance as bigint, 8)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      BTC1 in Endowment Wallet
                    </p>
                  </div>

                  {/* Total Amount Display */}
                  <div className="space-y-2 p-4 rounded-lg bg-gray-700/30 border border-gray-600">
                    <Label className="text-sm font-medium text-gray-300">
                      Total Distribution Amount
                    </Label>
                    <div className="text-3xl font-bold text-pink-500">
                      {nonProfits
                        .filter((org) => org.selected)
                        .reduce((total, org) => total + (Number.parseFloat(org.amount) || 0), 0)
                        .toFixed(2)}
                    </div>
                    <p className="text-xs text-gray-400">
                      Sum of all selected organizations' amounts
                    </p>
                  </div>

                  {/* Selected Recipients Count */}
                  <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                    <div className="text-sm text-gray-300">
                      Selected Organizations
                    </div>
                    <Badge variant="outline" className="border-pink-500 text-pink-500">
                      {nonProfits.filter(org => org.selected).length}
                    </Badge>
                  </div>

                  {/* Category Breakdown */}
                  {nonProfits.filter(org => org.selected).length > 0 && (
                    <div className="space-y-2 p-3 bg-gray-700/30 rounded-lg">
                      <Label className="text-xs font-medium text-gray-300">Categories</Label>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(nonProfits.filter(org => org.selected).map(org => org.category))).map((cat) => {
                          const categoryId = Object.keys(ENDOWMENT_CATEGORIES).findIndex(
                            (key) => ENDOWMENT_CATEGORIES[key as keyof typeof ENDOWMENT_CATEGORIES].toString() === cat,
                          )
                          const categoryName = getCategoryById(categoryId)
                          const categoryColor = getCategoryColor(categoryName)
                          return (
                            <Badge key={cat} className={`${categoryColor} text-white text-xs`}>
                              {categoryName}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleEndowmentPayment}
                    disabled={!isConnected || isPending || isConfirming}
                    className="w-full bg-pink-500 hover:bg-pink-600 text-white py-2 px-4 text-sm sm:text-base relative z-10"
                  >
                    {isPending || isConfirming ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Distribute Endowment
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-400 text-center">
                    Uses batch transfer from Endowment Wallet contract
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Dev Wallet Dialog */}
          <Dialog open={showAddDevWallet} onOpenChange={setShowAddDevWallet}>
            <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 text-white max-w-[calc(100%-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl lg:text-2xl text-white">Add Development Wallet</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-gray-400">
                  Add a new wallet to receive development fee distributions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dev-name" className="text-sm font-medium text-gray-300">
                    Wallet Name *
                  </Label>
                  <Input
                    id="dev-name"
                    value={newDevPayee.name}
                    onChange={(e) => setNewDevPayee({ ...newDevPayee, name: e.target.value })}
                    placeholder="e.g., Core Developer Fund"
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dev-wallet" className="text-sm font-medium text-gray-300">
                    Wallet Address *
                  </Label>
                  <Input
                    id="dev-wallet"
                    value={newDevPayee.wallet}
                    onChange={(e) => setNewDevPayee({ ...newDevPayee, wallet: e.target.value })}
                    placeholder="0x..."
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 font-mono text-xs sm:text-sm h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dev-description" className="text-sm font-medium text-gray-300">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="dev-description"
                    value={newDevPayee.description}
                    onChange={(e) => setNewDevPayee({ ...newDevPayee, description: e.target.value })}
                    placeholder="Purpose of this wallet..."
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 resize-none text-sm min-h-[72px]"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter className="flex-col xs:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddDevWallet(false)}
                  disabled={isPending || isConfirming}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 h-10 px-4 text-sm w-full xs:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddDevPayee}
                  disabled={!isConnected || isPending || isConfirming}
                  className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed h-10 px-4 text-sm w-full xs:w-auto"
                >
                  {!isConnected ? (
                    <>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      <span className="truncate">Connect Wallet First</span>
                    </>
                  ) : isPending || isConfirming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                      <span className="truncate">{isPending ? "Confirm in wallet..." : "Confirming..."}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Wallet
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Non-Profit Dialog */}
          <Dialog open={showAddNonProfit} onOpenChange={setShowAddNonProfit}>
            <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 text-white max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl lg:text-2xl text-white">
                  {isAdmin ? "Add New Non-Profit" : "Propose New Non-Profit"}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-gray-400">
                  {isAdmin
                    ? "Directly add a verified non-profit organization"
                    : "Submit a proposal to add a new organization (requires 1,000 BTC1)"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-300">Organization Name *</Label>
                  <Input
                    value={proposalForm.name}
                    onChange={(e) => setProposalForm({ ...proposalForm, name: e.target.value })}
                    placeholder="e.g., Red Cross International"
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-300">Description *</Label>
                  <Textarea
                    value={proposalForm.description}
                    onChange={(e) => setProposalForm({ ...proposalForm, description: e.target.value })}
                    placeholder="Brief description of the organization"
                    rows={3}
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 resize-none text-sm min-h-[72px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-300">Wallet Address *</Label>
                  <Input
                    value={proposalForm.wallet}
                    onChange={(e) => setProposalForm({ ...proposalForm, wallet: e.target.value })}
                    placeholder="0x..."
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 font-mono text-xs sm:text-sm h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-300">Website</Label>
                  <Input
                    value={proposalForm.website || ""}
                    onChange={(e) => setProposalForm({ ...proposalForm, website: e.target.value })}
                    placeholder="https://..."
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-300">Category *</Label>
                  <select
                    value={proposalForm.category}
                    onChange={(e) => setProposalForm({ ...proposalForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 h-10 rounded-lg border border-gray-600 bg-gray-700 text-white text-sm focus:border-pink-500 focus:ring-pink-500"
                  >
                    <option value="Humanitarian" className="bg-gray-700">Humanitarian</option>
                    <option value="Zakat" className="bg-gray-700">Zakat</option>
                    <option value="Development" className="bg-gray-700">Development</option>
                    <option value="Poverty" className="bg-gray-700">Poverty</option>
                    <option value="Education" className="bg-gray-700">Education</option>
                    <option value="Healthcare" className="bg-gray-700">Healthcare</option>
                    <option value="Environment" className="bg-gray-700">Environment</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="flex-col xs:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddNonProfit(false)}
                  disabled={isPending || isConfirming}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 h-10 px-4 text-sm w-full xs:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddNonProfitToContract}
                  className="bg-pink-500 hover:bg-pink-600 text-white disabled:opacity-50 disabled:cursor-not-allowed h-10 px-4 text-sm w-full xs:w-auto"
                  disabled={!isConnected || isPending || isConfirming}
                >
                  {!isConnected ? (
                    <>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      <span className="truncate">Connect Wallet First</span>
                    </>
                  ) : isPending || isConfirming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                      <span className="truncate">{isPending ? "Confirm in wallet..." : "Confirming..."}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="truncate">{isAdmin ? "Add Organization" : "Submit Proposal"}</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <TabsContent value="merkle-fee" className="space-y-4 mt-4">
            {/* Merkle Fee Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">
                    Balance
                  </CardTitle>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                    <Coins className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {merkleFeeCollectorBalance ? Number.parseFloat(formatUnits(merkleFeeCollectorBalance as bigint, 8)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">BTC1</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">
                    Active Recipients
                  </CardTitle>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl sm:text-3xl font-bold text-white">{merkleFeeWallets ? merkleFeeWallets.length : 0}</div>
                  <p className="text-xs text-gray-400 mt-1">Wallets</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">
                    Total Distributed
                  </CardTitle>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl sm:text-3xl font-bold text-white">
                    {merkleFeeCollectorStats ? (
                      Number.parseFloat(formatUnits(merkleFeeCollectorStats[1] as bigint, 8)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    ) : (
                      '0.00'
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">BTC1</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl hover:shadow-2xl transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">
                    Distributions
                  </CardTitle>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl sm:text-3xl font-bold text-white">
                    {merkleFeeTotalDistributionCount ? Number(merkleFeeTotalDistributionCount) : 0}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Completed</p>
                </CardContent>
              </Card>
            </div>

            {/* Merkle Fee Actions */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-semibold text-white">Merkle Fee Wallets</h3>
              <Button
                onClick={() => setShowAddMerkleFeeWallet(true)}
                className="bg-yellow-500 hover:bg-yellow-600 text-white shadow-md text-sm sm:text-base"
                disabled={!isConnected}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Merkle Fee Wallet
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Merkle Fee Wallets List with Distribution */}
              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <Wallet className="h-5 w-5 text-yellow-500" />
                    Select Recipients
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-400">
                    Choose wallets to receive Merkle distribution fees
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 max-h-96 overflow-y-auto p-3 border border-gray-600 rounded-lg bg-gray-700/30">
                    {merkleFeeWallets && merkleFeeWallets.map((wallet) => (
                      <div
                        key={wallet.address}
                        className="flex items-start space-x-3 p-3 hover:bg-gray-700/50 rounded-lg"
                      >
                        <Checkbox
                          id={`merkle-fee-${wallet.address}`}
                          checked={wallet.selected}
                          onCheckedChange={() => handleToggleMerkleFeeWallet(wallet.address)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <Label htmlFor={`merkle-fee-${wallet.address}`} className="font-medium text-white cursor-pointer">
                            {wallet.name}
                          </Label>
                          <div className="text-xs text-gray-400 truncate font-mono">
                            {wallet.address}
                          </div>
                          {wallet.description && (
                            <div className="text-xs text-gray-400 mt-1">
                              {wallet.description}
                            </div>
                          )}
                          <Input
                            type="number"
                            placeholder="Amount (BTC1)"
                            value={wallet.amount}
                            onChange={(e) => handleMerkleFeeWalletAmountChange(wallet.address, e.target.value)}
                            className="w-32 text-sm mt-2 bg-gray-700 border-gray-600 text-white"
                            step="0.01"
                            min="0"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMerkleFeeWallet(wallet.address)}
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {(!merkleFeeWallets || merkleFeeWallets.length === 0) && (
                      <div className="text-center text-gray-400 py-6 text-sm">
                        No Merkle fee wallets added yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Merkle Fee Distribution Form */}
              <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <Send className="h-5 w-5 text-yellow-500" />
                    Distribute Funds
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-400">
                    Execute batch transfer from Merkle Fee Collector
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Available Balance Display */}
                  <div className="p-4 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-lg">
                    <Label className="text-sm font-medium text-gray-300">
                      Available Balance
                    </Label>
                    <div className="text-2xl font-bold text-yellow-400 mt-1">
                      {merkleFeeCollectorBalance ? Number.parseFloat(formatUnits(merkleFeeCollectorBalance as bigint, 8)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      BTC1 in Merkle Fee Collector
                    </p>
                  </div>

                  {/* Total Amount Display */}
                  <div className="space-y-2 p-4 rounded-lg bg-gray-700/30 border border-gray-600">
                    <Label className="text-sm font-medium text-gray-300">
                      Total Distribution Amount
                    </Label>
                    <div className="text-3xl font-bold text-yellow-500">
                      {merkleFeeWallets
                        ? merkleFeeWallets
                            .filter((wallet) => wallet.selected)
                            .reduce((total, wallet) => total + (Number.parseFloat(wallet.amount) || 0), 0)
                            .toFixed(2)
                        : '0.00'}
                    </div>
                    <p className="text-xs text-gray-400">
                      Sum of all selected wallets' amounts
                    </p>
                  </div>

                  {/* Selected Recipients Count */}
                  <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                    <div className="text-sm text-gray-300">
                      Selected Recipients
                    </div>
                    <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                      {merkleFeeWallets ? merkleFeeWallets.filter(w => w.selected).length : 0}
                    </Badge>
                  </div>

                  <Button
                    onClick={handleMerkleFeePayment}
                    disabled={!isConnected || isPending || isConfirming}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 text-sm sm:text-base relative z-10"
                  >
                    {isPending || isConfirming ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Distribute Merkle Fees
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-400 text-center">
                    Uses batch transfer from Merkle Fee Collector contract
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Merkle Fee Wallet Dialog */}
          <Dialog open={showAddMerkleFeeWallet} onOpenChange={setShowAddMerkleFeeWallet}>
            <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle className="text-2xl text-white">Add Merkle Fee Wallet</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Add a new wallet to receive Merkle distribution fee distributions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="merkle-fee-name" className="text-sm font-medium text-gray-300">
                    Wallet Name *
                  </Label>
                  <Input
                    id="merkle-fee-name"
                    value={newDevPayee.name}
                    onChange={(e) => setNewDevPayee({ ...newDevPayee, name: e.target.value })}
                    placeholder="e.g., Merkle Fee Distribution Wallet"
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="merkle-fee-wallet" className="text-sm font-medium text-gray-300">
                    Wallet Address *
                  </Label>
                  <Input
                    id="merkle-fee-wallet"
                    value={newDevPayee.wallet}
                    onChange={(e) => setNewDevPayee({ ...newDevPayee, wallet: e.target.value })}
                    placeholder="0x..."
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="merkle-fee-description" className="text-sm font-medium text-gray-300">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="merkle-fee-description"
                    value={newDevPayee.description}
                    onChange={(e) => setNewDevPayee({ ...newDevPayee, description: e.target.value })}
                    placeholder="Purpose of this wallet..."
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 resize-none"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAddMerkleFeeWallet(false)}
                  disabled={isPending || isConfirming}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 py-2 px-4 text-sm sm:text-base"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddMerkleFeeWallet}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-50 disabled:cursor-not-allowed py-2 px-4 text-sm sm:text-base relative z-10"
                  disabled={!isConnected || isPending || isConfirming}
                >
                  {!isConnected ? (
                    <>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Connect Wallet First
                    </>
                  ) : isPending || isConfirming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                      {isPending ? "Confirm in wallet..." : "Confirming..."}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Wallet
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <TabsContent value="wallets" className="space-y-6 mt-6">
            {isAdmin ? (
              <div className="space-y-8">
                <WalletManagement walletType="dev" />
                <WalletManagement walletType="endowment" />
              </div>
            ) : (
              <Card className="gradient-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    Access Denied
                  </CardTitle>
                  <CardDescription>You must be an admin to manage wallets.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Connect with an admin wallet to access wallet management features.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Dev Wallet Safe Transaction Modal */}
        <Dialog open={showDevWalletSafeModal} onOpenChange={setShowDevWalletSafeModal}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-orange-950 to-gray-900 border-2 border-orange-500/70 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/50">
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-2xl font-bold text-white">
                    Add Dev Wallet
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-orange-200">
                    Safe Multi-Signature Transaction
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              {/* Contract Address */}
              <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-2 border-green-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-green-300 font-bold uppercase">1️⃣ Contract Address</Label>
                  <Button
                    size="sm"
                    className="h-8 px-3 sm:px-4 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => copyToClipboard(CONTRACT_ADDRESSES.DEV_WALLET, 'contract')}
                  >
                    {copiedField === 'contract' ? (
                      <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                    ) : (
                      <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy</>
                    )}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-green-300 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto border border-green-500/40 break-all">
                  {CONTRACT_ADDRESSES.DEV_WALLET}
                </code>
              </div>

              {/* ABI JSON */}
              <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-2 border-purple-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-purple-300 font-bold uppercase">2️⃣ Contract ABI (JSON)</Label>
                  <Button
                    size="sm"
                    className="h-8 px-3 sm:px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => {
                      const abiJson = JSON.stringify([{
                        "inputs": [
                          { "internalType": "address", "name": "_wallet", "type": "address" },
                          { "internalType": "string", "name": "_name", "type": "string" },
                          { "internalType": "string", "name": "_description", "type": "string" }
                        ],
                        "name": "addWallet",
                        "outputs": [],
                        "stateMutability": "nonpayable",
                        "type": "function"
                      }], null, 2);
                      copyToClipboard(abiJson, 'abi');
                    }}
                  >
                    {copiedField === 'abi' ? (
                      <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                    ) : (
                      <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy ABI</>
                    )}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-purple-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-purple-500/40">
                  {JSON.stringify([{
                    "inputs": [
                      { "internalType": "address", "name": "_wallet", "type": "address" },
                      { "internalType": "string", "name": "_name", "type": "string" },
                      { "internalType": "string", "name": "_description", "type": "string" }
                    ],
                    "name": "addWallet",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                  }], null, 2)}
                </code>
              </div>

              {/* Encoded Calldata */}
              <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-2 border-cyan-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-cyan-300 font-bold uppercase">3️⃣ Encoded Calldata</Label>
                  <Button
                    size="sm"
                    className="h-8 px-3 sm:px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => {
                      try {
                        const encodedData = encodeFunctionData({
                          abi: [{
                            inputs: [
                              { internalType: "address", name: "_wallet", type: "address" },
                              { internalType: "string", name: "_name", type: "string" },
                              { internalType: "string", name: "_description", type: "string" }
                            ],
                            name: "addWallet",
                            outputs: [],
                            stateMutability: "nonpayable",
                            type: "function"
                          }],
                          functionName: 'addWallet',
                          args: [newDevPayee.wallet as `0x${string}`, newDevPayee.name, newDevPayee.description || ""]
                        });
                        copyToClipboard(encodedData, 'calldata');
                      } catch (e) {
                        console.error('Encoding error:', e);
                      }
                    }}
                  >
                    {copiedField === 'calldata' ? (
                      <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                    ) : (
                      <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy Calldata</>
                    )}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-cyan-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-cyan-500/40 break-all">
                  {(() => {
                    try {
                      return encodeFunctionData({
                        abi: [{
                          inputs: [
                            { internalType: "address", name: "_wallet", type: "address" },
                            { internalType: "string", name: "_name", type: "string" },
                            { internalType: "string", name: "_description", type: "string" }
                          ],
                          name: "addWallet",
                          outputs: [],
                          stateMutability: "nonpayable",
                          type: "function"
                        }],
                        functionName: 'addWallet',
                        args: [newDevPayee.wallet as `0x${string}`, newDevPayee.name, newDevPayee.description || ""]
                      });
                    } catch {
                      return '0x...';
                    }
                  })()}
                </code>
              </div>

              {/* Parameters */}
              <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-600/50 rounded-lg p-3 sm:p-4">
                <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Parameters</h3>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Function:</span>
                    <code className="text-orange-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">addWallet</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Wallet Address:</span>
                    <code className="text-xs text-green-200 bg-black/40 px-2 py-1 rounded font-mono max-w-full sm:max-w-[300px] truncate">{newDevPayee.wallet}</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Name:</span>
                    <code className="text-white bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">{newDevPayee.name}</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Description:</span>
                    <code className="text-xs text-gray-300 bg-black/40 px-2 py-1 rounded font-mono truncate">{newDevPayee.description || "(empty)"}</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Value:</span>
                    <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">0 ETH</code>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-t-2 border-orange-700 pt-3 sm:pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDevWalletSafeModal(false)}
                className="flex-1 border-2 border-gray-600 hover:bg-gray-800 text-gray-200 font-semibold h-10 sm:h-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const safeUrl = `https://app.safe.global/base:${process.env.NEXT_PUBLIC_SAFE_ADDRESS}`;
                  window.open(safeUrl, '_blank');
                }}
                className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg shadow-orange-500/40 border-2 border-orange-400/60 font-semibold h-10 sm:h-auto"
              >
                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Open Safe UI
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Non-Profit Safe Transaction Modal */}
        <Dialog open={showNonProfitSafeModal} onOpenChange={setShowNonProfitSafeModal}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-pink-950 to-gray-900 border-2 border-pink-500/70 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/50">
                  <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-2xl font-bold text-white">
                    {isAdmin ? "Add Non-Profit" : "Propose Non-Profit"}
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-pink-200">
                    Safe Multi-Signature Transaction
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              {/* Contract Address */}
              <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-2 border-green-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-green-300 font-bold uppercase">1️⃣ Contract Address</Label>
                  <Button
                    size="sm"
                    className="h-8 px-3 sm:px-4 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => copyToClipboard(CONTRACT_ADDRESSES.ENDOWMENT_MANAGER, 'contract')}
                  >
                    {copiedField === 'contract' ? (
                      <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                    ) : (
                      <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy</>
                    )}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-green-300 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto border border-green-500/40 break-all">
                  {CONTRACT_ADDRESSES.ENDOWMENT_MANAGER}
                </code>
              </div>

              {/* Encoded Calldata */}
              <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-2 border-cyan-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-cyan-300 font-bold uppercase">2️⃣ Encoded Calldata</Label>
                  <Button
                    size="sm"
                    className="h-8 px-3 sm:px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => {
                      try {
                        const encodedData = encodeFunctionData({
                          abi: ABIS.ENDOWMENT_MANAGER,
                          functionName: isAdmin ? 'addNonProfit' : 'proposeNonProfit',
                          args: [
                            proposalForm.wallet as `0x${string}`,
                            proposalForm.name,
                            proposalForm.description,
                            proposalForm.website || "",
                            ENDOWMENT_CATEGORIES[proposalForm.category as keyof typeof ENDOWMENT_CATEGORIES],
                          ]
                        });
                        copyToClipboard(encodedData, 'calldata');
                      } catch (e) {
                        console.error('Encoding error:', e);
                      }
                    }}
                  >
                    {copiedField === 'calldata' ? (
                      <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                    ) : (
                      <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy Calldata</>
                    )}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-cyan-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-cyan-500/40 break-all">
                  {(() => {
                    try {
                      return encodeFunctionData({
                        abi: ABIS.ENDOWMENT_MANAGER,
                        functionName: isAdmin ? 'addNonProfit' : 'proposeNonProfit',
                        args: [
                          proposalForm.wallet as `0x${string}`,
                          proposalForm.name,
                          proposalForm.description,
                          proposalForm.website || "",
                          ENDOWMENT_CATEGORIES[proposalForm.category as keyof typeof ENDOWMENT_CATEGORIES],
                        ]
                      });
                    } catch {
                      return '0x...';
                    }
                  })()}
                </code>
              </div>

              {/* Parameters */}
              <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-600/50 rounded-lg p-3 sm:p-4">
                <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Parameters</h3>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Function:</span>
                    <code className="text-pink-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">{isAdmin ? "addNonProfit" : "proposeNonProfit"}</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Wallet:</span>
                    <code className="text-xs text-green-200 bg-black/40 px-2 py-1 rounded font-mono max-w-full sm:max-w-[300px] truncate">{proposalForm.wallet}</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Name:</span>
                    <code className="text-white bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">{proposalForm.name}</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Category:</span>
                    <code className="text-purple-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">{proposalForm.category}</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Value:</span>
                    <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">0 ETH</code>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-t-2 border-pink-700 pt-3 sm:pt-4">
              <Button
                variant="outline"
                onClick={() => setShowNonProfitSafeModal(false)}
                className="flex-1 border-2 border-gray-600 hover:bg-gray-800 text-gray-200 font-semibold h-10 sm:h-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const safeUrl = `https://app.safe.global/base:${process.env.NEXT_PUBLIC_SAFE_ADDRESS}`;
                  window.open(safeUrl, '_blank');
                }}
                className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white shadow-lg shadow-pink-500/40 border-2 border-pink-400/60 font-semibold h-10 sm:h-auto"
              >
                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Open Safe UI
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Merkle Fee Wallet Safe Transaction Modal */}
        <Dialog open={showMerkleFeeWalletSafeModal} onOpenChange={setShowMerkleFeeWalletSafeModal}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-yellow-950 to-gray-900 border-2 border-yellow-500/70 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-lg shadow-yellow-500/50">
                  <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-2xl font-bold text-white">
                    Add Merkle Fee Wallet
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-yellow-200">
                    Safe Multi-Signature Transaction
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              {/* Contract Address */}
              <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-2 border-green-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-green-300 font-bold uppercase">1️⃣ Contract Address</Label>
                  <Button
                    size="sm"
                    className="h-8 px-3 sm:px-4 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => copyToClipboard(CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR, 'contract')}
                  >
                    {copiedField === 'contract' ? (
                      <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                    ) : (
                      <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy</>
                    )}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-green-300 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto border border-green-500/40 break-all">
                  {CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR}
                </code>
              </div>

              {/* ABI JSON */}
              <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-2 border-purple-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-purple-300 font-bold uppercase">2️⃣ Contract ABI (JSON)</Label>
                  <Button
                    size="sm"
                    className="h-8 px-3 sm:px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => {
                      const abiJson = JSON.stringify([{
                        "inputs": [
                          { "internalType": "address", "name": "_wallet", "type": "address" },
                          { "internalType": "string", "name": "_name", "type": "string" },
                          { "internalType": "string", "name": "_description", "type": "string" }
                        ],
                        "name": "addWallet",
                        "outputs": [],
                        "stateMutability": "nonpayable",
                        "type": "function"
                      }], null, 2);
                      copyToClipboard(abiJson, 'abi');
                    }}
                  >
                    {copiedField === 'abi' ? (
                      <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                    ) : (
                      <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy ABI</>
                    )}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-purple-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-purple-500/40">
                  {JSON.stringify([{
                    "inputs": [
                      { "internalType": "address", "name": "_wallet", "type": "address" },
                      { "internalType": "string", "name": "_name", "type": "string" },
                      { "internalType": "string", "name": "_description", "type": "string" }
                    ],
                    "name": "addWallet",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                  }], null, 2)}
                </code>
              </div>

              {/* Encoded Calldata */}
              <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-2 border-cyan-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-cyan-300 font-bold uppercase">3️⃣ Encoded Calldata</Label>
                  <Button
                    size="sm"
                    className="h-8 px-3 sm:px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => {
                      try {
                        const encodedData = encodeFunctionData({
                          abi: [{
                            inputs: [
                              { internalType: "address", name: "_wallet", type: "address" },
                              { internalType: "string", name: "_name", type: "string" },
                              { internalType: "string", name: "_description", type: "string" }
                            ],
                            name: "addWallet",
                            outputs: [],
                            stateMutability: "nonpayable",
                            type: "function"
                          }],
                          functionName: 'addWallet',
                          args: [newDevPayee.wallet as `0x${string}`, newDevPayee.name, newDevPayee.description || ""]
                        });
                        copyToClipboard(encodedData, 'calldata');
                      } catch (e) {
                        console.error('Encoding error:', e);
                      }
                    }}
                  >
                    {copiedField === 'calldata' ? (
                      <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                    ) : (
                      <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy Calldata</>
                    )}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-cyan-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-cyan-500/40 break-all">
                  {(() => {
                    try {
                      return encodeFunctionData({
                        abi: [{
                          inputs: [
                            { internalType: "address", name: "_wallet", type: "address" },
                            { internalType: "string", name: "_name", type: "string" },
                            { internalType: "string", name: "_description", type: "string" }
                          ],
                          name: "addWallet",
                          outputs: [],
                          stateMutability: "nonpayable",
                          type: "function"
                        }],
                        functionName: 'addWallet',
                        args: [newDevPayee.wallet as `0x${string}`, newDevPayee.name, newDevPayee.description || ""]
                      });
                    } catch {
                      return '0x...';
                    }
                  })()}
                </code>
              </div>

              {/* Parameters */}
              <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-600/50 rounded-lg p-3 sm:p-4">
                <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Parameters</h3>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Function:</span>
                    <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">addWallet</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Wallet Address:</span>
                    <code className="text-xs text-green-200 bg-black/40 px-2 py-1 rounded font-mono max-w-full sm:max-w-[300px] truncate">{newDevPayee.wallet}</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Name:</span>
                    <code className="text-white bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">{newDevPayee.name}</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Description:</span>
                    <code className="text-xs text-gray-300 bg-black/40 px-2 py-1 rounded font-mono truncate">{newDevPayee.description || "(empty)"}</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Value:</span>
                    <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">0 ETH</code>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-t-2 border-yellow-700 pt-3 sm:pt-4">
              <Button
                variant="outline"
                onClick={() => setShowMerkleFeeWalletSafeModal(false)}
                className="flex-1 border-2 border-gray-600 hover:bg-gray-800 text-gray-200 font-semibold h-10 sm:h-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const safeUrl = `https://app.safe.global/base:${process.env.NEXT_PUBLIC_SAFE_ADDRESS}`;
                  window.open(safeUrl, '_blank');
                }}
                className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white shadow-lg shadow-yellow-500/40 border-2 border-yellow-400/60 font-semibold h-10 sm:h-auto"
              >
                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Open Safe UI
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dev Fee Distribution Safe Modal */}
        <Dialog open={showDevDistributionSafeModal} onOpenChange={setShowDevDistributionSafeModal}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-orange-950 to-gray-900 border-2 border-orange-500/70 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/50">
                  <Send className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-2xl font-bold text-white">
                    Distribute Dev Fees
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-orange-200">
                    Safe Multi-Signature Transaction
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              {/* Contract Address */}
              <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-2 border-green-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-green-300 font-bold uppercase">1️⃣ Contract Address</Label>
                  <Button size="sm" className="h-8 px-3 sm:px-4 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => copyToClipboard(CONTRACT_ADDRESSES.DEV_WALLET, 'contract')}>
                    {copiedField === 'contract' ? (<><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>) : (<><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy</>)}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-green-300 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto border border-green-500/40 break-all">
                  {CONTRACT_ADDRESSES.DEV_WALLET}
                </code>
              </div>

              {/* Encoded Calldata */}
              <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-2 border-cyan-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-cyan-300 font-bold uppercase">2️⃣ Encoded Calldata</Label>
                  <Button size="sm" className="h-8 px-3 sm:px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => {
                      try {
                        const selectedPayees = devPayees.filter((payee) => payee.selected)
                        const recipients = selectedPayees.map(payee => payee.wallet as `0x${string}`)
                        const amounts = selectedPayees.map(payee => parseUnits(payee.amount || "0", 8))
                        const encodedData = encodeFunctionData({
                          abi: ABIS.DEV_WALLET,
                          functionName: 'batchTransfer',
                          args: [CONTRACT_ADDRESSES.BTC1USD as `0x${string}`, recipients, amounts]
                        });
                        copyToClipboard(encodedData, 'calldata');
                      } catch (e) { console.error('Encoding error:', e); }
                    }}>
                    {copiedField === 'calldata' ? (<><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>) : (<><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy Calldata</>)}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-cyan-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-cyan-500/40 break-all">
                  {(() => {
                    try {
                      const selectedPayees = devPayees.filter((payee) => payee.selected)
                      const recipients = selectedPayees.map(payee => payee.wallet as `0x${string}`)
                      const amounts = selectedPayees.map(payee => parseUnits(payee.amount || "0", 8))
                      return encodeFunctionData({
                        abi: ABIS.DEV_WALLET,
                        functionName: 'batchTransfer',
                        args: [CONTRACT_ADDRESSES.BTC1USD as `0x${string}`, recipients, amounts]
                      });
                    } catch { return '0x...'; }
                  })()}
                </code>
              </div>

              {/* Recipients Summary */}
              <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-600/50 rounded-lg p-3 sm:p-4">
                <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Distribution Summary</h3>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Function:</span>
                    <code className="text-orange-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">batchTransfer</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Recipients:</span>
                    <code className="text-white bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">{devPayees.filter(p => p.selected).length} wallets</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Total Amount:</span>
                    <code className="text-green-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">
                      {devPayees.filter(p => p.selected).reduce((sum, p) => sum + Number.parseFloat(p.amount || "0"), 0).toFixed(2)} BTC1
                    </code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Value:</span>
                    <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">0 ETH</code>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-t-2 border-orange-700 pt-3 sm:pt-4">
              <Button variant="outline" onClick={() => setShowDevDistributionSafeModal(false)}
                className="flex-1 border-2 border-gray-600 hover:bg-gray-800 text-gray-200 font-semibold h-10 sm:h-auto">Cancel</Button>
              <Button onClick={() => { window.open(`https://app.safe.global/base:${process.env.NEXT_PUBLIC_SAFE_ADDRESS}`, '_blank'); }}
                className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg shadow-orange-500/40 border-2 border-orange-400/60 font-semibold h-10 sm:h-auto">
                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />Open Safe UI<ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Merkle Fee Distribution Safe Modal */}
        <Dialog open={showMerkleFeeDistributionSafeModal} onOpenChange={setShowMerkleFeeDistributionSafeModal}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-yellow-950 to-gray-900 border-2 border-yellow-500/70 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-lg shadow-yellow-500/50">
                  <Send className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-2xl font-bold text-white">Distribute Merkle Fees</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-yellow-200">Safe Multi-Signature Transaction</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-2 border-green-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-green-300 font-bold uppercase">1️⃣ Contract Address</Label>
                  <Button size="sm" className="h-8 px-3 sm:px-4 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => copyToClipboard(CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR, 'contract')}>
                    {copiedField === 'contract' ? (<><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>) : (<><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy</>)}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-green-300 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto border border-green-500/40 break-all">
                  {CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR}
                </code>
              </div>

              <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-2 border-cyan-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-cyan-300 font-bold uppercase">2️⃣ Encoded Calldata</Label>
                  <Button size="sm" className="h-8 px-3 sm:px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => {
                      try {
                        const selectedWallets = merkleFeeWallets.filter((w) => w.selected)
                        const recipients = selectedWallets.map(w => w.address as `0x${string}`)
                        const amounts = selectedWallets.map(w => parseUnits(w.amount || "0", 8))
                        const encodedData = encodeFunctionData({
                          abi: ABIS.MERKLE_FEE_COLLECTOR,
                          functionName: 'batchTransfer',
                          args: [CONTRACT_ADDRESSES.BTC1USD as `0x${string}`, recipients, amounts]
                        });
                        copyToClipboard(encodedData, 'calldata');
                      } catch (e) { console.error('Encoding error:', e); }
                    }}>
                    {copiedField === 'calldata' ? (<><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>) : (<><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy Calldata</>)}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-cyan-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-cyan-500/40 break-all">
                  {(() => {
                    try {
                      const selectedWallets = merkleFeeWallets.filter((w) => w.selected)
                      const recipients = selectedWallets.map(w => w.address as `0x${string}`)
                      const amounts = selectedWallets.map(w => parseUnits(w.amount || "0", 8))
                      return encodeFunctionData({ abi: ABIS.MERKLE_FEE_COLLECTOR, functionName: 'batchTransfer',
                        args: [CONTRACT_ADDRESSES.BTC1USD as `0x${string}`, recipients, amounts] });
                    } catch { return '0x...'; }
                  })()}
                </code>
              </div>

              <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-600/50 rounded-lg p-3 sm:p-4">
                <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Distribution Summary</h3>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Function:</span>
                    <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">batchTransfer</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Recipients:</span>
                    <code className="text-white bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">{merkleFeeWallets.filter(w => w.selected).length} wallets</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Total Amount:</span>
                    <code className="text-green-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">
                      {merkleFeeWallets.filter(w => w.selected).reduce((sum, w) => sum + Number.parseFloat(w.amount || "0"), 0).toFixed(2)} BTC1
                    </code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Value:</span>
                    <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">0 ETH</code>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-t-2 border-yellow-700 pt-3 sm:pt-4">
              <Button variant="outline" onClick={() => setShowMerkleFeeDistributionSafeModal(false)}
                className="flex-1 border-2 border-gray-600 hover:bg-gray-800 text-gray-200 font-semibold h-10 sm:h-auto">Cancel</Button>
              <Button onClick={() => { window.open(`https://app.safe.global/base:${process.env.NEXT_PUBLIC_SAFE_ADDRESS}`, '_blank'); }}
                className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white shadow-lg shadow-yellow-500/40 border-2 border-yellow-400/60 font-semibold h-10 sm:h-auto">
                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />Open Safe UI<ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Endowment Distribution Safe Modal */}
        <Dialog open={showEndowmentDistributionSafeModal} onOpenChange={setShowEndowmentDistributionSafeModal}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-pink-950 to-gray-900 border-2 border-pink-500/70 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/50">
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-2xl font-bold text-white">Execute Endowment Distribution</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-pink-200">Safe Multi-Signature Transaction</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-2 border-green-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-green-300 font-bold uppercase">1️⃣ Contract Address</Label>
                  <Button size="sm" className="h-8 px-3 sm:px-4 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => copyToClipboard(CONTRACT_ADDRESSES.ENDOWMENT_MANAGER, 'contract')}>
                    {copiedField === 'contract' ? (<><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>) : (<><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy</>)}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-green-300 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto border border-green-500/40 break-all">
                  {CONTRACT_ADDRESSES.ENDOWMENT_MANAGER}
                </code>
              </div>

              <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-2 border-cyan-500/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <Label className="text-xs sm:text-sm text-cyan-300 font-bold uppercase">2️⃣ Encoded Calldata</Label>
                  <Button size="sm" className="h-8 px-3 sm:px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => {
                      try {
                        const encodedData = encodeFunctionData({
                          abi: ABIS.ENDOWMENT_MANAGER,
                          functionName: 'executeMonthlyDistribution',
                          args: []
                        });
                        copyToClipboard(encodedData, 'calldata');
                      } catch (e) { console.error('Encoding error:', e); }
                    }}>
                    {copiedField === 'calldata' ? (<><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>) : (<><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy Calldata</>)}
                  </Button>
                </div>
                <code className="text-xs sm:text-sm text-cyan-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-cyan-500/40 break-all">
                  {(() => {
                    try {
                      return encodeFunctionData({
                        abi: ABIS.ENDOWMENT_MANAGER,
                        functionName: 'executeMonthlyDistribution',
                        args: []
                      });
                    } catch { return '0x...'; }
                  })()}
                </code>
              </div>

              <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-600/50 rounded-lg p-3 sm:p-4">
                <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Parameters</h3>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Function:</span>
                    <code className="text-pink-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">executeMonthlyDistribution</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Arguments:</span>
                    <code className="text-white bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">None (no parameters)</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-gray-400">Value:</span>
                    <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">0 ETH</code>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-t-2 border-pink-700 pt-3 sm:pt-4">
              <Button variant="outline" onClick={() => setShowEndowmentDistributionSafeModal(false)}
                className="flex-1 border-2 border-gray-600 hover:bg-gray-800 text-gray-200 font-semibold h-10 sm:h-auto">Cancel</Button>
              <Button onClick={() => { window.open(`https://app.safe.global/base:${process.env.NEXT_PUBLIC_SAFE_ADDRESS}`, '_blank'); }}
                className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white shadow-lg shadow-pink-500/40 border-2 border-pink-400/60 font-semibold h-10 sm:h-auto">
                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />Open Safe UI<ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
