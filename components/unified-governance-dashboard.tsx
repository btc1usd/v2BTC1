"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient, useWalletClient } from "wagmi"
import { ethers } from "ethers"
import { CONTRACT_ADDRESSES, ABIS, ENDOWMENT_CATEGORIES, CATEGORY_NAMES, PROTOCOL_CONSTANTS } from "@/lib/contracts"
import {
  Vote,
  TrendingUp,
  Shield,
  Settings,
  Heart,
  Rocket,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  ExternalLink,
  Users,
  DollarSign,
  FileText,
  Code,
  Loader2,
  AlertCircle,
  X as CloseIcon
} from "lucide-react"

const GOVERNANCE_DAO_ABI = [
  {
    "name": "propose",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "title", "type": "string" },
      { "name": "description", "type": "string" },
      { "name": "targets", "type": "address[]" },
      { "name": "values", "type": "uint256[]" },
      { "name": "signatures", "type": "string[]" },
      { "name": "calldatas", "type": "bytes[]" },
      { "name": "proposalType", "type": "uint8" }
    ],
    "outputs": [{ "name": "", "type": "uint256" }]
  },
  {
    "name": "castVote",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "proposalId", "type": "uint256" },
      { "name": "support", "type": "uint8" }
    ],
    "outputs": []
  },
  {
    "name": "castVoteWithReason",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "proposalId", "type": "uint256" },
      { "name": "support", "type": "uint8" },
      { "name": "reason", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "queue",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [{ "name": "proposalId", "type": "uint256" }],
    "outputs": []
  },
  {
    "name": "execute",
    "type": "function",
    "stateMutability": "payable",
    "inputs": [{ "name": "proposalId", "type": "uint256" }],
    "outputs": []
  },
  {
    "name": "proposalCount",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }]
  },
  {
    "name": "getVotingPower",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{ "name": "account", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }]
  },
  {
    "name": "delegate",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [{ "name": "delegatee", "type": "address" }],
    "outputs": []
  }
] as const

const PROPOSAL_CATEGORIES = [
  { id: 0, name: "Parameter Change", icon: Settings, color: "bg-blue-500", description: "Modify protocol parameters" },
  { id: 1, name: "Contract Upgrade", icon: Code, color: "bg-purple-500", description: "Upgrade contract implementations" },
  { id: 2, name: "Emergency Action", icon: AlertTriangle, color: "bg-red-500", description: "Emergency controls" },
  { id: 3, name: "Treasury Action", icon: DollarSign, color: "bg-green-500", description: "Treasury management" },
  { id: 4, name: "Endowment Non-Profit", icon: Heart, color: "bg-pink-500", description: "Add/remove non-profits" },
  { id: 5, name: "Endowment Distribution", icon: Users, color: "bg-orange-500", description: "Execute distribution" },
  { id: 6, name: "Governance Change", icon: Vote, color: "bg-indigo-500", description: "Modify governance rules" },
  { id: 7, name: "Oracle Update", icon: TrendingUp, color: "bg-teal-500", description: "Update price oracle" },
]

const PROPOSAL_STATES = [
  { id: 0, name: "Pending", color: "bg-gray-500", icon: Clock },
  { id: 1, name: "Active", color: "bg-blue-500", icon: Vote },
  { id: 2, name: "Canceled", color: "bg-gray-400", icon: XCircle },
  { id: 3, name: "Defeated", color: "bg-red-500", icon: XCircle },
  { id: 4, name: "Succeeded", color: "bg-green-500", icon: CheckCircle2 },
  { id: 5, name: "Queued", color: "bg-yellow-500", icon: Clock },
  { id: 6, name: "Expired", color: "bg-gray-400", icon: XCircle },
  { id: 7, name: "Executed", color: "bg-green-600", icon: CheckCircle2 },
]

// Timer Component for Active Proposals
function ProposalTimer({ endBlock, proposalId }: { endBlock: number; proposalId: number }) {
  const publicClient = usePublicClient()
  const [blocksRemaining, setBlocksRemaining] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState("")

  useEffect(() => {
    const updateTimer = async () => {
      if (!publicClient) return

      const currentBlock = await publicClient.getBlockNumber()
      const remaining = Math.max(0, endBlock - Number(currentBlock))
      setBlocksRemaining(remaining)

      // Assuming ~12 second block time
      const secondsRemaining = remaining * 12
      const hours = Math.floor(secondsRemaining / 3600)
      const minutes = Math.floor((secondsRemaining % 3600) / 60)

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`)
      } else {
        setTimeRemaining(`${minutes}m`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 12000) // Update every ~12 seconds

    return () => clearInterval(interval)
  }, [endBlock, publicClient])

  if (blocksRemaining === 0) return null

  return (
    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-muted-foreground whitespace-nowrap">Voting ends in:</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-blue-400">{timeRemaining}</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">({blocksRemaining.toLocaleString()} blocks)</span>
        </div>
      </div>
    </div>
  )
}

// Voting Component with Already Voted Check
function ProposalVoting({
  proposal,
  address,
  isConnected,
  votingPower,
  publicClient,
  onVote
}: {
  proposal: any
  address: string | undefined
  isConnected: boolean
  votingPower: string
  publicClient: any
  onVote: (proposalId: number, support: number) => void
}) {
  const [hasVoted, setHasVoted] = useState(false)
  const [userVote, setUserVote] = useState<{ support: number; votes: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkVoteStatus = async () => {
      if (!publicClient || !address) {
        setLoading(false)
        return
      }

      try {
        const receipt = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.GOVERNANCE_DAO as `0x${string}`,
          abi: GOVERNANCE_DAO_ABI,
          functionName: 'getReceipt',
          args: [BigInt(proposal.id), address],
        })

        if (receipt && receipt.hasVoted) {
          setHasVoted(true)
          setUserVote({
            support: receipt.support,
            votes: ethers.formatUnits(receipt.votes.toString(), 8)
          })
        }
      } catch (error) {
        console.error("Error checking vote status:", error)
      } finally {
        setLoading(false)
      }
    }

    checkVoteStatus()
  }, [proposal.id, address, publicClient])

  if (loading) {
    return <div className="text-center text-sm text-muted-foreground py-2">Checking vote status...</div>
  }

  // User has already voted
  if (hasVoted && userVote) {
    const voteText = userVote.support === 1 ? "FOR" : userVote.support === 0 ? "AGAINST" : "ABSTAIN"
    const voteColor = userVote.support === 1 ? "text-green-500" : userVote.support === 0 ? "text-red-500" : "text-gray-500"

    return (
      <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-purple-400">You Already Voted</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Your vote: </span>
            <span className={`font-bold ${voteColor}`}>{voteText}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Voting power used: {parseFloat(userVote.votes).toLocaleString()} BTC1
          </div>
        </div>
      </div>
    )
  }

  // User hasn't voted yet - show voting buttons
  return (
    <div className="space-y-3">
      {isConnected && parseFloat(votingPower) > 0 && (
        <div className="text-sm text-center p-2 bg-blue-500/10 rounded-lg">
          <span className="text-muted-foreground">Your voting power: </span>
          <span className="font-bold text-blue-400">
            {parseFloat(votingPower).toLocaleString()} BTC1
          </span>
        </div>
      )}

      {!isConnected && (
        <div className="text-sm text-center p-2 bg-yellow-500/10 rounded-lg text-yellow-400">
          Connect wallet to vote
        </div>
      )}

      {isConnected && parseFloat(votingPower) === 0 && (
        <div className="text-sm text-center p-2 bg-red-500/10 rounded-lg text-red-400">
          You need BTC1 tokens to vote
        </div>
      )}

      <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
        <Button
          onClick={() => onVote(proposal.id, 1)}
          className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 h-10"
          disabled={!isConnected || parseFloat(votingPower) === 0}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" />
          <span className="whitespace-nowrap">Vote For</span>
        </Button>
        <Button
          onClick={() => onVote(proposal.id, 0)}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 h-10"
          disabled={!isConnected || parseFloat(votingPower) === 0}
        >
          <XCircle className="w-4 h-4 mr-1" />
          <span className="whitespace-nowrap">Against</span>
        </Button>
        <Button
          onClick={() => onVote(proposal.id, 2)}
          variant="outline"
          className="flex-1 disabled:opacity-50 h-10"
          disabled={!isConnected || parseFloat(votingPower) === 0}
        >
          <Clock className="w-4 h-4 mr-1" />
          <span className="whitespace-nowrap">Abstain</span>
        </Button>
      </div>
    </div>
  )
}

interface UnifiedGovernanceDashboardProps {
  userBalance?: number
  isAdmin?: boolean
}

export function UnifiedGovernanceDashboard({ userBalance = 0, isAdmin = false }: UnifiedGovernanceDashboardProps) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { writeContract, data: hash, isPending, isSuccess, error: writeError } = useWriteContract()
  const [activeTab, setActiveTab] = useState("proposals")
  const [proposals, setProposals] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [votingPower, setVotingPower] = useState("0")
  const [showCreateProposal, setShowCreateProposal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(0)
  const [endowmentData, setEndowmentData] = useState(null)

  // Proposal form state
  const [proposalForm, setProposalForm] = useState({
    title: "",
    description: "",
    category: 0,
    // For parameter changes
    parameter: "",
    newValue: "",
    // For non-profit additions
    nonProfitWallet: "",
    nonProfitName: "",
    nonProfitDescription: "",
    nonProfitWebsite: "",
    nonProfitCategory: 0,
    // For contract upgrades
    oldContractAddress: "",
    newContractAddress: "",
    contractName: "",
  })

  const [isCreatingProposal, setIsCreatingProposal] = useState(false)

  // Handle transaction success
  useEffect(() => {
    if (isSuccess && hash) {
      console.log("Transaction successful! Hash:", hash)

      // Check if it was a proposal creation or a vote
      if (isCreatingProposal) {
        alert("Proposal created successfully! Transaction: " + hash)

        // Reset form and close modal
        setShowCreateProposal(false)
        setProposalForm({
          title: "",
          description: "",
          category: 0,
          parameter: "",
          newValue: "",
          nonProfitWallet: "",
          nonProfitName: "",
          nonProfitDescription: "",
          nonProfitWebsite: "",
          nonProfitCategory: 0,
          oldContractAddress: "",
          newContractAddress: "",
          contractName: "",
        })
        setIsCreatingProposal(false)
      } else {
        alert("Vote cast successfully! Transaction: " + hash)
      }

      // Reload proposals after a delay
      setTimeout(() => loadProposals(), 3000)
    }
  }, [isSuccess, hash])

  // Handle transaction error
  useEffect(() => {
    if (writeError) {
      console.error("Transaction error:", writeError)
      alert("Transaction failed: " + writeError.message)
      setIsCreatingProposal(false)
    }
  }, [writeError])

  // Load proposals
  useEffect(() => {
    if (isConnected) {
      loadProposals()
      loadVotingPower()
      loadEndowmentData()
    }
  }, [isConnected, address])

  const loadProposals = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/governance/proposals")
      const data = await response.json()
      if (data.proposals) {
        setProposals(data.proposals)
      }
    } catch (error) {
      console.error("Error loading proposals:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadVotingPower = async () => {
    if (!publicClient || !address) return

    try {
      console.log("=== LOADING VOTING POWER ===")
      console.log("Connected address:", address)
      console.log("BTC1USD contract:", CONTRACT_ADDRESSES.BTC1USD)
      console.log("GovernanceDAO contract:", CONTRACT_ADDRESSES.GOVERNANCE_DAO)
      console.log("Network chain:", await publicClient.getChainId())

      // First, get BTC1USD balance directly
      const balance = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
        abi: [
          {
            "name": "balanceOf",
            "type": "function",
            "stateMutability": "view",
            "inputs": [{ "name": "account", "type": "address" }],
            "outputs": [{ "name": "", "type": "uint256" }]
          }
        ],
        functionName: 'balanceOf',
        args: [address],
      })

      console.log("BTC1USD Balance (raw wei):", balance.toString())
      // BTC1USD has 8 decimals, not 18
      const formattedBalance = ethers.formatUnits(balance.toString(), 8)
      console.log("Formatted Balance (8 decimals):", formattedBalance)

      // Try to get voting power from DAO (includes delegations)
      try {
        const power = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.GOVERNANCE_DAO as `0x${string}`,
          abi: GOVERNANCE_DAO_ABI,
          functionName: 'getVotingPower',
          args: [address],
        })

        console.log("Voting Power from DAO:", power.toString())
        const formattedPower = ethers.formatUnits(power.toString(), 8)

        // If DAO returns 0 but we have a balance, use the balance
        if (power.toString() === "0" && balance.toString() !== "0") {
          console.log("DAO returned 0 but balance exists, using balance:", formattedBalance)
          setVotingPower(formattedBalance)
        } else {
          setVotingPower(formattedPower)
        }
      } catch (daoError) {
        console.log("DAO voting power failed, using balance:", daoError)
        // If DAO call fails, use balance directly
        setVotingPower(formattedBalance)
      }
    } catch (error) {
      console.error("Error loading voting power:", error)
    }
  }

  const loadEndowmentData = async () => {
    try {
      const response = await fetch("/api/governance/endowment?action=stats")
      const data = await response.json()
      setEndowmentData(data)
    } catch (error) {
      console.error("Error loading endowment data:", error)
    }
  }

  const handleVote = async (proposalId: number, support: number) => {
    if (!walletClient || !address) {
      alert("Please connect your wallet")
      return
    }

    // Double-check voting power from contract before voting
    try {
      if (!publicClient) throw new Error("Public client not available");
      const contractVotingPower = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.GOVERNANCE_DAO as `0x${string}`,
        abi: GOVERNANCE_DAO_ABI,
        functionName: 'getVotingPower',
        args: [address],
      })

      console.log("Contract voting power check:", contractVotingPower.toString())

      if (contractVotingPower.toString() === "0") {
        alert("Contract reports 0 voting power. You may need to delegate votes to yourself first, or you don't have BTC1USD tokens.")
        return
      }
    } catch (powerError) {
      console.error("Error checking voting power:", powerError)
    }

    if (parseFloat(votingPower) === 0) {
      alert("You have no voting power. You need BTC1USD tokens to vote.")
      return
    }

    const supportText = support === 1 ? "FOR" : support === 0 ? "AGAINST" : "ABSTAIN"

    if (!confirm(`Cast your vote ${supportText} with ${parseFloat(votingPower).toLocaleString()} voting power?\n\nAddress: ${address}`)) {
      return
    }

    try {
      console.log("Casting vote:", { proposalId, support, address, votingPower })

      writeContract({
        address: CONTRACT_ADDRESSES.GOVERNANCE_DAO as `0x${string}`,
        abi: GOVERNANCE_DAO_ABI,
        functionName: 'castVote',
        args: [BigInt(proposalId), support],
      })

      console.log("Vote transaction sent to MetaMask")
    } catch (error) {
      console.error("Error voting:", error)
      alert("Failed to cast vote: " + (error as Error)?.message || JSON.stringify(error))
    }
  }

  const handleQueueProposal = async (proposalId: number) => {
    if (!walletClient) return

    try {
      writeContract({
        address: (process.env.NEXT_PUBLIC_DAO_CONTRACT || CONTRACT_ADDRESSES.GOVERNANCE_DAO) as `0x${string}`,
        abi: GOVERNANCE_DAO_ABI,
        functionName: 'queue',
        args: [BigInt(proposalId)],
      })

      alert("Proposal queue transaction submitted!")
      setTimeout(() => loadProposals(), 3000)
    } catch (error) {
      console.error("Error queuing:", error)
      alert("Failed to queue proposal")
    }
  }

  const handleExecuteProposal = async (proposalId: number) => {
    if (!walletClient) return

    try {
      writeContract({
        address: (process.env.NEXT_PUBLIC_DAO_CONTRACT || CONTRACT_ADDRESSES.GOVERNANCE_DAO) as `0x${string}`,
        abi: GOVERNANCE_DAO_ABI,
        functionName: 'execute',
        args: [BigInt(proposalId)],
      })

      alert("Proposal execution transaction submitted!")
      setTimeout(() => loadProposals(), 3000)
    } catch (error) {
      console.error("Error executing:", error)
      alert("Failed to execute proposal")
    }
  }

  const handleCreateProposal = async () => {
    if (!walletClient || !isAdmin) {
      alert("Only admin can create proposals")
      return
    }

    if (!proposalForm.title || !proposalForm.description) {
      alert("Please fill in title and description")
      return
    }

    setIsCreatingProposal(true)

    try {
      const category = proposalForm.category

      // Build proposal based on category
      let targets: string[] = []
      let values: bigint[] = []
      let signatures: string[] = []
      let calldatas: string[] = []

      // Category 0: Parameter Change
      if (category === 0 && proposalForm.parameter && proposalForm.newValue) {
        targets = [CONTRACT_ADDRESSES.PROTOCOL_GOVERNANCE]
        values = [BigInt(0)]

        if (proposalForm.parameter === "minCollateralRatio") {
          signatures = ["updateMinCollateralRatioDAO(uint256)"]
          calldatas = [ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther(proposalForm.newValue)])]
        } else if (proposalForm.parameter === "devFeeMint") {
          signatures = ["updateDevFeeMint(uint256)"]
          calldatas = [ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther(proposalForm.newValue)])]
        } else if (proposalForm.parameter === "devFeeRedeem") {
          signatures = ["updateDevFeeRedeem(uint256)"]
          calldatas = [ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther(proposalForm.newValue)])]
        }
      }
      // Category 4: Endowment Non-Profit
      else if (category === 4 && proposalForm.nonProfitWallet && proposalForm.nonProfitName) {
        targets = [CONTRACT_ADDRESSES.ENDOWMENT_MANAGER]
        values = [BigInt(0)]
        signatures = ["addNonProfit(address,string,string,string,uint8)"]
        calldatas = [ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "string", "string", "string", "uint8"],
          [
            proposalForm.nonProfitWallet,
            proposalForm.nonProfitName,
            proposalForm.nonProfitDescription || "",
            proposalForm.nonProfitWebsite || "",
            proposalForm.nonProfitCategory
          ]
        )]
      }
      // Category 5: Endowment Distribution
      else if (category === 5) {
        targets = [CONTRACT_ADDRESSES.ENDOWMENT_MANAGER]
        values = [BigInt(0)]
        signatures = ["executeMonthlyDistribution()"]
        calldatas = ["0x"]
      }
      // Category 1: Contract Upgrade
      else if (category === 1 && proposalForm.newContractAddress && proposalForm.contractName) {
        targets = [CONTRACT_ADDRESSES.PROTOCOL_GOVERNANCE]
        values = [BigInt(0)]

        if (proposalForm.contractName.toLowerCase() === "vault") {
          signatures = ["upgradeVault(address)"]
        } else if (proposalForm.contractName.toLowerCase() === "endowment") {
          signatures = ["upgradeEndowmentManager(address)"]
        } else if (proposalForm.contractName.toLowerCase() === "distribution") {
          signatures = ["upgradeWeeklyDistribution(address)"]
        }

        calldatas = [ethers.AbiCoder.defaultAbiCoder().encode(["address"], [proposalForm.newContractAddress])]
      }
      // Generic proposal (for testing or custom actions)
      else {
        // Create a simple proposal with no actions (for testing voting)
        targets = [CONTRACT_ADDRESSES.GOVERNANCE_DAO]
        values = [BigInt(0)]
        signatures = [""]
        calldatas = ["0x"]
      }

      console.log("Creating proposal:", {
        title: proposalForm.title,
        description: proposalForm.description,
        category,
        targets,
        values,
        signatures,
        calldatas
      })

      // Call the propose function
      writeContract({
        address: (process.env.NEXT_PUBLIC_DAO_CONTRACT || CONTRACT_ADDRESSES.GOVERNANCE_DAO) as `0x${string}`,
        abi: GOVERNANCE_DAO_ABI,
        functionName: 'propose',
        args: [
          proposalForm.title,
          proposalForm.description,
          targets as readonly `0x${string}`[],
          values,
          signatures,
          calldatas as readonly `0x${string}`[],
          category
        ],
      })

    } catch (error) {
      console.error("Error creating proposal:", error)
      alert("Failed to create proposal: " + (error as Error)?.message || (error as Error)?.toString() || "Unknown error")
      setIsCreatingProposal(false)
    }
  }

  const getCategoryInfo = (categoryId: number) => {
    return PROPOSAL_CATEGORIES.find(c => c.id === categoryId) || PROPOSAL_CATEGORIES[0]
  }

  const getStateInfo = (stateId: number) => {
    return PROPOSAL_STATES.find(s => s.id === stateId) || PROPOSAL_STATES[0]
  }

  const filteredProposals = selectedCategory === null
    ? proposals
    : proposals.filter((p: any) => p.categoryId === selectedCategory)

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Your Voting Power */}
        <Card className="bg-gradient-to-br from-orange-900/20 to-yellow-900/20 border-orange-500/30">
          <CardContent className="pt-4 sm:pt-6">
            <div className="text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2 truncate">Your Voting Power</div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-400 break-all">
              {parseFloat(votingPower).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">BTC1 tokens</div>
          </CardContent>
        </Card>

        {/* Total Proposals */}
        <Card className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border-blue-500/30">
          <CardContent className="pt-4 sm:pt-6">
            <div className="text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2 truncate">Total Proposals</div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-400">
              {proposals.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">All time</div>
          </CardContent>
        </Card>

        {/* Active Proposals */}
        <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30">
          <CardContent className="pt-4 sm:pt-6">
            <div className="text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2 truncate">Active Proposals</div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-400">
              {proposals.filter((p: any) => p.stateId === 1).length}
            </div>
            <div className="text-xs text-gray-500 mt-1">Vote now</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Governance Interface */}
      <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700">
        <CardHeader>
          <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="text-xl sm:text-2xl text-white">
                {isAdmin ? "🏛️ Governance Dashboard" : "🗳️ Active Proposals"}
              </CardTitle>
              <CardDescription className="text-gray-400 text-sm">
                {isAdmin
                  ? "Admin: Create proposals for community voting"
                  : "Vote on proposals to shape protocol direction"}
              </CardDescription>
            </div>
            {isAdmin && (
              <Button
                onClick={() => setShowCreateProposal(true)}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white whitespace-nowrap text-sm sm:text-base h-8 sm:h-10 px-3 sm:px-4"
              >
                <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Create Proposal</span>
                <span className="xs:hidden">Create</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* For Admin: Show full tabs interface */}
          {isAdmin ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
                <TabsTrigger value="proposals" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                  Proposals
                </TabsTrigger>
                <TabsTrigger value="delegation" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                  Delegation
                </TabsTrigger>
              </TabsList>

              {/* Proposals Tab */}
              <TabsContent value="proposals" className="space-y-4">
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null as any)}
                  className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-4"
                >
                  All
                </Button>
                {PROPOSAL_CATEGORIES.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-4 ${selectedCategory === cat.id ? cat.color + " text-white" : ""}`}
                  >
                    <cat.icon className="w-3 h-3 mr-1 hidden xs:inline" />
                    <span className="whitespace-nowrap">{cat.name}</span>
                  </Button>
                ))}
              </div>

              {/* Proposals List */}
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading proposals...</div>
                ) : filteredProposals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No proposals found. Create the first one!
                  </div>
                ) : (
                  filteredProposals.map((proposal) => {
                    const categoryInfo = getCategoryInfo(proposal.categoryId)
                    const stateInfo = getStateInfo(proposal.stateId)

                    return (
                      <Card key={proposal.id} className="gradient-card border-border/50">
                        <CardHeader>
                          <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge className={`${categoryInfo.color} text-white`}>
                                  <categoryInfo.icon className="w-3 h-3 mr-1" />
                                  <span className="text-xs sm:text-sm">{categoryInfo.name}</span>
                                </Badge>
                                <Badge className={`${stateInfo.color} text-white`}>
                                  <stateInfo.icon className="w-3 h-3 mr-1" />
                                  <span className="text-xs sm:text-sm">{stateInfo.name}</span>
                                </Badge>
                                <span className="text-xs text-muted-foreground">#{proposal.id}</span>
                              </div>
                              <CardTitle className="text-lg sm:text-xl text-card-foreground">{proposal.title}</CardTitle>
                              <CardDescription className="mt-2 text-sm">{proposal.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          {/* Vote Progress Bar */}
                          {(() => {
                            const forVotes = parseFloat(proposal.forVotes)
                            const againstVotes = parseFloat(proposal.againstVotes)
                            const abstainVotes = parseFloat(proposal.abstainVotes)
                            const totalVotes = forVotes + againstVotes + abstainVotes
                            const forPercent = totalVotes > 0 ? (forVotes / totalVotes) * 100 : 0
                            const againstPercent = totalVotes > 0 ? (againstVotes / totalVotes) * 100 : 0
                            const abstainPercent = totalVotes > 0 ? (abstainVotes / totalVotes) * 100 : 0

                            return (
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Total Votes: {totalVotes.toLocaleString()}</span>
                                  <span>Quorum: {proposal.quorum ? parseFloat(proposal.quorum).toLocaleString() : 'N/A'}</span>
                                </div>

                                {/* Progress Bar */}
                                <div className="h-8 rounded-lg overflow-hidden bg-muted flex flex-wrap">
                                  {forPercent > 0 && (
                                    <div
                                      className="bg-green-500 flex items-center justify-center text-xs font-bold text-white transition-all min-w-[20px]"
                                      style={{ width: `${forPercent}%` }}
                                    >
                                      {forPercent > 15 && `${forPercent.toFixed(1)}%`}
                                    </div>
                                  )}
                                  {againstPercent > 0 && (
                                    <div
                                      className="bg-red-500 flex items-center justify-center text-xs font-bold text-white transition-all min-w-[20px]"
                                      style={{ width: `${againstPercent}%` }}
                                    >
                                      {againstPercent > 15 && `${againstPercent.toFixed(1)}%`}
                                    </div>
                                  )}
                                  {abstainPercent > 0 && (
                                    <div
                                      className="bg-gray-500 flex items-center justify-center text-xs font-bold text-white transition-all min-w-[20px]"
                                      style={{ width: `${abstainPercent}%` }}
                                    >
                                      {abstainPercent > 15 && `${abstainPercent.toFixed(1)}%`}
                                    </div>
                                  )}
                                  {totalVotes === 0 && (
                                    <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground min-w-[40px]">
                                      No votes yet
                                    </div>
                                  )}
                                </div>

                                {/* Quorum Progress */}
                                {proposal.quorum && (
                                  <div className="space-y-1">
                                    <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-1 text-xs">
                                      <span className="text-muted-foreground">Quorum Progress</span>
                                      <span className={totalVotes >= parseFloat(proposal.quorum) ? "text-green-500 font-bold" : "text-yellow-500"}>
                                        {totalVotes >= parseFloat(proposal.quorum) ? "✓ Reached" : `${((totalVotes / parseFloat(proposal.quorum)) * 100).toFixed(1)}%`}
                                      </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className={`h-full transition-all ${totalVotes >= parseFloat(proposal.quorum) ? 'bg-green-500' : 'bg-yellow-500'}`}
                                        style={{ width: `${Math.min((totalVotes / parseFloat(proposal.quorum)) * 100, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* Vote Stats */}
                          <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            <div className="text-center p-2 sm:p-3 rounded-lg bg-green-500/10">
                              <div className="text-xs sm:text-sm text-muted-foreground">For</div>
                              <div className="text-base sm:text-lg font-bold text-green-500 truncate">
                                {parseFloat(proposal.forVotes).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-center p-2 sm:p-3 rounded-lg bg-red-500/10">
                              <div className="text-xs sm:text-sm text-muted-foreground">Against</div>
                              <div className="text-base sm:text-lg font-bold text-red-500 truncate">
                                {parseFloat(proposal.againstVotes).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-center p-2 sm:p-3 rounded-lg bg-gray-500/10">
                              <div className="text-xs sm:text-sm text-muted-foreground">Abstain</div>
                              <div className="text-base sm:text-lg font-bold text-gray-500 truncate">
                                {parseFloat(proposal.abstainVotes).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          {/* Time Remaining for Active Proposals */}
                          {proposal.stateId === 1 && (
                            <ProposalTimer
                              endBlock={proposal.endBlock}
                              proposalId={proposal.id}
                            />
                          )}

                          {/* Actions */}
                          {proposal.stateId === 1 && (
                            <ProposalVoting
                              proposal={proposal}
                              address={address}
                              isConnected={isConnected}
                              votingPower={votingPower}
                              publicClient={publicClient}
                              onVote={handleVote}
                            />
                          )}

                          {proposal.stateId === 4 && (
                            <Button onClick={() => handleQueueProposal(proposal.id)} className="w-full">
                              Queue for Execution
                            </Button>
                          )}

                          {proposal.stateId === 5 && (
                            <Button onClick={() => handleExecuteProposal(proposal.id)} className="w-full gradient-primary">
                              Execute Proposal
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </TabsContent>

            {/* Delegation Tab */}
            <TabsContent value="delegation" className="space-y-4">
              <Card className="gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    Voting Power Delegation
                  </CardTitle>
                  <CardDescription>
                    Delegate your voting power to another address or reclaim it
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current Delegation Status */}
                  <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Your Voting Power</span>
                        <span className="text-lg font-bold text-indigo-400">
                          {parseFloat(votingPower).toLocaleString()} BTC1
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Token Balance</span>
                        <span className="text-lg font-bold text-indigo-400">
                          {parseFloat(votingPower).toLocaleString()} BTC1
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delegation Form */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="delegate-address">Delegate To Address</Label>
                      <Input
                        id="delegate-address"
                        placeholder="0x... (or leave empty to delegate to yourself)"
                        className="font-mono"
                        onChange={(e) => {
                          const delegateInput = e.target.value
                          // Store in state if needed
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter an address to delegate your voting power, or leave empty to self-delegate
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => {
                          const input = (document.getElementById('delegate-address') as HTMLInputElement)?.value
                          const delegatee = input || address
                          if (!delegatee) {
                            alert('Please enter a valid address')
                            return
                          }
                          if (!confirm(`Delegate voting power to ${delegatee}?`)) return

                          writeContract({
                            address: CONTRACT_ADDRESSES.GOVERNANCE_DAO as `0x${string}`,
                            abi: GOVERNANCE_DAO_ABI,
                            functionName: 'delegate',
                            args: [delegatee as `0x${string}`],
                          })
                        }}
                        disabled={!isConnected}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Delegate Votes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!address) return
                          if (!confirm('Delegate voting power to yourself?')) return

                          writeContract({
                            address: CONTRACT_ADDRESSES.GOVERNANCE_DAO as `0x${string}`,
                            abi: GOVERNANCE_DAO_ABI,
                            functionName: 'delegate',
                            args: [address],
                          })
                        }}
                        disabled={!isConnected}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Self-Delegate
                      </Button>
                    </div>
                  </div>

                  {/* Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <div className="font-semibold text-blue-400 mb-1">What is Delegation?</div>
                          <div className="text-muted-foreground">
                            Delegation allows you to assign your voting power to another address without
                            transferring tokens. The delegate can vote on your behalf.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <div className="font-semibold text-green-400 mb-1">Self-Delegation</div>
                          <div className="text-muted-foreground">
                            To use your voting power yourself, you must first self-delegate.
                            This activates your voting power for governance participation.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Important Notice */}
                  <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                      <div className="text-sm text-muted-foreground">
                        <strong className="text-yellow-400">Important:</strong> Delegating does not transfer
                        token ownership. You retain full control of your tokens and can change delegation at any time.
                        Delegation takes effect for future proposals only.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          ) : (
            /* For Normal Users: Show only proposals list without tabs */
            <div className="space-y-4 mt-6">
              {/* Proposals List */}
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8 text-gray-400">Loading proposals...</div>
                ) : proposals.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No proposals found.
                  </div>
                ) : (
                  proposals.map((proposal) => {
                    const categoryInfo = getCategoryInfo(proposal.categoryId)
                    const stateInfo = getStateInfo(proposal.stateId)

                    return (
                      <Card key={proposal.id} className="bg-gray-800/50 border-gray-700">
                        <CardHeader>
                          <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge className={`${categoryInfo.color} text-white`}>
                                  <categoryInfo.icon className="w-3 h-3 mr-1" />
                                  <span className="text-xs sm:text-sm">{categoryInfo.name}</span>
                                </Badge>
                                <Badge className={`${stateInfo.color} text-white`}>
                                  <stateInfo.icon className="w-3 h-3 mr-1" />
                                  <span className="text-xs sm:text-sm">{stateInfo.name}</span>
                                </Badge>
                                <span className="text-xs text-gray-500">#{proposal.id}</span>
                              </div>
                              <CardTitle className="text-lg sm:text-xl text-white">{proposal.title}</CardTitle>
                              <CardDescription className="mt-2 text-gray-400 text-sm">{proposal.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          {/* Vote Progress Bar */}
                          {(() => {
                            const forVotes = parseFloat(proposal.forVotes)
                            const againstVotes = parseFloat(proposal.againstVotes)
                            const abstainVotes = parseFloat(proposal.abstainVotes)
                            const totalVotes = forVotes + againstVotes + abstainVotes
                            const forPercent = totalVotes > 0 ? (forVotes / totalVotes) * 100 : 0
                            const againstPercent = totalVotes > 0 ? (againstVotes / totalVotes) * 100 : 0
                            const abstainPercent = totalVotes > 0 ? (abstainVotes / totalVotes) * 100 : 0

                            return (
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-400">
                                  <span>Total Votes: {totalVotes.toLocaleString()}</span>
                                  <span>Quorum: {proposal.quorum ? parseFloat(proposal.quorum).toLocaleString() : 'N/A'}</span>
                                </div>

                                {/* Progress Bar */}
                                <div className="h-8 rounded-lg overflow-hidden bg-gray-700 flex flex-wrap">
                                  {forPercent > 0 && (
                                    <div
                                      className="bg-green-500 flex items-center justify-center text-xs font-bold text-white transition-all min-w-[20px]"
                                      style={{ width: `${forPercent}%` }}
                                    >
                                      {forPercent > 15 && `${forPercent.toFixed(1)}%`}
                                    </div>
                                  )}
                                  {againstPercent > 0 && (
                                    <div
                                      className="bg-red-500 flex items-center justify-center text-xs font-bold text-white transition-all min-w-[20px]"
                                      style={{ width: `${againstPercent}%` }}
                                    >
                                      {againstPercent > 15 && `${againstPercent.toFixed(1)}%`}
                                    </div>
                                  )}
                                  {abstainPercent > 0 && (
                                    <div
                                      className="bg-gray-500 flex items-center justify-center text-xs font-bold text-white transition-all min-w-[20px]"
                                      style={{ width: `${abstainPercent}%` }}
                                    >
                                      {abstainPercent > 15 && `${abstainPercent.toFixed(1)}%`}
                                    </div>
                                  )}
                                  {totalVotes === 0 && (
                                    <div className="flex-1 flex items-center justify-center text-xs text-gray-400 min-w-[40px]">
                                      No votes yet
                                    </div>
                                  )}
                                </div>

                                {/* Quorum Progress */}
                                {proposal.quorum && (
                                  <div className="space-y-1">
                                    <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-1 text-xs">
                                      <span className="text-gray-400">Quorum Progress</span>
                                      <span className={totalVotes >= parseFloat(proposal.quorum) ? "text-green-500 font-bold" : "text-yellow-500"}>
                                        {totalVotes >= parseFloat(proposal.quorum) ? "✓ Reached" : `${((totalVotes / parseFloat(proposal.quorum)) * 100).toFixed(1)}%`}
                                      </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                                      <div
                                        className={`h-full transition-all ${totalVotes >= parseFloat(proposal.quorum) ? 'bg-green-500' : 'bg-yellow-500'}`}
                                        style={{ width: `${Math.min((totalVotes / parseFloat(proposal.quorum)) * 100, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* Vote Stats */}
                          <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            <div className="text-center p-2 sm:p-3 rounded-lg bg-green-500/10">
                              <div className="text-xs sm:text-sm text-gray-400">For</div>
                              <div className="text-base sm:text-lg font-bold text-green-500 truncate">
                                {parseFloat(proposal.forVotes).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-center p-2 sm:p-3 rounded-lg bg-red-500/10">
                              <div className="text-xs sm:text-sm text-gray-400">Against</div>
                              <div className="text-base sm:text-lg font-bold text-red-500 truncate">
                                {parseFloat(proposal.againstVotes).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-center p-2 sm:p-3 rounded-lg bg-gray-500/10">
                              <div className="text-xs sm:text-sm text-gray-400">Abstain</div>
                              <div className="text-base sm:text-lg font-bold text-gray-500 truncate">
                                {parseFloat(proposal.abstainVotes).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          {/* Time Remaining for Active Proposals */}
                          {proposal.stateId === 1 && (
                            <ProposalTimer
                              endBlock={proposal.endBlock}
                              proposalId={proposal.id}
                            />
                          )}

                          {/* Voting Actions */}
                          {proposal.stateId === 1 && (
                            <ProposalVoting
                              proposal={proposal}
                              address={address}
                              isConnected={isConnected}
                              votingPower={votingPower}
                              publicClient={publicClient}
                              onVote={handleVote}
                            />
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Proposal Modal (Admin Only) */}
      {showCreateProposal && isAdmin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto animate-in fade-in duration-200">
          <div className="min-h-screen flex items-start sm:items-center justify-center p-3 sm:p-4 py-6 sm:py-8">
            <Card className="w-full max-w-3xl bg-gradient-to-br from-gray-900 to-gray-800 border-orange-500/30 shadow-2xl shadow-orange-500/20 my-auto">
              {/* Header */}
              <CardHeader className="border-b border-gray-700 pb-3 sm:pb-4 bg-gradient-to-br from-gray-900 to-gray-800 rounded-t-lg sticky top-0 z-20">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                    <Plus className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-xl lg:text-2xl text-white leading-tight">Create New Proposal</CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">Create a proposal for community voting</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowCreateProposal(false)}
                    className="text-gray-400 hover:text-white hover:bg-gray-800 flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 -mt-1 sm:mt-0"
                  >
                    <CloseIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </div>
              </CardHeader>

              {/* Content */}
              <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 pb-4 sm:pb-6">
              <div className="space-y-1.5">
                <Label htmlFor="proposal-title" className="text-white font-medium text-sm">Proposal Title</Label>
                <Input
                  id="proposal-title"
                  placeholder="e.g., Increase Collateral Ratio to 125%"
                  value={proposalForm.title}
                  onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-orange-500 h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proposal-description" className="text-white font-medium text-sm">Description</Label>
                <Textarea
                  id="proposal-description"
                  placeholder="Explain the proposal and its benefits..."
                  rows={3}
                  value={proposalForm.description}
                  onChange={(e) => setProposalForm({ ...proposalForm, description: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-orange-500 text-sm resize-none min-h-[72px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proposal-category" className="text-white font-medium text-sm">Category</Label>
                <Select
                  value={proposalForm.category.toString()}
                  onValueChange={(value) => setProposalForm({ ...proposalForm, category: parseInt(value) })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-orange-500 focus:ring-orange-500 h-10 text-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 max-h-[240px]">
                    {PROPOSAL_CATEGORIES.map((cat) => {
                      const Icon = cat.icon
                      return (
                        <SelectItem key={cat.id} value={cat.id.toString()} className="text-white hover:bg-gray-700 text-sm">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" />
                            <span>{cat.name}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">
                  {PROPOSAL_CATEGORIES.find(c => c.id === proposalForm.category)?.description}
                </p>
              </div>

              {/* Category-specific fields */}
              {proposalForm.category === 0 && (
                <div className="space-y-3 p-3 sm:p-4 border border-orange-500/30 rounded-lg bg-orange-500/5">
                  <h4 className="font-semibold text-white flex items-center gap-2 text-sm">
                    <Settings className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span>Parameter Change Details</span>
                  </h4>
                  <div className="space-y-1.5">
                    <Label className="text-white font-medium text-sm">Parameter to Change</Label>
                    <Select
                      value={proposalForm.parameter}
                      onValueChange={(value) => setProposalForm({ ...proposalForm, parameter: value })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-orange-500 h-10 text-sm">
                        <SelectValue placeholder="Select parameter" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="minCollateralRatio" className="text-white hover:bg-gray-700 text-sm">Min Collateral Ratio</SelectItem>
                        <SelectItem value="devFeeMint" className="text-white hover:bg-gray-700 text-sm">Dev Fee (Mint)</SelectItem>
                        <SelectItem value="devFeeRedeem" className="text-white hover:bg-gray-700 text-sm">Dev Fee (Redeem)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white font-medium text-sm">New Value</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 1.25 for 125%"
                      value={proposalForm.newValue}
                      onChange={(e) => setProposalForm({ ...proposalForm, newValue: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-orange-500 h-10 text-sm"
                    />
                    <p className="text-xs text-gray-400">Enter decimal value (e.g., 1.25 for 125%)</p>
                  </div>
                </div>
              )}

              {proposalForm.category === 4 && (
                <div className="space-y-3 p-3 sm:p-4 border border-pink-500/30 rounded-lg bg-pink-500/5">
                  <h4 className="font-semibold text-white flex items-center gap-2 text-sm">
                    <Heart className="w-4 h-4 text-pink-500 flex-shrink-0" />
                    <span>Non-Profit Organization Details</span>
                  </h4>
                  <div className="space-y-1.5">
                    <Label className="text-white font-medium text-sm">Organization Name</Label>
                    <Input
                      placeholder="e.g., Islamic Relief"
                      value={proposalForm.nonProfitName}
                      onChange={(e) => setProposalForm({ ...proposalForm, nonProfitName: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-pink-500 focus:ring-pink-500 h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white font-medium text-sm">Wallet Address</Label>
                    <Input
                      placeholder="0x..."
                      value={proposalForm.nonProfitWallet}
                      onChange={(e) => setProposalForm({ ...proposalForm, nonProfitWallet: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-pink-500 focus:ring-pink-500 h-10 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white font-medium text-sm">Organization Description</Label>
                    <Textarea
                      placeholder="Brief description of the organization's mission"
                      rows={2}
                      value={proposalForm.nonProfitDescription}
                      onChange={(e) => setProposalForm({ ...proposalForm, nonProfitDescription: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-pink-500 focus:ring-pink-500 text-sm resize-none min-h-[60px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white font-medium text-sm">Website (optional)</Label>
                    <Input
                      placeholder="https://..."
                      value={proposalForm.nonProfitWebsite}
                      onChange={(e) => setProposalForm({ ...proposalForm, nonProfitWebsite: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-pink-500 focus:ring-pink-500 h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white font-medium text-sm">Category</Label>
                    <Select
                      value={proposalForm.nonProfitCategory.toString()}
                      onValueChange={(value) => setProposalForm({ ...proposalForm, nonProfitCategory: parseInt(value) })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-pink-500 h-10 text-sm">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 max-h-[200px]">
                        {CATEGORY_NAMES.map((name, idx) => (
                          <SelectItem key={idx} value={idx.toString()} className="text-white hover:bg-gray-700 text-sm">{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {proposalForm.category === 1 && (
                <div className="space-y-3 p-3 sm:p-4 border border-blue-500/30 rounded-lg bg-blue-500/5">
                  <h4 className="font-semibold text-white flex items-center gap-2 text-sm">
                    <Code className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span>Contract Upgrade Details</span>
                  </h4>
                  <div className="space-y-1.5">
                    <Label className="text-white font-medium text-sm">Contract Name</Label>
                    <Select
                      value={proposalForm.contractName}
                      onValueChange={(value) => setProposalForm({ ...proposalForm, contractName: value })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-blue-500 h-10 text-sm">
                        <SelectValue placeholder="Select contract" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="vault" className="text-white hover:bg-gray-700 text-sm">Vault</SelectItem>
                        <SelectItem value="endowment" className="text-white hover:bg-gray-700 text-sm">Endowment Manager</SelectItem>
                        <SelectItem value="distribution" className="text-white hover:bg-gray-700 text-sm">Weekly Distribution</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white font-medium text-sm">New Contract Address</Label>
                    <Input
                      placeholder="0x..."
                      value={proposalForm.newContractAddress}
                      onChange={(e) => setProposalForm({ ...proposalForm, newContractAddress: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Info Notice */}
              <div className="pt-3 border-t border-gray-700 mt-1">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs text-gray-300 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span className="flex-1">
                      Quorum Required: <strong className="text-blue-400">{PROPOSAL_CATEGORIES.find(c => c.id === proposalForm.category)?.id === 0 ? "4%" :
                        PROPOSAL_CATEGORIES.find(c => c.id === proposalForm.category)?.id === 1 ? "10%" :
                        PROPOSAL_CATEGORIES.find(c => c.id === proposalForm.category)?.id === 4 ? "3%" :
                        PROPOSAL_CATEGORIES.find(c => c.id === proposalForm.category)?.id === 5 ? "2%" : "Varies"}%</strong> of total supply
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 pl-5">
                    After proposal passes, there's a 2-day timelock before execution
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-4 border-t border-gray-700 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateProposal(false)}
                  disabled={isCreatingProposal}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white h-10 text-sm w-full xs:w-auto px-5"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30 h-10 text-sm w-full xs:w-auto px-5"
                  onClick={handleCreateProposal}
                  disabled={isCreatingProposal}
                >
                  {isCreatingProposal ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Proposal
                    </>
                  )}
                </Button>
              </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
