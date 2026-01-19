"use client";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SafeTransactionModal from "@/components/safe-transaction-modal";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ethers } from 'ethers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { DistributionManagement } from "@/components/distribution-management";
import { GovernancePanel } from "@/components/governance-panel";
import { UnifiedGovernanceDashboard } from "@/components/unified-governance-dashboard";
import { EndowmentManager } from "@/components/endowment-manager";
import { SecurityMonitoring } from "@/components/security-monitoring";
import { TreasuryDashboard } from "@/components/treasury-dashboard";
import DistributionAdmin from "@/components/distribution-admin";
import BTC1USDTimelockManager from "@/components/btc1usd-timelock-manager";
import FixedMerkleClaim from "@/components/fixed-merkle-claim";
import EnhancedMerkleClaim from "@/components/enhanced-merkle-claim";
import CollateralManagement from "@/components/collateral-management";
import SwapModal from "@/components/swap-modal";
import LiquidityModal from "@/components/liquidity-modal";

import { useTheme } from "next-themes";
import { useWeb3 } from "@/lib/web3-provider";
import { hasUIAccess, getAuthStatus } from '@/lib/auth-config';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useSignTypedData,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import {
  AlertCircle,
  DollarSign,
  Bitcoin,
  Heart,
  Search,
  Home,
  Plus,
  Users,
  BarChart3,
  Shield,
  Calendar,
  Menu,
  User,
  Gift,
  Activity,
  Coins,
  X as CloseIcon,
  LogOut,
  Wallet,
  Copy,
  RefreshCw,
  ChevronDown,
  Moon,
  Sun,
  Lock as LockIcon,
  ArrowLeftRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProtocolState } from "@/lib/protocol-math";
import {
  ProtocolMath,
  formatPercentage,
  formatTokens,
} from "@/lib/protocol-math";
import { CONTRACT_ADDRESSES, COLLATERAL_TOKENS } from "@/lib/contracts";
import { getPermitDomain, PERMIT_TYPES, getPermitDeadline, createPermitMessage, splitSignature } from "@/lib/permit-utils";
import { PERMIT2_ADDRESS, PERMIT2_ABI, PERMIT2_TYPES, getPermit2Domain, createPermit2Message, getPermit2Expiration, getPermit2SigDeadline, MAX_UINT160 } from "@/lib/permit2-utils";
import { usePermitTransactions } from "@/hooks/use-permit-transactions";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import {
  ArrowUpRight,
  ArrowDownRight,
  CalendarCheck,
  Vote,
} from "lucide-react";

const formatCurrency = (amount: number, decimals = 2): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

const formatBTC = (amount: number, decimals = 8): string => {
  return `${amount.toFixed(decimals)} BTC`;
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

// Format BTC1USD balance with exactly 2 decimal places and thousands separators
const formatBTC1USD = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Merkle Distributor ABI for checking claims
const MERKLE_DISTRIBUTOR_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "distributionId", type: "uint256" },
      { internalType: "uint256", name: "index", type: "uint256" },
    ],
    name: "isClaimed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface MerkleClaim {
  index: number;
  account: string;
  amount: string;
  proof: string[];
}

interface UserDistribution {
  id: number;
  merkleRoot: string;
  totalRewards: string;
  metadata: {
    generated: string;
    activeHolders: number;
    reclaimed?: boolean;
    reclaimedAt?: string;
    reclaimedAmount?: string;
  };
  claim: MerkleClaim;
  claimedOnChain?: boolean; // Whether user has already claimed this distribution
}

function Dashboard() {
  const { isConnected, address, chainId, connectWallet, disconnectWallet } =
    useWeb3();

  const { theme, setTheme } = useTheme();

  // Function to get network name from chainId
  const getNetworkName = (chainId: number | undefined) => {
    if (!chainId) return "Unknown Network";

    switch (chainId) {
      case 8453:
        return "Base";
      case 1:
        return "Ethereum";
      case 11155111:
        return "Sepolia";
      case 1337:
        return "Localhost";
      default:
        return `Network (${chainId})`;
    }
  };

  // Copy address to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };


  const { activities, isLoading: isLoadingActivities } = useRecentActivity();
  const [account, setAccount] = useState("");
  const [userBalance, setUserBalance] = useState(0);
  const [mintAmount, setMintAmount] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [selectedCollateral, setSelectedCollateral] = useState("WBTC");
  const [selectedRedeemCollateral, setSelectedRedeemCollateral] =
    useState("WBTC");
  const [activeTab, setActiveTab] = useState("overview");
  const [mintSubTab, setMintSubTab] = useState<"buy" | "sell">("buy"); // Sub-tab for mint section
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userWbtcBalance, setUserWbtcBalance] = useState("0");
  const [userCbbtcBalance, setUserCbbtcBalance] = useState("0");
  const [userTbtcBalance, setUserTbtcBalance] = useState("0");
  const [wbtcMintAmount, setWbtcMintAmount] = useState("");
  const [vaultDepositAmount, setVaultDepositAmount] = useState("");
  const [selectedMintCollateral, setSelectedMintCollateral] = useState("WBTC");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [autoHideSidebar, setAutoHideSidebar] = useState(false);
  const isMobile = useIsMobile();
  const [activeProposalsCount, setActiveProposalsCount] = useState(0);

  // Claimable rewards state
  const [claimableRewards, setClaimableRewards] = useState(0);
  const [hasClaimableRewards, setHasClaimableRewards] = useState(false);
  const [claimableDistributionCount, setClaimableDistributionCount] = useState(0); // Count of actually claimable distributions
  const [userDistributions, setUserDistributions] = useState<any[]>([]);
  const [usePermit, setUsePermit] = useState(false); // Toggle for gasless permit transactions
  const [swapModalOpen, setSwapModalOpen] = useState(false); // Swap modal state
  const [liquidityModalOpen, setLiquidityModalOpen] = useState(false); // Liquidity modal state

  // Safe Transaction Modal State
  const [safeModalOpen, setSafeModalOpen] = useState(false);
  const [safeModalConfig, setSafeModalConfig] = useState<{
    title: string;
    description: string;
    contractAddress: string;
    functionSignature: string;
    calldata: string;
    category: 'security' | 'rewards' | 'governance';
  } | null>(null);

  const handleExecuteDistribution = async () => {
    if (!isConnected || !address) {
      setTransactionStatus("Please connect your wallet first");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    // Open Safe Transaction Modal instead of executing directly
    const iface = new ethers.Interface([
      'function executeDistribution()'
    ]);
    const calldata = iface.encodeFunctionData('executeDistribution', []);

    setSafeModalConfig({
      title: 'Execute Distribution',
      description: 'Create new epoch and mint rewards to WeeklyDistribution contract',
      contractAddress: protocolState?.contractAddresses?.weeklyDistribution || '',
      functionSignature: 'executeDistribution()',
      calldata,
      category: 'rewards',
    });
    setSafeModalOpen(true);
  };

  // Helper function to open Safe modal for any admin action
  const openSafeModal = (config: {
    title: string;
    description: string;
    contractAddress: string;
    functionSignature: string;
    calldata: string;
    category: 'security' | 'rewards' | 'governance';
  }) => {
    setSafeModalConfig(config);
    setSafeModalOpen(true);
  };

  // Set Merkle Root Handler
  const handleSetMerkleRoot = (distributionId: number, merkleRoot: string) => {
    if (!isConnected || !address) {
      setTransactionStatus("Please connect your wallet first");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    // NOTE: This handler is deprecated - merkle-distribution-management.tsx handles this directly
    // Keeping for backward compatibility but should not be called
    console.warn('handleSetMerkleRoot in dashboard.tsx is deprecated - use merkle-distribution-management.tsx');
  };

  // Pause/Unpause Handlers
  const handlePauseContract = (contractName: string, contractAddress: string) => {
    if (!isConnected || !address) return;

    const iface = new ethers.Interface(['function pause()']);
    const calldata = iface.encodeFunctionData('pause', []);

    openSafeModal({
      title: `Pause ${contractName}`,
      description: `Emergency pause all operations on ${contractName} contract`,
      contractAddress,
      functionSignature: 'pause()',
      calldata,
      category: 'security',
    });
  };

  const handleUnpauseContract = (contractName: string, contractAddress: string) => {
    if (!isConnected || !address) return;

    const iface = new ethers.Interface(['function unpause()']);
    const calldata = iface.encodeFunctionData('unpause', []);

    openSafeModal({
      title: `Unpause ${contractName}`,
      description: `Resume normal operations on ${contractName} contract`,
      contractAddress,
      functionSignature: 'unpause()',
      calldata,
      category: 'security',
    });
  };

  // Lock Critical Parameters
  const handleLockCriticalParams = () => {
    if (!isConnected || !address) return;

    const iface = new ethers.Interface(['function lockCriticalParams()']);
    const calldata = iface.encodeFunctionData('lockCriticalParams', []);

    openSafeModal({
      title: 'Lock Critical Parameters',
      description: '⚠️ IRREVERSIBLE: Permanently lock vault and distribution addresses on BTC1USD',
      contractAddress: protocolState?.contractAddresses?.btc1usd || '',
      functionSignature: 'lockCriticalParams()',
      calldata,
      category: 'security',
    });
  };

  // Helper function to format distribution time
  const calculateMintDetails = (btcAmount: number) => {
    const usdValue = btcAmount * protocolState.btcPrice;
    
    // Use the current collateral ratio for mint price calculation, but ensure it's at least 1.2
    // This matches the Vault contract behavior: mintPrice = max(MIN_COLLATERAL_RATIO, totalUSD / totalSupply)
    const mintPrice = Math.max(1.2, collateralRatio || 1.2);

    const tokensToMint = usdValue / mintPrice;
    const devFee = tokensToMint * 0.01; // 1%
    const endowmentFee = tokensToMint * 0.01; // 1%
    const totalMinted = tokensToMint + devFee + endowmentFee;

    // Calculate new collateral ratio considering the new deposit
    // This simulates the real Vault contract behavior for display purposes
    const currentCollateralValue = totalCollateralUSD || 0;
    const newCollateralValue = currentCollateralValue + usdValue;
    const newTotalSupply = protocolState.totalSupply + totalMinted;
    const newRatio = newTotalSupply > 0 ? newCollateralValue / newTotalSupply : 1.2;

    return {
      usdValue,
      currentRatio: newRatio,
      mintPrice,
      tokensToMint,
      devFee,
      endowmentFee,
      totalMinted,
      userReceives: tokensToMint,
    };
  };

  // Helper function to calculate redeem details
  const calculateRedeemDetails = (tokenAmount: number) => {
    const currentRatio = collateralRatio;
    const isStressMode = currentRatio < 1.1;

    let effectivePrice: number;
    let redemptionMode: string;

    if (isStressMode) {
      effectivePrice = 0.9 * currentRatio;
      redemptionMode = "Stress Mode";
    } else {
      effectivePrice = 1.0;
      redemptionMode = "Healthy Mode";
    }

    const grossBtcValue =
      (tokenAmount * effectivePrice) / protocolState.btcPrice;
    const devFee = grossBtcValue * 0.001; // 0.1%
    const btcToReceive = grossBtcValue - devFee;
    const usdValue = btcToReceive * protocolState.btcPrice;

    // Calculate new collateral ratio after redemption
    const newTotalSupply = protocolState.totalSupply - tokenAmount;
    const usdValueRedeemed = grossBtcValue * protocolState.btcPrice;
    const newCollateralValue = totalCollateralUSD - usdValueRedeemed;
    const newRatio =
      newTotalSupply > 0 ? newCollateralValue / newTotalSupply : 0;

    return {
      currentRatio,
      isStressMode,
      effectivePrice,
      redemptionMode,
      grossBtcValue,
      devFee,
      btcToReceive,
      usdValue,
      newTotalSupply,
      newCollateralValue,
      newRatio,
    };
  };

  const [protocolState, setProtocolState] = useState<ProtocolState>({
    btcPrice: 100000, // $100,000
    totalSupply: 0,
    collateralBalances: {
      wbtc: 0,
      cbbtc: 0,
      tbtc: 0,
    },
    devWallet: 0,
    endowmentWallet: 0,
    contractAddresses: {
      btc1usd:
        process.env.NEXT_PUBLIC_BTC1USD_CONTRACT ||
        CONTRACT_ADDRESSES.BTC1USD,
      vault:
        process.env.NEXT_PUBLIC_VAULT_CONTRACT ||
        CONTRACT_ADDRESSES.VAULT,
      priceOracle:
        process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT ||
        CONTRACT_ADDRESSES.CHAINLINK_BTC_ORACLE,
      weeklyDistribution:
        process.env.NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT ||
        CONTRACT_ADDRESSES.WEEKLY_DISTRIBUTION,
      merkleDistributor:
        process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT ||
        CONTRACT_ADDRESSES.MERKLE_DISTRIBUTOR,
      endowmentManager:
        process.env.NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT ||
        CONTRACT_ADDRESSES.ENDOWMENT_MANAGER,
      protocolGovernance:
        process.env.NEXT_PUBLIC_PROTOCOL_GOVERNANCE_CONTRACT ||
        CONTRACT_ADDRESSES.PROTOCOL_GOVERNANCE,
      wbtc:
        process.env.NEXT_PUBLIC_WBTC_TOKEN ||
        CONTRACT_ADDRESSES.WBTC_TOKEN, // Fixed: Use CONTRACT_ADDRESSES.WBTC_TOKEN instead of COLLATERAL_TOKENS[0].address
      cbbtc:
        process.env.NEXT_PUBLIC_CBBTC_TOKEN ||
        CONTRACT_ADDRESSES.CBBTC_TOKEN, // Fixed: Use CONTRACT_ADDRESSES.CBBTC_TOKEN instead of COLLATERAL_TOKENS[1].address
      tbtc:
        process.env.NEXT_PUBLIC_TBTC_TOKEN ||
        CONTRACT_ADDRESSES.TBTC_TOKEN, // Fixed: Use CONTRACT_ADDRESSES.TBTC_TOKEN instead of COLLATERAL_TOKENS[2].address
    },
  });

  // BTC1USD balance reading
  const { data: btc1usdBalance, refetch: refetchBtc1usdBalance } =
    useReadContract({
      address: protocolState?.contractAddresses?.btc1usd as any,
      abi: [
        {
          inputs: [
            {
              internalType: "address",
              name: "account",
              type: "address",
            },
          ],
          name: "balanceOf",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "balanceOf",
      args: address ? [address as any] : undefined,
      query: {
        enabled: !!address && !!protocolState?.contractAddresses?.btc1usd,
      },
    });

  // Read permit nonces for collateral tokens (for mintWithPermit)
  const { data: wbtcNonce } = useReadContract({
    address: protocolState?.contractAddresses?.wbtc as `0x${string}`,
    abi: [{
      inputs: [{ internalType: "address", name: "owner", type: "address" }],
      name: "nonces",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    }],
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!protocolState?.contractAddresses?.wbtc },
  });

  const { data: cbbtcNonce } = useReadContract({
    address: protocolState?.contractAddresses?.cbbtc as `0x${string}`,
    abi: [{
      inputs: [{ internalType: "address", name: "owner", type: "address" }],
      name: "nonces",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    }],
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!protocolState?.contractAddresses?.cbbtc },
  });

  const { data: tbtcNonce } = useReadContract({
    address: protocolState?.contractAddresses?.tbtc as `0x${string}`,
    abi: [{
      inputs: [{ internalType: "address", name: "owner", type: "address" }],
      name: "nonces",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    }],
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!protocolState?.contractAddresses?.tbtc },
  });

  // Read permit nonce for BTC1USD (for redeemWithPermit)
  const { data: btc1usdNonce } = useReadContract({
    address: protocolState?.contractAddresses?.btc1usd as `0x${string}`,
    abi: [{
      inputs: [{ internalType: "address", name: "owner", type: "address" }],
      name: "nonces",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    }],
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!protocolState?.contractAddresses?.btc1usd },
  });

  // Read Permit2 allowances (for tokens without native EIP-2612)
  const { data: wbtcPermit2Allowance } = useReadContract({
    address: PERMIT2_ADDRESS as `0x${string}`,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args: address && protocolState?.contractAddresses?.wbtc && protocolState?.contractAddresses?.vault
      ? [address, protocolState.contractAddresses.wbtc as `0x${string}`, protocolState.contractAddresses.vault as `0x${string}`]
      : undefined,
    query: { enabled: !!address && !!protocolState?.contractAddresses?.wbtc && !!protocolState?.contractAddresses?.vault },
  });

  const { data: cbbtcPermit2Allowance } = useReadContract({
    address: PERMIT2_ADDRESS as `0x${string}`,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args: address && protocolState?.contractAddresses?.cbbtc && protocolState?.contractAddresses?.vault
      ? [address, protocolState.contractAddresses.cbbtc as `0x${string}`, protocolState.contractAddresses.vault as `0x${string}`]
      : undefined,
    query: { enabled: !!address && !!protocolState?.contractAddresses?.cbbtc && !!protocolState?.contractAddresses?.vault },
  });

  const { data: tbtcPermit2Allowance } = useReadContract({
    address: PERMIT2_ADDRESS as `0x${string}`,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args: address && protocolState?.contractAddresses?.tbtc && protocolState?.contractAddresses?.vault
      ? [address, protocolState.contractAddresses.tbtc as `0x${string}`, protocolState.contractAddresses.vault as `0x${string}`]
      : undefined,
    query: { enabled: !!address && !!protocolState?.contractAddresses?.tbtc && !!protocolState?.contractAddresses?.vault },
  });

  // BTC1USD total supply reading
  const { data: btc1usdTotalSupply, refetch: refetchTotalSupply } =
    useReadContract({
      address: protocolState?.contractAddresses?.btc1usd as any,
      abi: [
        {
          inputs: [],
          name: "totalSupply",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "totalSupply",
      query: {
        enabled: !!protocolState?.contractAddresses?.btc1usd,
      },
    });

  // BTC Price from Oracle (non-reverting display method)
  const { data: btcPrice, refetch: refetchBtcPrice } = useReadContract({
    address: protocolState?.contractAddresses?.priceOracle as any,
    abi: [
      {
        inputs: [],
        name: "getBTCPrice",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      }
    ],
    functionName: "getBTCPrice",
    query: {
      enabled: !!protocolState?.contractAddresses?.priceOracle,
    },
  });

  // Collateral Ratio from Vault
  const { data: vaultCollateralRatio, refetch: refetchCollateralRatio } =
    useReadContract({
      address: protocolState?.contractAddresses?.vault as any,
      abi: [
        {
          inputs: [],
          name: "getCurrentCollateralRatio",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "getCurrentCollateralRatio",
      query: {
        enabled: !!protocolState?.contractAddresses?.vault,
      },
    });

  // Total Collateral Value from Vault
  const { data: totalCollateralValue, refetch: refetchCollateralValue } =
    useReadContract({
      address: protocolState?.contractAddresses?.vault as any,
      abi: [
        {
          inputs: [],
          name: "getTotalCollateralValue",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "getTotalCollateralValue",
      query: {
        enabled: !!protocolState?.contractAddresses?.vault,
      },
    });

  // Vault Collateral Balance ABI (reused for all collateral types)
  const VAULT_COLLATERAL_BALANCE_ABI = [
    {
      inputs: [
        {
          internalType: "address",
          name: "collateralToken",
          type: "address",
        },
      ],
      name: "collateralBalances",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ];

  // WBTC Collateral Balance from Vault
  const { data: vaultWbtcBalance, refetch: refetchVaultWbtcBalance } =
    useReadContract({
      address: protocolState?.contractAddresses?.vault as any,
      abi: VAULT_COLLATERAL_BALANCE_ABI,
      functionName: "collateralBalances",
      args: protocolState?.contractAddresses?.wbtc
        ? [protocolState.contractAddresses.wbtc as any]
        : undefined,
      query: {
        enabled:
          !!protocolState?.contractAddresses?.vault &&
          !!protocolState?.contractAddresses?.wbtc,
      },
    });

  // cbBTC Collateral Balance from Vault
  const { data: vaultCbbtcBalance, refetch: refetchVaultCbbtcBalance } =
    useReadContract({
      address: protocolState?.contractAddresses?.vault as any,
      abi: VAULT_COLLATERAL_BALANCE_ABI,
      functionName: "collateralBalances",
      args: protocolState?.contractAddresses?.cbbtc
        ? [protocolState.contractAddresses.cbbtc as any]
        : undefined,
      query: {
        enabled:
          !!protocolState?.contractAddresses?.vault &&
          !!protocolState?.contractAddresses?.cbbtc,
      },
    });

  // tBTC Collateral Balance from Vault
  const { data: vaultTbtcBalance, refetch: refetchVaultTbtcBalance } =
    useReadContract({
      address: protocolState?.contractAddresses?.vault as any,
      abi: VAULT_COLLATERAL_BALANCE_ABI,
      functionName: "collateralBalances",
      args: protocolState?.contractAddresses?.tbtc
        ? [protocolState.contractAddresses.tbtc as any]
        : undefined,
      query: {
        enabled:
          !!protocolState?.contractAddresses?.vault &&
          !!protocolState?.contractAddresses?.tbtc,
      },
    });
  
  // ============ COMPREHENSIVE VAULT DEBUG ============
  console.log("\n============ VAULT COLLATERAL DEBUG ============");
  console.log("🔍 Contract Addresses:");
  console.log("  Vault:", protocolState?.contractAddresses?.vault);
  console.log("  WBTC:", protocolState?.contractAddresses?.wbtc);
  console.log("  cbBTC:", protocolState?.contractAddresses?.cbbtc);
  console.log("  tBTC:", protocolState?.contractAddresses?.tbtc);
  console.log("\n🔍 Vault Collateral Balances:");
  console.log("  WBTC:", vaultWbtcBalance?.toString(), "(", vaultWbtcBalance ? formatUnits(vaultWbtcBalance as unknown as bigint, 8) : "0", "BTC)");
  console.log("  cbBTC:", vaultCbbtcBalance?.toString(), "(", vaultCbbtcBalance ? formatUnits(vaultCbbtcBalance as unknown as bigint, 8) : "0", "BTC)");
  console.log("  tBTC:", vaultTbtcBalance?.toString(), "(", vaultTbtcBalance ? formatUnits(vaultTbtcBalance as unknown as bigint, 8) : "0", "BTC)");
  console.log("\n🔍 Your BTC1 Balance:", btc1usdBalance?.toString(), "(", btc1usdBalance ? formatUnits(btc1usdBalance as unknown as bigint, 8) : "0", "BTC1)");
  console.log("============================================\n");

  // Dev Wallet BTC1USD Balance - Updated from deployment config
  const { data: devWalletBalance, refetch: refetchDevWalletBalance } =
    useReadContract({
      address: protocolState?.contractAddresses?.btc1usd as any,
      abi: [
        {
          inputs: [
            {
              internalType: "address",
              name: "account",
              type: "address",
            },
          ],
          name: "balanceOf",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "balanceOf",
      args: [CONTRACT_ADDRESSES.DEV_WALLET as `0x${string}`], // Dev wallet address from deployment config
      query: {
        enabled: !!protocolState?.contractAddresses?.btc1usd,
      },
    });

  // Endowment Wallet BTC1USD Balance - Updated from deployment config
  const {
    data: endowmentWalletBalance,
    refetch: refetchEndowmentWalletBalance,
  } = useReadContract({
    address: protocolState?.contractAddresses?.btc1usd as any,
    abi: [
      {
        inputs: [
          {
            internalType: "address",
            name: "account",
            type: "address",
          },
        ],
        name: "balanceOf",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "balanceOf",
    args: [CONTRACT_ADDRESSES.ENDOWMENT_WALLET as `0x${string}`], // Endowment wallet address from deployment config
    query: {
      enabled: !!protocolState?.contractAddresses?.btc1usd,
    },
  });

  // Merkle Distributor BTC1USD Balance
  const {
    data: merkleDistributorBalance,
    refetch: refetchMerkleDistributorBalance,
  } = useReadContract({
    address: protocolState?.contractAddresses?.btc1usd as any,
    abi: [
      {
        inputs: [
          {
            internalType: "address",
            name: "account",
            type: "address",
          },
        ],
        name: "balanceOf",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "balanceOf",
    args: [CONTRACT_ADDRESSES.MERKLE_DISTRIBUTOR as `0x${string}`], // Merkle distributor address from deployment config
    query: {
      enabled: !!protocolState?.contractAddresses?.btc1usd,
    },
  });

  // Merkle Fee Collector BTC1USD Balance
  const {
    data: merklFeeCollectorBalance,
    refetch: refetchMerklFeeCollectorBalance,
  } = useReadContract({
    address: protocolState?.contractAddresses?.btc1usd as any,
    abi: [
      {
        inputs: [
          {
            internalType: "address",
            name: "account",
            type: "address",
          },
        ],
        name: "balanceOf",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "balanceOf",
    args: [CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR as `0x${string}`], // Merkle fee collector address from deployment config
    query: {
      enabled: !!protocolState?.contractAddresses?.btc1usd,
    },
  });

  // Weekly Distribution Contract Calls
  const {
    data: canExecuteDistribution,
    refetch: refetchCanExecuteDistribution,
  } = useReadContract({
    address: protocolState?.contractAddresses?.weeklyDistribution as any,
    abi: [
      {
        inputs: [],
        name: "canDistribute",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "canDistribute",
    query: {
      enabled: !!protocolState?.contractAddresses?.weeklyDistribution,
    },
  });

  const { data: nextDistributionTime, refetch: refetchNextDistributionTime } =
    useReadContract({
      address: protocolState?.contractAddresses?.weeklyDistribution as any,
      abi: [
        {
          inputs: [],
          name: "getNextDistributionTime",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "getNextDistributionTime",
      query: {
        enabled: !!protocolState?.contractAddresses?.weeklyDistribution,
      },
    });

  const { data: distributionCount, refetch: refetchDistributionCount } =
    useReadContract({
      address: protocolState?.contractAddresses?.weeklyDistribution as any,
      abi: [
        {
          inputs: [],
          name: "distributionCount",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "distributionCount",
      query: {
        enabled: !!protocolState?.contractAddresses?.weeklyDistribution,
      },
    });

  const { data: currentRewardPerToken, refetch: refetchCurrentRewardPerToken } =
    useReadContract({
      address: protocolState?.contractAddresses?.weeklyDistribution as any,
      abi: [
        {
          inputs: [
            {
              internalType: "uint256",
              name: "collateralRatio",
              type: "uint256",
            },
          ],
          name: "getRewardPerToken",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "pure",
          type: "function",
        },
      ],
      functionName: "getRewardPerToken",
      args: vaultCollateralRatio ? [vaultCollateralRatio] : undefined,
      query: {
        enabled:
          !!protocolState?.contractAddresses?.weeklyDistribution &&
          !!vaultCollateralRatio,
      },
    });

  // Collateral balance reading
  const ERC20_BALANCE_ABI = [
    {
      inputs: [{ internalType: "address", name: "account", type: "address" }],
      name: "balanceOf",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
  ];

  const { data: wbtcBalance, refetch: refetchWbtcBalance } = useReadContract({
    address: protocolState?.contractAddresses?.wbtc as any,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address as any] : undefined,
    query: {
      enabled: !!address && !!protocolState?.contractAddresses?.wbtc,
    },
  });

  const { data: cbbtcBalance, refetch: refetchCbbtcBalance } = useReadContract({
    address: protocolState?.contractAddresses?.cbbtc as any,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address as any] : undefined,
    query: {
      enabled: !!address && !!protocolState?.contractAddresses?.cbbtc,
    },
  });

  const { data: tbtcBalance, refetch: refetchTbtcBalance } = useReadContract({
    address: protocolState?.contractAddresses?.tbtc as any,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address as any] : undefined,
    query: {
      enabled: !!address && !!protocolState?.contractAddresses?.tbtc,
    },
  });

  useEffect(() => {
    if (btc1usdBalance !== undefined) {
      // BTC1USD has 8 decimals
      const formattedBalance = parseFloat(formatUnits(btc1usdBalance, 8));
      console.log("BTC1USD balance updated:", formattedBalance);
      setUserBalance(formattedBalance);
    }
  }, [btc1usdBalance]);

  useEffect(() => {
    if (wbtcBalance !== undefined) {
      const formattedBalance = wbtcBalance ? formatUnits(wbtcBalance as bigint, 8) : "0";
      console.log("WBTC balance updated:", formattedBalance);
      setUserWbtcBalance(formattedBalance);
    }
  }, [wbtcBalance]);

  useEffect(() => {
    if (cbbtcBalance !== undefined) {
      const formattedBalance = cbbtcBalance ? formatUnits(cbbtcBalance as bigint, 8) : "0";
      console.log("cbBTC balance updated:", formattedBalance);
      setUserCbbtcBalance(formattedBalance);
    }
  }, [cbbtcBalance]);

  useEffect(() => {
    if (tbtcBalance !== undefined) {
      const formattedBalance = tbtcBalance ? formatUnits(tbtcBalance as bigint, 8) : "0";
      console.log("tBTC balance updated:", formattedBalance);
      setUserTbtcBalance(formattedBalance);
    }
  }, [tbtcBalance]);

  // Fetch claimable rewards from API
  useEffect(() => {
    const fetchClaimableRewards = async () => {
      if (!address || !isConnected) {
        setClaimableRewards(0);
        setHasClaimableRewards(false);
        setUserDistributions([]);
        return;
      }

      try {
        const normalizedAddress = address.toLowerCase();
        const apiUrl = `/api/merkle-distributions/latest?address=${normalizedAddress}`;

        console.log("Fetching claimable rewards from:", apiUrl);
        const response = await fetch(apiUrl);

        if (!response.ok) {
          console.error("Failed to fetch distributions:", response.status);
          
          // Try to get error details from response
          try {
            const errorData = await response.json();
            if (errorData.supabaseDown) {
              console.warn("⚠️ Supabase service is currently unavailable. Using local fallback if available.");
            }
          } catch (e) {
            // Response wasn't JSON, ignore
          }
          return;
        }

        const data: {
          address: string;
          count: number;
          userDistributions: UserDistribution[];
          supabaseDown?: boolean;
        } = await response.json();

        console.log("Distributions data:", data);
        setUserDistributions(data.userDistributions);

        // Calculate total ACTUALLY claimable rewards (filter out claimed, expired, not ready)
        let totalClaimable = 0;
        let claimableCount = 0; // Count of claimable distributions
        const CLAIM_PERIOD_MS = 365 * 24 * 60 * 60 * 1000; // 365 days in milliseconds

        if (data.userDistributions && data.userDistributions.length > 0) {
          for (const dist of data.userDistributions) {
            // Check if already claimed on-chain
            if (dist.claimedOnChain === true) {
              console.log(`⏭️ Skipping claimed distribution #${dist.id}`);
              continue;
            }

            // Check if reclaimed by admin (API already filters these, but double-check)
            if (dist.metadata?.reclaimed === true) {
              console.log(`⏭️ Skipping reclaimed distribution #${dist.id}`);
              continue;
            }

            // Check if expired (365 days from generation)
            if (dist.metadata?.generated) {
              const generatedTime = new Date(dist.metadata.generated).getTime();
              const now = Date.now();
              const isExpired = (now - generatedTime) > CLAIM_PERIOD_MS;

              if (isExpired) {
                console.log(`⏭️ Skipping expired distribution #${dist.id}`);
                continue;
              }
            }

            // Check if distribution is ready (valid merkle root)
            const isReady = dist.merkleRoot &&
              dist.merkleRoot !== "0x0000000000000000000000000000000000000000000000000000000000000000";

            if (!isReady) {
              console.log(`⏭️ Skipping not-ready distribution #${dist.id}`);
              continue;
            }

            // If all checks pass, add to total and increment count
            const amount = parseFloat(formatUnits(BigInt(dist.claim.amount), 8));
            totalClaimable += amount;
            claimableCount++; // Increment the count
            console.log(`✅ Including claimable distribution #${dist.id}: ${amount} BTC1USD`);
          }

          console.log("Total ACTUALLY claimable rewards:", totalClaimable);
          console.log("Total CLAIMABLE distribution count:", claimableCount);
          setClaimableRewards(totalClaimable);
          setHasClaimableRewards(totalClaimable > 0);
          setClaimableDistributionCount(claimableCount); // Set the count
        } else {
          setClaimableRewards(0);
          setHasClaimableRewards(false);
          setClaimableDistributionCount(0);
        }
      } catch (error) {
        console.error("Error fetching claimable rewards:", error);
        setClaimableRewards(0);
        setHasClaimableRewards(false);
        setClaimableDistributionCount(0);
      }
    };

    fetchClaimableRewards();
  }, [address, isConnected]);

  // Update protocol state with real contract data
  useEffect(() => {
    if (btc1usdTotalSupply !== undefined) {
      const totalSupplyFormatted = parseFloat(
        formatUnits(btc1usdTotalSupply, 8)
      );
      console.log("Total supply updated:", totalSupplyFormatted);
      setProtocolState((prev) => ({
        ...prev,
        totalSupply: totalSupplyFormatted,
      }));
    }
  }, [btc1usdTotalSupply]);

  useEffect(() => {
    if (btcPrice !== undefined && btcPrice !== null) {
      const btcPriceFormatted = parseFloat(formatUnits(btcPrice, 8));
      console.log("BTC price updated:", btcPriceFormatted);
      setProtocolState((prev) => ({
        ...prev,
        btcPrice: btcPriceFormatted,
      }));
    }
  }, [btcPrice]);

  useEffect(() => {
    if (isConnected && address) {
      setAccount(address);
      // Fetch the actual user balance from the contract
      // setUserBalance(1000) // Remove placeholder value
    } else {
      setAccount("");
      setUserBalance(0);
    }
  }, [isConnected, address]);

  // Fetch balances when address changes
  useEffect(() => {
    if (address) {
      // Add a small delay to ensure contracts are properly initialized
      const timer = setTimeout(() => {
        refetchBtc1usdBalance();
        refetchWbtcBalance();
        refetchCbbtcBalance();
        refetchTbtcBalance();
        refetchTotalSupply();
        refetchBtcPrice();
        refetchCollateralRatio();
        refetchCollateralValue();
        refetchVaultWbtcBalance();
        refetchVaultCbbtcBalance();
        refetchVaultTbtcBalance();
        refetchDevWalletBalance();
        refetchEndowmentWalletBalance();
        refetchMerkleDistributorBalance(); // Add this line
        refetchCanExecuteDistribution();
        refetchNextDistributionTime();
        refetchDistributionCount();
        refetchCurrentRewardPerToken();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [
    address,
    refetchBtc1usdBalance,
    refetchWbtcBalance,
    refetchCbbtcBalance,
    refetchTbtcBalance,
    refetchTotalSupply,
    refetchBtcPrice,
    refetchCollateralRatio,
    refetchCollateralValue,
    refetchVaultWbtcBalance,
    refetchVaultCbbtcBalance,
    refetchVaultTbtcBalance,
    refetchDevWalletBalance,
    refetchEndowmentWalletBalance,
    refetchMerkleDistributorBalance, // Add this line
  ]);

  // Fetch protocol data on component mount
  useEffect(() => {
    const timer = setTimeout(() => {
      refetchTotalSupply();
      refetchBtcPrice();
      refetchCollateralRatio();
      refetchCollateralValue();
      refetchMerkleDistributorBalance(); // Add this line
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    refetchTotalSupply,
    refetchBtcPrice,
    refetchCollateralRatio,
    refetchCollateralValue,
    refetchMerkleDistributorBalance, // Add this line
  ]);

  // Fetch active proposals count
  useEffect(() => {
    const fetchActiveProposals = async () => {
      try {
        console.log("🔍 Fetching proposals from API...");
        const response = await fetch("/api/governance/proposals");
        console.log("📡 Response status:", response.status, response.ok);

        if (response.ok) {
          const data = await response.json();
          console.log("✅ Proposals API response:", data);

          if (data.proposals && Array.isArray(data.proposals)) {
            console.log("📊 Total proposals:", data.proposals.length);
            console.log("📝 Proposals:", data.proposals.map((p: any) => ({ id: p.id, state: p.state, title: p.title })));

            const activeCount = data.proposals.filter(
              (p: any) => p.state?.toLowerCase() === "active"
            ).length;
            console.log("✅ Active proposals count:", activeCount);
            setActiveProposalsCount(activeCount);
          } else {
            console.warn("⚠️ No proposals array in response");
          }
        } else {
          console.error("❌ Response not OK:", response.status, response.statusText);
          const errorText = await response.text();
          console.error("Error details:", errorText);
        }
      } catch (error) {
        console.error("❌ Error fetching proposals:", error);
      }
    };

    // Always fetch on mount
    fetchActiveProposals();

    // Refresh every 30 seconds
    const interval = setInterval(fetchActiveProposals, 30000);
    return () => clearInterval(interval);
  }, []);

  // Automatically open mobile menu on mobile devices
  useEffect(() => {
    if (isMobile) {
      setMobileMenuOpen(true);
    }
  }, [isMobile]);

  // Auto-hide sidebar functionality for mobile
  useEffect(() => {
    // Only apply auto-hide on mobile devices
    if (!isMobile) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Auto-hide when mouse moves to extreme right edge (within 20px from right)
      if (e.clientX >= window.innerWidth - 20 && sidebarOpen && !autoHideSidebar) {
        setAutoHideSidebar(true);
      }
      // Show sidebar when mouse moves away from right edge
      else if (e.clientX < window.innerWidth - 100 && autoHideSidebar) {
        setAutoHideSidebar(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [sidebarOpen, autoHideSidebar, isMobile]);

  // Calculate metrics using real contract data when available, fallback to mock data
  // Note: Contract returns collateral ratio with 8 decimal places (FixedPoint8 precision)
  // and total collateral value with 8 decimal places
  const realCollateralRatio = vaultCollateralRatio
    ? parseFloat(formatUnits(vaultCollateralRatio, 8))
    : null;
  
  // Use real vault collateral value from contract instead of calculating it ourselves
  // This ensures we match exactly what the contract uses for collateral ratio calculations
  const totalCollateralUSD = totalCollateralValue
    ? parseFloat(formatUnits(totalCollateralValue, 8))
    : 0;
  const totalCollateralBTC = protocolState.btcPrice > 0 
    ? totalCollateralUSD / protocolState.btcPrice
    : 0;

  // Use real collateral ratio from contract if available, otherwise calculate from real vault data
  // Handle zero supply case properly
  let collateralRatio: number;
  if (realCollateralRatio !== null) {
    collateralRatio = realCollateralRatio;
  } else {
    // Calculate from real vault data with zero supply handling
    if (protocolState.totalSupply === 0) {
      collateralRatio = 0; // Show 0 when no supply exists
    } else {
      // Use real vault collateral value from contract for consistency
      const totalVaultCollateralUSD = totalCollateralValue
        ? parseFloat(formatUnits(totalCollateralValue, 8))
        : 0;
      collateralRatio = protocolState.totalSupply > 0 ? totalVaultCollateralUSD / protocolState.totalSupply : 0;
    }
  }
  // Use real vault balances for health metrics
  const realVaultBalances = {
    wbtc: vaultWbtcBalance ? parseFloat(formatUnits(vaultWbtcBalance as unknown as bigint, 8)) : 0,
    cbbtc: vaultCbbtcBalance ? parseFloat(formatUnits(vaultCbbtcBalance as unknown as bigint, 8)) : 0,
    tbtc: vaultTbtcBalance ? parseFloat(formatUnits(vaultTbtcBalance as unknown as bigint, 8)) : 0,
  };
  
  // Debug logging for vault balances
  console.log("🔍 Vault Balances:", {
    wbtc: realVaultBalances.wbtc,
    cbbtc: realVaultBalances.cbbtc,
    tbtc: realVaultBalances.tbtc,
    totalCollateralUSD,
    collateralRatio,
  });
  
  // Debug total collateral value from contract
  console.log("🔍 Total Collateral Value from Contract:", totalCollateralValue?.toString());
  console.log("🔍 Formatted USD:", totalCollateralUSD);
  console.log("🔍 Vault Address:", protocolState?.contractAddresses?.vault);
  
  // Use real collateral value from contract for consistency with contract calculations
  const realCollateralValue = totalCollateralValue
    ? parseFloat(formatUnits(totalCollateralValue, 8))
    : 0;
  
  const healthMetrics = ProtocolMath.calculateHealthMetrics(protocolState, undefined, realVaultBalances, realCollateralValue);
  const isHealthy = healthMetrics.isHealthy;
  const protocolCanDistribute = healthMetrics.canDistribute;

  // Per-distribution reward (7-day cycle)
  // Reward is in DOLLARS (not cents), matching contract's getRewardPerToken() which returns cents with 8 decimals
  // Contract: 0.01e8 = 1 cent = $0.01, so we divide by 100 to get dollar amount
  let weeklyReward = 0;
  if (collateralRatio > 0) {
    if (collateralRatio >= 2.02) weeklyReward = 0.1;  // 10¢ per token per distribution
    else if (collateralRatio >= 1.92) weeklyReward = 0.09;  // 9¢ per token per distribution
    else if (collateralRatio >= 1.82) weeklyReward = 0.08;  // 8¢ per token per distribution
    else if (collateralRatio >= 1.72) weeklyReward = 0.07;  // 7¢ per token per distribution
    else if (collateralRatio >= 1.62) weeklyReward = 0.06;  // 6¢ per token per distribution
    else if (collateralRatio >= 1.52) weeklyReward = 0.05;  // 5¢ per token per distribution
    else if (collateralRatio >= 1.42) weeklyReward = 0.04;  // 4¢ per token per distribution
    else if (collateralRatio >= 1.32) weeklyReward = 0.03;  // 3¢ per token per distribution
    else if (collateralRatio >= 1.22) weeklyReward = 0.02;  // 2¢ per token per distribution
    else if (collateralRatio >= 1.12) weeklyReward = 0.01;  // 1¢ per token per distribution
  }

  const protocolStats = {
    totalCollateralValue: totalCollateralUSD,
    weeklyRewards: weeklyReward, // Note: variable name kept for compatibility, but represents per-distribution reward in testnet
    endowmentBalance: protocolState.endowmentWallet,
    nextDistribution: "2024-01-05T14:00:00Z",
    totalUsers: 3353,
    totalProposals: 25276,
    votesCast: 523806,
    uniqueVoters: 41433,
    tvl: totalCollateralUSD,
    chains: 15,
  };

  const collateralTokens = [
    {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      balance: vaultWbtcBalance ? parseFloat(formatUnits(vaultWbtcBalance as unknown as bigint, 8)) : 0,
      address: protocolState?.contractAddresses?.wbtc,
    },
    {
      symbol: "cbBTC",
      name: "Coinbase Wrapped Bitcoin",
      balance: vaultCbbtcBalance ? parseFloat(formatUnits(vaultCbbtcBalance as unknown as bigint, 8)) : 0,
      address: protocolState?.contractAddresses?.cbbtc,
    },
    {
      symbol: "tBTC",
      name: "Threshold Bitcoin",
      balance: vaultTbtcBalance ? parseFloat(formatUnits(vaultTbtcBalance as unknown as bigint, 8)) : 0,
      address: protocolState?.contractAddresses?.tbtc,
    },
  ];

  // Removed mock price volatility effect - using real contract data instead

  const handleConnectWallet = async () => {
    await connectWallet();
  };

  const handleDisconnectWallet = async () => {
    await disconnectWallet();
    setAccount("");
    setUserBalance(0);
  };

  // WBTC contract interaction
  const {
    data: hash,
    writeContract,
    isPending,
    error: writeError,
    reset: resetWriteContract,
  } = useWriteContract();
  
  // EIP-2612 Permit signature hook
  const { signTypedDataAsync } = useSignTypedData();
  
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: waitError,
  } = useWaitForTransactionReceipt({
    hash,
    timeout: 90000, // Increase timeout to 90 seconds
  });

  // Track the type of transaction we're waiting for
  const [pendingTransactionType, setPendingTransactionType] = useState<
    "approve" | "mint" | "redeem" | null
  >(null);

  // Add state for transaction status messages
  const [transactionStatus, setTransactionStatus] = useState("");

  // Add state for transaction timeout
  const [confirmTimeout, setConfirmTimeout] = useState<NodeJS.Timeout | null>(
    null
  );

  // Add state to track if we're waiting for approval
  const [waitingForApproval, setWaitingForApproval] = useState(false);
  const [pendingMintAmount, setPendingMintAmount] = useState("");
  const [pendingDepositAmount, setPendingDepositAmount] = useState("");
  const [pendingCollateralType, setPendingCollateralType] =
    useState<string>("WBTC");

  // Add state to track minting progress
  const [mintingStep, setMintingStep] = useState<
    "idle" | "approving" | "minting" | "redeeming"
  >("idle");

  // Helper function to get user-friendly error message
  const getSimpleErrorMessage = (error: any): string => {
    const errorString = error?.message || error?.toString() || "";

    // User rejected transaction
    if (
      errorString.includes("User rejected") ||
      errorString.includes("user rejected") ||
      errorString.includes("User denied")
    ) {
      return "Transaction cancelled";
    }

    // Insufficient funds
    if (
      errorString.includes("insufficient funds") ||
      errorString.includes("Insufficient")
    ) {
      return "Insufficient funds";
    }

    // Network/connection issues
    if (
      errorString.includes("network") ||
      errorString.includes("Network") ||
      errorString.includes("timeout")
    ) {
      return "Network error - please try again";
    }

    // Contract-specific errors
    if (errorString.includes("Vault:")) {
      return "Transaction failed - check requirements";
    }

    // Default minimal message
    return "Transaction failed";
  };

  // Add effect to handle transaction errors
  useEffect(() => {
    if (writeError) {
      console.error("Transaction error:", writeError);

      const simpleError = getSimpleErrorMessage(writeError);

      setTransactionStatus(simpleError);
      setMintingStep("idle");
      setPendingTransactionType(null);

      // Reset write contract to clear pending states
      resetWriteContract();

      // Clear timeout if it exists
      if (confirmTimeout) {
        clearTimeout(confirmTimeout);
        setConfirmTimeout(null);
      }
      // Clear status after 3 seconds
      const timer = setTimeout(() => setTransactionStatus(""), 3000);
      return () => clearTimeout(timer);
    }

    if (waitError) {
      console.error("Transaction confirmation error:", waitError);

      const simpleError = getSimpleErrorMessage(waitError);

      setTransactionStatus(simpleError);
      setMintingStep("idle");
      setPendingTransactionType(null);

      // Reset write contract to clear pending states
      resetWriteContract();

      // Clear timeout if it exists
      if (confirmTimeout) {
        clearTimeout(confirmTimeout);
        setConfirmTimeout(null);
      }
      // Clear status after 3 seconds
      const timer = setTimeout(() => setTransactionStatus(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [writeError, waitError, confirmTimeout, resetWriteContract]);

  // Effect to handle transaction confirmation and automatically proceed with minting
  useEffect(() => {
    if (isConfirmed) {
      // Clear timeout when transaction is confirmed
      if (confirmTimeout) {
        clearTimeout(confirmTimeout);
        setConfirmTimeout(null);
      }

      console.log("=== TRANSACTION CONFIRMED ===");
      console.log("Transaction hash:", hash);
      console.log("Transaction type:", pendingTransactionType);
      console.log("Pending amounts:", {
        pendingMintAmount,
        pendingDepositAmount,
      });

      // Check what action we were waiting for
      if (
        pendingTransactionType === "approve" &&
        (pendingMintAmount || pendingDepositAmount)
      ) {
        // Approval confirmed, now proceed with minting or redeeming
        // Check if this was for redeeming (sell tab) or minting (buy tab)
        const isRedeemTab = mintSubTab === 'sell';
        
        if (isRedeemTab && pendingMintAmount) {
          // This was an approval for redeeming tokens
          setMintingStep("minting"); // Reuse minting step for redeeming
          setPendingTransactionType("redeem");
          setTransactionStatus("Approval confirmed. Redeeming BTC1 tokens...");
          
          // Determine the amount and contract address
          const amount = parseUnits(pendingMintAmount, 8);
          
          // Get the collateral contract address based on pending collateral type
          const collateralContractAddress =
            pendingCollateralType === "WBTC"
              ? protocolState?.contractAddresses?.wbtc
              : pendingCollateralType === "cbBTC"
              ? protocolState?.contractAddresses?.cbbtc
              : pendingCollateralType === "tBTC"
              ? protocolState?.contractAddresses?.tbtc
              : protocolState?.contractAddresses?.wbtc; // fallback to WBTC
          
          const vaultAddress = protocolState?.contractAddresses?.vault;
          
          console.log("Proceeding to redeem with:", {
            amount: amount.toString(),
            collateralType: pendingCollateralType,
            collateralContractAddress,
            vaultAddress,
            vaultLength: vaultAddress?.length,
            collateralLength: collateralContractAddress?.length,
            amountFormatted: pendingMintAmount,
          });
          
          if (!collateralContractAddress || !vaultAddress) {
            console.error("Missing contract addresses for redeeming");
            setTransactionStatus("Error: Missing contract addresses");
            setMintingStep("idle");
            setPendingTransactionType(null);
            return;
          }
          
          // Validate address lengths (Ethereum addresses should be 42 characters)
          if (
            collateralContractAddress.length !== 42 ||
            vaultAddress.length !== 42
          ) {
            console.error("Invalid contract address lengths for redeeming:", {
              collateral: {
                address: collateralContractAddress,
                length: collateralContractAddress.length,
              },
              vault: { address: vaultAddress, length: vaultAddress.length },
            });
            setTransactionStatus(
              "Error: Invalid contract addresses detected during redeeming."
            );
            setMintingStep("idle");
            setPendingTransactionType(null);
            return;
          }
          
          // Call the redeem function on the vault
          writeContract({
            address: vaultAddress as any,
            abi: [
              {
                inputs: [
                  { internalType: "uint256", name: "tokenAmount", type: "uint256" },
                  {
                    internalType: "address",
                    name: "collateralToken",
                    type: "address",
                  },
                ],
                name: "redeem",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
              },
            ],
            functionName: "redeem",
            args: [amount, collateralContractAddress as any],
          });
        } else {
          // Approval confirmed, now proceed with minting
          setMintingStep("minting");
          setPendingTransactionType("mint");
          setTransactionStatus("Approval confirmed. Minting BTC1 tokens...");

          // Determine the amount and contract address based on which action we're doing
          const amount = pendingMintAmount
            ? parseUnits(pendingMintAmount, 8)
            : parseUnits(pendingDepositAmount, 8);

          // Get the collateral contract address based on pending collateral type
          const collateralContractAddress =
            pendingCollateralType === "WBTC"
              ? protocolState?.contractAddresses?.wbtc
              : pendingCollateralType === "cbBTC"
              ? protocolState?.contractAddresses?.cbbtc
              : pendingCollateralType === "tBTC"
              ? protocolState?.contractAddresses?.tbtc
              : protocolState?.contractAddresses?.wbtc; // fallback to WBTC

          const vaultAddress = protocolState?.contractAddresses?.vault;

          console.log("Proceeding to mint with:", {
            amount: amount.toString(),
            collateralType: pendingCollateralType,
            collateralContractAddress,
            vaultAddress,
            vaultLength: vaultAddress?.length,
            collateralLength: collateralContractAddress?.length,
            amountFormatted: pendingMintAmount || pendingDepositAmount,
          });

          if (!collateralContractAddress || !vaultAddress) {
            console.error("Missing contract addresses for minting");
            setTransactionStatus("Error: Missing contract addresses");
            setMintingStep("idle");
            setPendingTransactionType(null);
            return;
          }

          // Validate address lengths (Ethereum addresses should be 42 characters)
          if (
            collateralContractAddress.length !== 42 ||
            vaultAddress.length !== 42
          ) {
            console.error("Invalid contract address lengths for minting:", {
              collateral: {
                address: collateralContractAddress,
                length: collateralContractAddress.length,
              },
              vault: { address: vaultAddress, length: vaultAddress.length },
            });
            setTransactionStatus(
              "Error: Invalid contract addresses detected during minting."
            );
            setMintingStep("idle");
            setPendingTransactionType(null);
            return;
          }

          writeContract({
            address: vaultAddress as any,
            abi: [
              {
                inputs: [
                  {
                    internalType: "address",
                    name: "collateralToken",
                    type: "address",
                  },
                  { internalType: "uint256", name: "btcAmount", type: "uint256" },
                ],
                name: "mint",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
              },
            ],
            functionName: "mint",
            args: [collateralContractAddress as any, amount],
          });
        }
      } else if (pendingTransactionType === "mint") {
        // Minting completed (BTC1USD mint or WBTC mint)
        console.log("=== MINTING COMPLETED ===");
        console.log("Refreshing balances...");
        setTransactionStatus("✅ Transaction successful! Refreshing balances...");
        setMintingStep("idle");
        setPendingTransactionType(null);
        setPendingMintAmount("");
        setPendingDepositAmount("");

        // Clear form fields
        setMintAmount("");
        setWbtcMintAmount("");

        // Reset write contract to clear pending states
        resetWriteContract();

        // Refresh ALL data after successful transaction
        setTimeout(async () => {
          console.log("✅ Transaction confirmed! Refreshing all data across all tabs...");

          // Refetch all data in parallel for instant updates across ALL tabs
          await Promise.all([
            // User balances
            refetchBtc1usdBalance(),
            refetchWbtcBalance(),
            refetchCbbtcBalance(),
            refetchTbtcBalance(),

            // Vault balances
            refetchVaultWbtcBalance(),
            refetchVaultCbbtcBalance(),
            refetchVaultTbtcBalance(),

            // Protocol stats
            refetchTotalSupply(),
            refetchCollateralRatio(),
            refetchCollateralValue(),
            refetchBtcPrice(),

            // Distribution stats
            refetchDevWalletBalance(),
            refetchEndowmentWalletBalance(),
            refetchMerkleDistributorBalance(),
            refetchMerklFeeCollectorBalance(),
            refetchCanExecuteDistribution(),
            refetchNextDistributionTime(),
            refetchDistributionCount(),
            refetchCurrentRewardPerToken(),
          ]).then(() => {
            console.log("✅ All data refreshed successfully!");
            // Update status to show completion
            setTransactionStatus("✅ Complete! Redirecting to overview...");
          }).catch(err => {
            console.error("❌ Error refreshing data:", err);
          });
        }, 2000); // Increased delay to ensure blockchain state is updated

        // Clear status after 3 seconds and redirect to overview
        setTimeout(() => {
          setTransactionStatus("");
          setActiveTab("overview"); // Redirect to overview tab
          console.log("=== MINTING PROCESS COMPLETE - Redirected to Overview ===")
        }, 3000);
      } else if (pendingTransactionType === "redeem") {
        // Redeem completed
        console.log("=== REDEEM COMPLETED ===");
        console.log("Refreshing balances...");
        setTransactionStatus("✅ Transaction successful! Refreshing balances...");
        setPendingTransactionType(null);

        // Clear form fields
        setRedeemAmount("");

        // Reset write contract to clear pending states
        resetWriteContract();

        // Refresh ALL data after successful transaction
        setTimeout(async () => {
          console.log("✅ Transaction confirmed! Refreshing all data across all tabs...");

          // Refetch all data in parallel for instant updates across ALL tabs
          await Promise.all([
            // User balances
            refetchBtc1usdBalance(),
            refetchWbtcBalance(),
            refetchCbbtcBalance(),
            refetchTbtcBalance(),

            // Vault balances
            refetchVaultWbtcBalance(),
            refetchVaultCbbtcBalance(),
            refetchVaultTbtcBalance(),

            // Protocol stats
            refetchTotalSupply(),
            refetchCollateralRatio(),
            refetchCollateralValue(),
            refetchBtcPrice(),

            // Distribution stats
            refetchDevWalletBalance(),
            refetchEndowmentWalletBalance(),
            refetchMerkleDistributorBalance(),
            refetchMerklFeeCollectorBalance(),
            refetchCanExecuteDistribution(),
            refetchNextDistributionTime(),
            refetchDistributionCount(),
            refetchCurrentRewardPerToken(),
          ]).then(() => {
            console.log("✅ All data refreshed successfully!");
            // Update status to show completion
            setTransactionStatus("✅ Complete! Redirecting to overview...");
          }).catch(err => {
            console.error("❌ Error refreshing data:", err);
          });
        }, 2000); // Increased delay to ensure blockchain state is updated

        // Clear status after 3 seconds and redirect to overview
        setTimeout(() => {
          setTransactionStatus("");
          setActiveTab("overview"); // Redirect to overview tab
          console.log("=== REDEEM PROCESS COMPLETE - Redirected to Overview ===")
        }, 3000);
      }
    }
  }, [
    isConfirmed,
    pendingTransactionType,
    pendingMintAmount,
    pendingDepositAmount,
    pendingCollateralType,
    confirmTimeout,
    protocolState,
    writeContract,
    refetchBtc1usdBalance,
    refetchWbtcBalance,
    refetchCbbtcBalance,
    refetchTbtcBalance,
    refetchVaultWbtcBalance,
    refetchVaultCbbtcBalance,
    refetchVaultTbtcBalance,
    refetchTotalSupply,
    refetchCollateralRatio,
    refetchCollateralValue,
    hash,
    resetWriteContract,
    setActiveTab,
  ]);

  const {
    mintWithPermit2,
    redeemWithPermit,
    checkPermit2Approval,
    approvePermit2,
    status: permitStatus,
    isProcessing: permitProcessing,
  } = usePermitTransactions();

  const handleMint = async () => {
    console.log("=== BTC1USD MINT WITH PERMIT2 START ===");

    if (!mintAmount || !address) {
      console.log("Missing mintAmount or address:", { mintAmount, address });
      setTransactionStatus("Please enter an amount and connect your wallet");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    const btcAmount = Number.parseFloat(mintAmount);
    if (isNaN(btcAmount) || btcAmount <= 0) {
      console.log("Invalid btcAmount:", btcAmount);
      setTransactionStatus("Please enter a valid BTC amount");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    // Check user collateral balance
    const userCollateralBalance = parseFloat(
      selectedCollateral === "WBTC"
        ? userWbtcBalance
        : selectedCollateral === "cbBTC"
        ? userCbbtcBalance
        : userTbtcBalance
    );

    if (btcAmount > userCollateralBalance) {
      setTransactionStatus(
        `Insufficient ${selectedCollateral} balance. You have ${userCollateralBalance.toFixed(
          8
        )} ${selectedCollateral}`
      );
      setTimeout(() => setTransactionStatus(""), 5000);
      return;
    }

    // Get contract addresses
    const collateralContractAddress =
      selectedCollateral === "WBTC"
        ? protocolState?.contractAddresses?.wbtc
        : selectedCollateral === "cbBTC"
        ? protocolState?.contractAddresses?.cbbtc
        : protocolState?.contractAddresses?.tbtc;
    const vaultAddress = protocolState?.contractAddresses?.vault;

    if (!collateralContractAddress || !vaultAddress || !chainId) {
      setTransactionStatus("Error: Contract addresses not found. Please check deployment.");
      setTimeout(() => setTransactionStatus(""), 5000);
      return;
    }

    try {
      const amount = parseUnits(mintAmount, 8); // All BTC tokens have 8 decimals

      // STEP 1: Check if user has approved Permit2 to spend their collateral
      setTransactionStatus("Checking Permit2 approval...");
      const allowance = await checkPermit2Approval(
        collateralContractAddress as `0x${string}`,
        address as `0x${string}`
      );

      console.log(`${selectedCollateral} -> Permit2 allowance:`, allowance.toString());

      // If not approved (allowance is 0), approve first with unlimited amount
      // Once approved with max uint256, this will never trigger again
      if (allowance === 0n) {
        console.log("⚠️  Permit2 not approved. Requesting one-time unlimited approval...");
        setMintingStep("approving");
        setPendingTransactionType("approve");
        setTransactionStatus(`Step 1/2: Approve ${selectedCollateral} to Permit2 (one-time setup)...`);

        await approvePermit2(
          collateralContractAddress as `0x${string}`,
          (hash) => {
            console.log("✅ Permit2 approved:", hash);
            setTransactionStatus("Approval successful! Now proceeding with mint...");
            
            // Continue to mint after approval
            setTimeout(() => {
              executeMintWithPermit2(
                vaultAddress,
                collateralContractAddress,
                amount
              );
            }, 1000);
          },
          (error) => {
            console.error("❌ Permit2 approval failed:", error);
            setTransactionStatus(`Approval failed: ${error.message}`);
            setMintingStep("idle");
            setPendingTransactionType(null);
            setTimeout(() => setTransactionStatus(""), 5000);
          }
        );
      } else {
        // Already approved, proceed directly to mint
        console.log("✅ Permit2 already approved. Proceeding to mint...");
        await executeMintWithPermit2(
          vaultAddress,
          collateralContractAddress,
          amount
        );
      }
    } catch (error: any) {
      console.error("=== ERROR IN HANDLE_MINT ===", error);
      setTransactionStatus("Error: " + (error.message || "Unknown error"));
      setMintingStep("idle");
      setPendingTransactionType(null);
      setPendingMintAmount("");
      setTimeout(() => setTransactionStatus(""), 5000);
    }
  };

  // Helper function to execute the actual mint with Permit2
  const executeMintWithPermit2 = async (
    vaultAddress: string,
    collateralContractAddress: string,
    amount: bigint
  ) => {
    setMintingStep("minting");
    setPendingTransactionType("mint");
    setPendingMintAmount(mintAmount);
    setPendingCollateralType(selectedCollateral);
    setTransactionStatus("Step 2/2: Processing gasless mint with Permit2...");

    console.log("🔐 Using Permit2 for gasless mint");
    console.log("Amount:", mintAmount, selectedCollateral);
    console.log("Vault:", vaultAddress);
    console.log("Collateral:", collateralContractAddress);

    await mintWithPermit2(
      vaultAddress as `0x${string}`,
      collateralContractAddress as `0x${string}`,
      amount,
      chainId!,
      (hash) => {
        console.log("✅ Mint transaction successful:", hash);
        setTransactionStatus(`Mint successful! Hash: ${hash}`);
        setMintAmount("");
        setMintingStep("idle");
        setPendingTransactionType(null);
        setPendingMintAmount("");
        
        // Refresh balances after successful mint
        setTimeout(() => {
          refetchBtc1usdBalance();
          refetchWbtcBalance();
          refetchCbbtcBalance();
          refetchTbtcBalance();
          refetchTotalSupply();
          refetchCollateralRatio();
          refetchCollateralValue();
          refetchVaultWbtcBalance();
          refetchVaultCbbtcBalance();
          refetchVaultTbtcBalance();
          setTransactionStatus("");
        }, 3000);
      },
      (error) => {
        console.error("❌ Mint failed:", error);
        setTransactionStatus(`Mint failed: ${error.message}`);
        setMintingStep("idle");
        setPendingTransactionType(null);
        setPendingMintAmount("");
        
        setTimeout(() => setTransactionStatus(""), 5000);
      }
    );
  };

  const handleVaultDeposit = async () => {
    if (!vaultDepositAmount || !address) return;

    const depositAmount = Number.parseFloat(vaultDepositAmount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      setTransactionStatus("Please enter a valid WBTC amount");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    const userWbtc = parseFloat(userWbtcBalance);

    if (depositAmount > userWbtc) {
      setTransactionStatus("Insufficient WBTC balance for deposit!");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    console.log("[v1] Depositing " + depositAmount + " WBTC to vault");

    try {
      // First, approve the vault to spend the WBTC
      const amount = parseUnits(vaultDepositAmount, 8); // WBTC has 8 decimals

      // Set pending state
      setMintingStep("approving");
      setPendingTransactionType("approve");
      setPendingDepositAmount(vaultDepositAmount);

      // Approve vault to spend WBTC
      writeContract({
        address: protocolState?.contractAddresses?.wbtc as any,
        abi: [
          {
            inputs: [
              { internalType: "address", name: "spender", type: "address" },
              { internalType: "uint256", name: "amount", type: "uint256" },
            ],
            name: "approve",
            outputs: [{ internalType: "bool", name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "approve",
        args: [protocolState?.contractAddresses?.vault as any, amount],
      });

      setTransactionStatus(
        "Please confirm the approval transaction in your wallet..."
      );
    } catch (error) {
      console.error("Error approving vault:", error);
      setTransactionStatus("Failed to approve");
      setTimeout(() => setTransactionStatus(""), 3000);
      setMintingStep("idle");
      setPendingTransactionType(null);
      setPendingDepositAmount("");
    }
  };

  // Helper function to generate EIP-2612 permit signature
  // @ts-ignore - Legacy unused function, will be removed
  const generatePermitSignature = async (
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
    value: bigint,
    deadline: number
  ) => {
    try {
      // Get the current nonce for the user
      const nonce = 0n; // Stub

      // Get domain separator
      const domainSeparator = '0x0'; // Stub

      // EIP-712 domain
      const domain = {
        name: "BTC1USD",
        version: "1",
        chainId: chainId || 8453,
        verifyingContract: tokenAddress as `0x${string}`,
      };

      // EIP-712 types
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      // Message to sign
      const message = {
        owner: ownerAddress,
        spender: spenderAddress,
        value: value.toString(),
        nonce: (nonce as bigint).toString(),
        deadline,
      };

      console.log("\ud83d\udd10 Generating permit signature:", { domain, types, message });

      // Request signature from wallet using eth_signTypedData_v4
      const signature = await window.ethereum?.request({
        method: "eth_signTypedData_v4",
        params: [ownerAddress, JSON.stringify({ domain, types, primaryType: "Permit", message })],
      });

      if (!signature) {
        throw new Error("Signature generation failed");
      }

      // Split signature into r, s, v components
      const r = signature.slice(0, 66);
      const s = "0x" + signature.slice(66, 130);
      const v = parseInt(signature.slice(130, 132), 16);

      console.log("✅ Permit signature generated:", { r, s, v });

      return { v, r, s, deadline, nonce: nonce as bigint };
    } catch (error) {
      console.error("❌ Permit signature generation failed:", error);
      throw error;
    }
  };

  const handleRedeem = async () => {
    console.log("=== REDEEM WITH PERMIT START ===");

    if (!isConnected || !address) {
      setTransactionStatus("Please connect your wallet first");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    if (!redeemAmount) {
      setTransactionStatus("Please enter an amount to redeem");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    const tokenAmount = parseFloat(redeemAmount);
    if (isNaN(tokenAmount) || tokenAmount <= 0) {
      setTransactionStatus("Please enter a valid amount");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    // Check user balance
    const userBalance = btc1usdBalance
      ? parseFloat(formatUnits(btc1usdBalance, 8))
      : 0;
    if (tokenAmount > userBalance) {
      setTransactionStatus(
        `Insufficient balance. You have ${userBalance.toFixed(8)} BTC1`
      );
      setTimeout(() => setTransactionStatus(""), 5000);
      return;
    }

    // Force refresh vault balance before redemption
    console.log("🔄 Refreshing vault balance before redemption...");
    if (selectedRedeemCollateral === "WBTC") {
      await refetchVaultWbtcBalance();
    } else if (selectedRedeemCollateral === "cbBTC") {
      await refetchVaultCbbtcBalance();
    } else {
      await refetchVaultTbtcBalance();
    }

    // Validate sufficient collateral exists
    const vaultBalance =
      selectedRedeemCollateral === "WBTC"
        ? vaultWbtcBalance
        : selectedRedeemCollateral === "cbBTC"
        ? vaultCbbtcBalance
        : vaultTbtcBalance;
    const availableCollateral = vaultBalance
      ? parseFloat(formatUnits(vaultBalance as bigint, 8))
      : 0;

    const currentRatio = collateralRatio;
    const effectivePrice = currentRatio >= 1.1 ? 1.0 : 0.9 * currentRatio;
    const grossBtcValue = (tokenAmount * effectivePrice) / protocolState.btcPrice;
    const requiredCollateral = grossBtcValue;

    if (requiredCollateral > availableCollateral) {
      setTransactionStatus(
        `Insufficient ${selectedRedeemCollateral} in vault. Required: ${requiredCollateral.toFixed(
          8
        )}, Available: ${availableCollateral.toFixed(
          8
        )}. Try selecting a different collateral type.`
      );
      setTimeout(() => setTransactionStatus(""), 8000);
      return;
    }

    // Get contract addresses
    const collateralContractAddress =
      selectedRedeemCollateral === "WBTC"
        ? protocolState?.contractAddresses?.wbtc
        : selectedRedeemCollateral === "cbBTC"
        ? protocolState?.contractAddresses?.cbbtc
        : protocolState?.contractAddresses?.tbtc;
    const vaultAddress = protocolState?.contractAddresses?.vault;

    if (!collateralContractAddress || !vaultAddress || !chainId) {
      setTransactionStatus("Error: Contract addresses not found. Please check deployment.");
      setTimeout(() => setTransactionStatus(""), 5000);
      return;
    }

    try {
      const amount = parseUnits(redeemAmount, 8);

      setMintingStep("redeeming");
      setPendingTransactionType("redeem");
      setPendingMintAmount(redeemAmount);
      setPendingCollateralType(selectedRedeemCollateral);
      setTransactionStatus("Processing redeem with EIP-2612 Permit...");

      console.log("🔐 Using EIP-2612 Permit for gasless redeem");
      console.log("Amount:", redeemAmount, "BTC1USD");
      console.log("Collateral:", selectedRedeemCollateral);
      console.log("Vault:", vaultAddress);

      // Use redeemWithPermit from the hook
      await redeemWithPermit(
        vaultAddress as `0x${string}`,
        protocolState?.contractAddresses?.btc1usd as `0x${string}`,
        collateralContractAddress as `0x${string}`,
        amount,
        chainId,
        (hash) => {
          console.log("✅ Redeem transaction successful:", hash);
          setTransactionStatus(`Redeem successful! Hash: ${hash}`);
          setRedeemAmount("");
          setMintingStep("idle");
          setPendingTransactionType(null);
          setPendingMintAmount("");
          
          // Refresh balances after successful redeem
          setTimeout(() => {
            refetchBtc1usdBalance();
            refetchWbtcBalance();
            refetchCbbtcBalance();
            refetchTbtcBalance();
            refetchTotalSupply();
            refetchCollateralRatio();
            refetchCollateralValue();
            refetchVaultWbtcBalance();
            refetchVaultCbbtcBalance();
            refetchVaultTbtcBalance();
            setTransactionStatus("");
          }, 3000);
        },
        (error) => {
          console.error("❌ Redeem failed:", error);
          setTransactionStatus(`Redeem failed: ${error.message}`);
          setMintingStep("idle");
          setPendingTransactionType(null);
          setPendingMintAmount("");
          
          setTimeout(() => setTransactionStatus(""), 5000);
        }
      );
    } catch (error: any) {
      console.error("=== ERROR IN HANDLE_REDEEM ===", error);
      setTransactionStatus("Error: " + (error.message || "Unknown error"));
      setMintingStep("idle");
      setPendingTransactionType(null);
      setPendingMintAmount("");
      setTimeout(() => setTransactionStatus(""), 5000);
    }
  };

  const getHealthStatus = () => {
    // Handle zero supply case
    if (protocolState.totalSupply === 0) {
      return {
        status: "No Supply",
        color: "bg-gray-500",
        textColor: "text-gray-400",
      };
    }

    const ratio = collateralRatio;
    if (ratio <= 0 || !isFinite(ratio))
      return {
        status: "No Data",
        color: "bg-gray-500",
        textColor: "text-gray-400",
      };
    if (ratio >= 1.2)
      return {
        status: "Excellent",
        color: "bg-green-500",
        textColor: "text-green-400",
      };
    if (ratio >= 1.15)
      return {
        status: "Good",
        color: "bg-blue-500",
        textColor: "text-blue-400",
      };
    if (ratio >= 1.1)
      return {
        status: "Healthy",
        color: "bg-yellow-500",
        textColor: "text-yellow-400",
      };
    return {
      status: "Stressed",
      color: "bg-red-500",
      textColor: "text-red-400",
    };
  };

  const healthStatus = getHealthStatus();

  const handleWbtcMint = async () => {
    console.log(`=== ${selectedMintCollateral} MINT FUNCTION START ===`);

    // Validation
    if (!address) {
      console.log("No wallet connected");
      setTransactionStatus("Please connect your wallet first");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    if (!wbtcMintAmount) {
      console.log("No amount specified");
      setTransactionStatus("Please enter an amount");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    const amountFloat = parseFloat(wbtcMintAmount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      console.log("Invalid amount");
      setTransactionStatus("Please enter a valid amount");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    // Check admin authorization
    const adminAddress = CONTRACT_ADDRESSES.ADMIN; // From deployment config
    const isAdmin =
      address && address.toLowerCase() === adminAddress.toLowerCase();

    if (!isAdmin) {
      console.log("User is not admin");
      setTransactionStatus(
        `Error: Only admin can mint ${selectedMintCollateral} tokens. This is a test-only feature.`
      );
      setTimeout(() => setTransactionStatus(""), 5000);
      return;
    }

    try {
      // Reset and set initial status
      setTransactionStatus("Preparing transaction...");
      console.log(`Starting ${selectedMintCollateral} mint process...`);

      const validAddress = address as any;
      const amount = parseUnits(wbtcMintAmount, 8); // All BTC tokens have 8 decimals

      // Get the contract address based on selected collateral
      let contractAddress: string;
      switch (selectedMintCollateral) {
        case "WBTC":
          contractAddress = protocolState.contractAddresses.wbtc;
          break;
        case "cbBTC":
          contractAddress = protocolState.contractAddresses.cbbtc;
          break;
        case "tBTC":
          contractAddress = protocolState.contractAddresses.tbtc;
          break;
        default:
          throw new Error("Invalid collateral type");
      }

      console.log("Mint parameters:");
      console.log("  Token:", selectedMintCollateral);
      console.log("  Contract:", contractAddress);
      console.log("  To:", validAddress);
      console.log("  Amount (wei):", amount.toString());
      console.log("  Amount:", wbtcMintAmount);

      // Set transaction type
      setPendingTransactionType("mint");
      setTransactionStatus("Please confirm the transaction in your wallet...");

      // Call the contract using writeContract
      console.log("Calling writeContract...");
      writeContract({
        address: contractAddress as any,
        abi: [
          {
            inputs: [
              { internalType: "address", name: "to", type: "address" },
              { internalType: "uint256", name: "amount", type: "uint256" },
            ],
            name: "mint",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "mint",
        args: [validAddress, amount],
      });

      console.log("writeContract called successfully");
      console.log(`=== ${selectedMintCollateral} MINT FUNCTION END ===`);
    } catch (error: any) {
      console.error("=== ERROR IN HANDLE_WBTC_MINT ===");
      console.error("Error:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("=== END ERROR ===");

      let errorMessage = error.message || "Unknown error";

      // Handle specific error cases based on script logic
      if (
        errorMessage.includes("caller is not admin") ||
        errorMessage.includes("admin")
      ) {
        errorMessage =
          "Only the admin can mint WBTC tokens. This error occurs because of the authorization check.";
      } else if (errorMessage.includes("user rejected transaction")) {
        errorMessage = "Transaction was rejected by the user";
      }

      setTransactionStatus("Error: " + errorMessage);
      setPendingTransactionType(null);

      // Clear status after 5 seconds
      setTimeout(() => setTransactionStatus(""), 5000);
    }
  };

  // Add detailed mint validation with fee-aware calculation
  const validateMintAmount = (btcAmount: number) => {
    if (!btcAmount || btcAmount <= 0) return null;

    const btcPrice = protocolState.btcPrice;
    const usdValue = btcAmount * btcPrice;
    const currentRatio = collateralRatio;
    const currentSupply = protocolState.totalSupply;
    const currentCollateralValue = totalCollateralUSD || 0;

    // Use minimum collateral ratio for mint price (first mint scenario)
    const mintPrice = Math.max(1.2, currentRatio);

    // Calculate tokens before fees
    const tokensToMint = usdValue / mintPrice;

    // Calculate fees (1% dev + 1% endowment = 2% total)
    const devFee = tokensToMint * 0.01;
    const endowmentFee = tokensToMint * 0.01;
    const totalToMint = tokensToMint + devFee + endowmentFee;

    // Calculate new state
    const newTotalSupply = currentSupply + totalToMint;
    const newCollateralValue = currentCollateralValue + usdValue;
    const newRatio =
      newTotalSupply > 0 ? newCollateralValue / newTotalSupply : 1.2;

    // Check if it meets minimum collateral ratio
    const minRatio = 1.2;
    const wouldFail = newRatio < minRatio;

    // Calculate maximum viable amount if current amount would fail
    let maxViableAmount = btcAmount;
    if (wouldFail) {
      // Work backwards: newRatio = newCollateralValue / newTotalSupply >= minRatio
      // We want: (currentCollateralValue + maxUsdValue) / (currentSupply + maxTotalToMint) = minRatio
      // Solving for maxUsdValue with fee factor 1.02 (1 + 0.01 + 0.01)
      const feeFactor = 1.02;
      const denominator = feeFactor / mintPrice - 1 / minRatio;

      if (denominator > 0) {
        const maxUsdValue =
          (currentSupply - currentCollateralValue / minRatio) / denominator;
        maxViableAmount = Math.max(0, maxUsdValue / btcPrice);
      } else {
        maxViableAmount = 0;
      }
    }

    return {
      tokensToMint,
      devFee,
      endowmentFee,
      totalToMint,
      newRatio,
      wouldFail,
      maxViableAmount,
      usdValue,
      mintPrice,
    };
  };

  const decodeContractError = (error: any): string => {
    const errorMessage = error.message || error.toString();

    // Check for specific contract error patterns
    if (errorMessage.includes("PriceOracle: price is stale")) {
      return "BTC price is stale. The price oracle needs to be updated. Please contact the administrator.";
    }
    if (errorMessage.includes("Vault: insufficient collateral")) {
      return "Insufficient collateral in the vault for this transaction.";
    }
    if (errorMessage.includes("Vault: collateral ratio too low")) {
      return "Transaction would result in collateral ratio below minimum threshold.";
    }
    if (errorMessage.includes("BTC1USD: caller is not vault")) {
      return "Invalid contract configuration. The BTC1USD contract is not properly connected to the vault.";
    }
    if (errorMessage.includes("user rejected transaction")) {
      return "Transaction was rejected by the user";
    }
    if (errorMessage.includes("insufficient funds")) {
      return "Insufficient funds for gas fees";
    }
    if (errorMessage.includes("Internal JSON-RPC error")) {
      return "Contract execution failed. This could be due to stale price data, insufficient collateral, or contract validation errors. Please check the console for details.";
    }

    return errorMessage;
  };

  // Admin check - Updated to use centralized auth config
  const authStatus = getAuthStatus(address);
  const isAdminUser = authStatus.canViewAdmin;

  const testContractFunction = async () => {
    console.log("Testing contract function call...");
    setTransactionStatus("Testing contract function...");

    try {
      // This is just for debugging - we'll see if we can trigger any kind of interaction
      console.log("Attempting to trigger contract interaction...");
      setTransactionStatus("Contract interaction test completed");
      setTimeout(() => setTransactionStatus(""), 3000);
    } catch (error) {
      console.error("Contract interaction test failed:", error);
      setTransactionStatus("Contract interaction test failed");
      setTimeout(() => setTransactionStatus(""), 3000);
    }
  };

  const sidebarItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "mint", label: "Buy & Sell", icon: Plus },
    { id: "merkle-claim", label: "Claim Rewards", icon: Gift },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    // Admin-only sections
    ...(isAdminUser
      ? [
          {
            id: "governance",
            label: "Vote",
            icon: Users,
          },
          {
            id: "collateral-management",
            label: "Collateral & Testing",
            icon: Bitcoin,
          },
          {
            id: "distribution-admin",
            label: "Distribution Admin",
            icon: Calendar,
          },
          {
            id: "treasury",
            label: "Treasury",
            icon: DollarSign,
          },
          {
            id: "security",
            label: "Security",
            icon: Shield,
          },
        ]
      : []),
  ];

  // Mobile sidebar items with only icons
  const mobileSidebarItems = [
    { id: "overview", icon: Home },
    { id: "mint", icon: Plus },
    { id: "merkle-claim", icon: Gift },
    { id: "analytics", icon: BarChart3 },
    // Admin-only sections
    ...(isAdminUser
      ? [
          { id: "governance", icon: Users },
          { id: "collateral-management", icon: Bitcoin },
          { id: "distribution-admin", icon: Calendar },
          { id: "treasury", icon: DollarSign },
          { id: "security", icon: Shield },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-muted/40 text-foreground">
      {/* Sidebar - Responsive width based on device and state */}
      <div
        className={
          "fixed left-0 top-0 h-screen bg-card border-r border-border transition-all duration-300 z-50 flex flex-col " +
          (isMobile
            ? "w-16"  // Fixed narrow width for mobile (icon size only)
            : sidebarOpen
              ? "w-52"  // Expanded width for desktop when open (208px) - compact to fit text
              : "w-16"  // Narrow width for desktop when closed
          )
        }
      >
        {/* Header - Redesigned for better alignment */}
        <div className="w-full border-b border-border flex-shrink-0">
          {sidebarOpen ? (
            // Expanded state: Logo + Text on left, Toggle on right
            <div className="flex items-center justify-between p-4 h-16">
              <div className="flex items-center gap-3">
                <img
                  src="/btc1usd-logo-transparent.png"
                  alt="BTC1USD Protocol Logo"
                  className="h-8 w-8 object-contain"
                />
                {!isMobile && (
                  <h1 className="text-lg font-bold text-foreground">BTC1</h1>
                )}
              </div>
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Menu className="w-4 h-4" />
                </Button>
              )}
            </div>
          ) : (
            // Collapsed state: Logo towards right, Toggle at far right
            <div className="flex items-center justify-end py-2 pr-0 gap-0 h-16">
              <img
                src="/btc1usd-logo-transparent.png"
                alt="BTC1USD Protocol Logo"
                className="h-8 w-8 object-contain -mr-1"
              />
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-muted-foreground hover:bg-accent hover:text-accent-foreground p-1 h-6 w-6 flex items-center justify-center mr-0.5"
                >
                  <Menu className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        {/* Removed search bar as per user request */}

        {/* Navigation - Scrollable container */}
        <nav className="px-2 py-4 space-y-1 flex-1 overflow-y-auto overflow-x-hidden">
          {isMobile ? (
            // Mobile view with icons only in a compact grid
            <div className="grid grid-cols-1 gap-1">
              {mobileSidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={
                      activeTab === item.id
                        ? "w-full flex items-center justify-center p-3 rounded-lg transition-colors bg-orange-500 text-white hover:bg-orange-600"
                        : "w-full flex items-center justify-center p-3 rounded-lg transition-colors text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
                    }
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          ) : (
            // Desktop view with labels when expanded
            sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={
                    activeTab === item.id
                      ? "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-orange-500 text-white hover:bg-orange-600 " +
                        (!sidebarOpen ? "justify-center" : "")
                      : "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground hover:bg-accent hover:text-accent-foreground " +
                        (!sidebarOpen ? "justify-center" : "")
                  }
                >
                  <Icon className="w-5 h-5" />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              );
            })
          )}
        </nav>
      </div>

      {/* Main Content - Adjusted margin based on sidebar width */}
      <div
        className={
          "transition-all duration-300 " +
          (isMobile
            ? "ml-16"  // Always narrow margin for mobile
            : sidebarOpen
              ? "ml-52"  // Wide margin when sidebar is open (208px)
              : "ml-16"  // Narrow margin when sidebar is closed
          )
        }
      >
        {/* Header - Minimal & Elegant Design */}
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border px-4 md:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left: Dashboard Title (hidden on mobile) */}
            <div className="hidden md:block text-xl font-bold text-foreground">
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 ml-auto">
              
              {!isConnected ? (
                /* Connect Wallet Button */
                <Button
                  onClick={handleConnectWallet}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/20 font-medium"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect
                </Button>
              ) : (
                /* Wallet Dropdown Menu */
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-orange-500/30 hover:border-orange-500/50 hover:bg-orange-500/5 text-foreground font-medium group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <Wallet className="w-4 h-4 text-orange-500" />
                        <span className="hidden sm:inline text-sm">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-orange-500 transition-colors" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 bg-gray-900 dark:bg-gray-900 backdrop-blur-xl border-gray-700 shadow-2xl">
                    {/* Wallet Info Header */}
                    <DropdownMenuLabel className="pb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Wallet</span>
                        <Badge variant="outline" className="border-green-500/50 bg-green-500/20 text-green-400 text-xs font-semibold">
                          Connected
                        </Badge>
                      </div>
                    </DropdownMenuLabel>

                    {/* Network */}
                    <div className="px-2 py-2 border-b border-gray-700">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300 font-medium">Network</span>
                        <Badge variant="outline" className="border-orange-500/50 bg-orange-500/20 text-orange-400 font-semibold">
                          {getNetworkName(chainId)}
                        </Badge>
                      </div>
                    </div>

                    {/* Address with Copy */}
                    <div className="px-2 py-2 border-b border-gray-700">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300 font-medium">Address</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs font-mono text-white hover:bg-gray-800 hover:text-orange-400"
                          onClick={() => address && copyToClipboard(address)}
                        >
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                          <Copy className="w-3 h-3 ml-2 text-gray-400 hover:text-orange-400" />
                        </Button>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="px-2 py-3 border-b border-gray-700">
                      <div className="flex items-start justify-between">
                        <span className="text-sm text-gray-300 font-medium">Balance</span>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-white">
                              {formatBTC1USD(userBalance)}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">BTC1</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-gray-800"
                            onClick={() => refetchBtc1usdBalance()}
                          >
                            <RefreshCw className="w-3 h-3 text-gray-400 hover:text-orange-400 transition-colors" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <DropdownMenuSeparator className="bg-gray-700" />

                    {/* Theme Toggle */}
                    <DropdownMenuItem
                      className="cursor-pointer text-white hover:bg-orange-500/20 focus:bg-orange-500/20 hover:text-orange-400 focus:text-orange-400 m-1 rounded"
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    >
                      <div className="flex items-center justify-between w-full py-1">
                        <span className="font-semibold">
                          {theme === "dark" ? "Light Mode" : "Dark Mode"}
                        </span>
                        {theme === "dark" ? (
                          <Sun className="w-4 h-4 text-orange-400" />
                        ) : (
                          <Moon className="w-4 h-4 text-orange-400" />
                        )}
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="bg-gray-700" />

                    {/* Logout Button */}
                    <DropdownMenuItem
                      className="cursor-pointer text-white hover:bg-orange-500/20 focus:bg-orange-500/20 hover:text-orange-400 focus:text-orange-400 m-1 rounded"
                      onClick={handleDisconnectWallet}
                    >
                      <div className="flex items-center justify-between w-full py-1">
                        <span className="font-semibold">Logout</span>
                        <LogOut className="w-4 h-4 text-orange-500" />
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 sm:p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                  Overview
                </h2>
                <p className="text-muted-foreground">
                  View your BTC1 portfolio and protocol statistics
                </p>
              </div>

              {/* Overview Cards - First row with Buy, Sell, Swap, Rewards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {/* Buy BTC1 Card */}
                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      Buy BTC1
                    </CardTitle>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                      <Plus className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-2xl font-bold text-white">
                      {formatCurrency(Math.max(1.2, collateralRatio || 1.2), 2)}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Mint Price
                    </p>
                    <Button
                      onClick={() => {
                        setMintSubTab("buy");
                        setActiveTab("mint");
                      }}
                      className="w-full sm:w-auto sm:px-8 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold shadow-lg shadow-green-500/20"
                    >
                      BUY
                    </Button>
                  </CardContent>
                </Card>

                {/* Sell BTC1 Card */}
                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      Sell BTC1
                    </CardTitle>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                      <ArrowDownRight className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-2xl font-bold text-white">
                      {collateralRatio >= 1.1
                        ? formatCurrency(1.0, 2)
                        : formatCurrency(0.9 * collateralRatio, 2)}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {collateralRatio >= 1.1 ? "Sell Price (Healthy)" : "Sell Price (Stress)"}
                    </p>
                    <Button
                      onClick={() => {
                        setMintSubTab("sell");
                        setActiveTab("mint");
                      }}
                      className="w-full sm:w-auto sm:px-8 h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold shadow-lg shadow-red-500/20"
                    >
                      SELL
                    </Button>
                  </CardContent>
                </Card>

                {/* Swap Card - 1inch Integration */}
                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      Token Swap
                    </CardTitle>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                      <ArrowLeftRight className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-2xl font-bold text-white">
                      1inch DEX
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Best rates aggregator
                    </p>
                    <Button
                      onClick={() => setSwapModalOpen(true)}
                      disabled={!isConnected || chainId !== 8453}
                      className="w-full sm:w-auto sm:px-8 h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      SWAP
                    </Button>
                  </CardContent>
                </Card>

                {/* Liquidity Card - Krystal Integration */}
                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      Add Liquidity
                    </CardTitle>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                      <Plus className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-2xl font-bold text-white">
                      Earn Fees
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Provide liquidity
                    </p>
                    <Button
                      onClick={() => setLiquidityModalOpen(true)}
                      disabled={!isConnected || chainId !== 8453}
                      className="w-full sm:w-auto sm:px-8 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ADD LIQUIDITY
                    </Button>
                  </CardContent>
                </Card>

                {/* Rewards Card */}
                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      Rewards
                    </CardTitle>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                      <Gift className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-2xl font-bold text-white">
                      {formatBTC1USD(claimableRewards)} BTC1
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {hasClaimableRewards ? "Available to Claim" : "No Rewards Available"}
                    </p>
                    <Button
                      onClick={() => setActiveTab("merkle-claim")}
                      disabled={!hasClaimableRewards}
                      className="w-full sm:w-auto sm:px-8 h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      CLAIM
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Second Row - Statistics & Balance Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Your Balance */}
                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      Your Balance
                    </CardTitle>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-2xl font-bold text-white">
                      {formatBTC1USD(userBalance)}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      BTC1
                    </p>
                  </CardContent>
                </Card>
                {/* BTC Collateral */}
                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      BTC Collateral
                    </CardTitle>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                      <Bitcoin className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-2xl font-bold text-yellow-500">
                      {formatBTC(totalCollateralBTC, 4)}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatCurrency(totalCollateralUSD, 0)} USD value
                    </p>
                  </CardContent>
                </Card>

                {/* BTC1 Supply */}
                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      BTC1 Supply
                    </CardTitle>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
                      <Coins className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-2xl font-bold text-cyan-500">
                      {formatTokens(protocolState.totalSupply)}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Total tokens in circulation
                    </p>
                  </CardContent>
                </Card>

                {/* Collateral Ratio */}
                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">
                      Collateral Ratio
                    </CardTitle>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${healthStatus.color}`}>
                      <Heart className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className={`text-2xl font-bold ${healthStatus.textColor}`}>
                      {protocolState.totalSupply === 0
                        ? "N/A"
                        : formatPercentage(collateralRatio, 1)}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Bitcoin Price: {formatCurrency(protocolState.btcPrice, 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Second Row - Statistics Cards */}
              <div className="grid grid-cols-1 gap-6">
                {/* Recent Activity Card */}
                <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-white" />
                      </div>
                      Recent Activity
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Latest protocol events and transactions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingActivities ? (
                      <div className="text-center py-8 text-gray-400">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
                        <p className="text-base font-medium">Loading activities from blockchain...</p>
                        <p className="text-sm mt-1">
                          Fetching recent events
                        </p>
                      </div>
                    ) : activities.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-base font-medium">No recent activity</p>
                        <p className="text-sm mt-1">
                          Your transactions will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                        {activities.map((activity) => {
                          const iconMap = {
                            plus: <ArrowUpRight className="w-5 h-5" />,
                            minus: <ArrowDownRight className="w-5 h-5" />,
                            gift: <Gift className="w-5 h-5" />,
                            calendar: <CalendarCheck className="w-5 h-5" />,
                            vote: <Vote className="w-5 h-5" />,
                          };

                          const colorMap = {
                            green: "bg-gradient-to-br from-green-500/20 to-green-600/20 text-green-400 border border-green-500/30",
                            red: "bg-gradient-to-br from-red-500/20 to-red-600/20 text-red-400 border border-red-500/30",
                            orange: "bg-gradient-to-br from-orange-500/20 to-orange-600/20 text-orange-400 border border-orange-500/30",
                            blue: "bg-gradient-to-br from-blue-500/20 to-blue-600/20 text-blue-400 border border-blue-500/30",
                            purple: "bg-gradient-to-br from-purple-500/20 to-purple-600/20 text-purple-400 border border-purple-500/30",
                          };

                          const textColorMap = {
                            green: "text-green-400",
                            red: "text-red-400",
                            orange: "text-orange-400",
                            blue: "text-blue-400",
                            purple: "text-purple-400",
                          };

                          const timeAgo = (timestamp: number) => {
                            const seconds = Math.floor(
                              (Date.now() - timestamp) / 1000
                            );
                            if (seconds < 60) return "Just now";
                            if (seconds < 3600)
                              return `${Math.floor(seconds / 60)}m ago`;
                            if (seconds < 86400)
                              return `${Math.floor(seconds / 3600)}h ago`;
                            return `${Math.floor(seconds / 86400)}d ago`;
                          };

                          return (
                            <div
                              key={activity.id}
                              className="flex items-start sm:items-center gap-3 sm:gap-4 p-4 bg-gray-700/30 rounded-xl hover:bg-gray-700/50 transition-all duration-200 border border-transparent hover:border-gray-600/50"
                            >
                              <div
                                className={`w-12 h-12 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                  colorMap[activity.color]
                                }`}
                              >
                                {iconMap[activity.icon]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                                  <div className="font-semibold text-white text-sm sm:text-base">
                                    {activity.title}
                                  </div>
                                  {activity.amount && (
                                    <div className={`font-bold text-base sm:text-lg whitespace-nowrap ${
                                      textColorMap[activity.color]
                                    }`}>
                                      {activity.amount}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                                  <span className="text-xs sm:text-sm text-gray-400">
                                    {activity.description}
                                  </span>
                                  <span className="hidden sm:inline text-gray-600">•</span>
                                  <span className="text-xs text-gray-500">
                                    {timeAgo(activity.timestamp)}
                                  </span>
                                </div>
                                {activity.txHash && (
                                  <a
                                    href={`https://basescan.org/tx/${activity.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mt-2 text-xs sm:text-sm text-orange-500 hover:text-orange-400 font-medium transition-colors"
                                  >
                                    View tx
                                    <ArrowUpRight className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Enhanced BTC1 Holders Card - Wider to accommodate information */}
               {isAdminUser ? ( <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                      <span>BTC1 Holders</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs text-gray-400 hover:text-white"
                        onClick={() => {
                          // Placeholder for refresh functionality
                          console.log("Refreshing holders data");
                        }}
                      >
                        Refresh
                      </Button>
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Token holders in the protocol
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {/* Real holder data with horizontal alignment */}
                      {[
                        {
                          rank: 1,
                          address: protocolState.contractAddresses.btc1usd,
                          name: "Total Supply",
                          balance: protocolState.totalSupply,
                          percentage: 100,
                          icon: "💵",
                          color: "bg-blue-500/10 text-blue-500"
                        },
                        {
                          rank: 2,
                          address: CONTRACT_ADDRESSES.MERKLE_DISTRIBUTOR,
                          name: "Merkle Distributor",
                          balance: merkleDistributorBalance ? parseFloat(formatUnits(merkleDistributorBalance as bigint, 8)) : 0,
                          percentage: protocolState.totalSupply > 0 ?
                                    ((merkleDistributorBalance ? parseFloat(formatUnits(merkleDistributorBalance as bigint, 8)) : 0) / protocolState.totalSupply) * 100 :
                                    (merkleDistributorBalance && parseFloat(formatUnits(merkleDistributorBalance as bigint, 8)) > 0 ? 100 : 0),
                          icon: "🏦",
                          color: "bg-green-500/10 text-green-500"
                        },
                        {
                          rank: 3,
                          address: CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR,
                          name: "Merkle Fee Collector",
                          balance: merklFeeCollectorBalance ? parseFloat(formatUnits(merklFeeCollectorBalance as bigint, 8)) : 0,
                          percentage: protocolState.totalSupply > 0 ?
                                    ((merklFeeCollectorBalance ? parseFloat(formatUnits(merklFeeCollectorBalance as bigint, 8)) : 0) / protocolState.totalSupply) * 100 :
                                    (merklFeeCollectorBalance && parseFloat(formatUnits(merklFeeCollectorBalance as bigint, 8)) > 0 ? 100 : 0),
                          icon: "💰",
                          color: "bg-emerald-500/10 text-emerald-500"
                        },
                        {
                          rank: 4,
                          address: CONTRACT_ADDRESSES.DEV_WALLET,
                          name: "Dev Wallet",
                          balance: devWalletBalance ? parseFloat(formatUnits(devWalletBalance as bigint, 8)) : 0,
                          percentage: protocolState.totalSupply > 0 ?
                                    ((devWalletBalance ? parseFloat(formatUnits(devWalletBalance as bigint, 8)) : 0) / protocolState.totalSupply) * 100 :
                                    (devWalletBalance && parseFloat(formatUnits(devWalletBalance as bigint, 8)) > 0 ? 100 : 0),
                          icon: "💻",
                          color: "bg-purple-500/10 text-purple-500"
                        },
                        {
                          rank: 5,
                          address: CONTRACT_ADDRESSES.ENDOWMENT_WALLET,
                          name: "Endowment Wallet",
                          balance: endowmentWalletBalance ? parseFloat(formatUnits(endowmentWalletBalance as bigint, 8)) : 0,
                          percentage: protocolState.totalSupply > 0 ?
                                    ((endowmentWalletBalance ? parseFloat(formatUnits(endowmentWalletBalance as bigint, 8)) : 0) / protocolState.totalSupply) * 100 :
                                    (endowmentWalletBalance && parseFloat(formatUnits(endowmentWalletBalance as bigint, 8)) > 0 ? 100 : 0),
                          icon: "❤️",
                          color: "bg-pink-500/10 text-pink-500"
                        },
                        {
                          rank: 6,
                          address: address || "0x0000000000000000000000000000000000000000",
                          name: "Your Balance",
                          balance: userBalance,
                          percentage: protocolState.totalSupply > 0 ? (userBalance / protocolState.totalSupply) * 100 :
                                    (userBalance > 0 ? 100 : 0),
                          icon: "👤",
                          color: "bg-orange-500/10 text-orange-500"
                        },
                        {
                          rank: 7,
                          address: "0x0000000000000000000000000000000000000000",
                          name: "Other Holders",
                          balance: Math.max(0, protocolState.totalSupply - (
                            (merkleDistributorBalance ? parseFloat(formatUnits(merkleDistributorBalance as bigint, 8)) : 0) +
                            (merklFeeCollectorBalance ? parseFloat(formatUnits(merklFeeCollectorBalance as bigint, 8)) : 0) +
                            (devWalletBalance ? parseFloat(formatUnits(devWalletBalance as bigint, 8)) : 0) +
                            (endowmentWalletBalance ? parseFloat(formatUnits(endowmentWalletBalance as bigint, 8)) : 0) +
                            userBalance
                          )),
                          percentage: protocolState.totalSupply > 0 ?
                                    (Math.max(0, protocolState.totalSupply - (
                                      (merkleDistributorBalance ? parseFloat(formatUnits(merkleDistributorBalance as bigint, 8)) : 0) +
                                      (merklFeeCollectorBalance ? parseFloat(formatUnits(merklFeeCollectorBalance as bigint, 8)) : 0) +
                                      (devWalletBalance ? parseFloat(formatUnits(devWalletBalance as bigint, 8)) : 0) +
                                      (endowmentWalletBalance ? parseFloat(formatUnits(endowmentWalletBalance as bigint, 8)) : 0) +
                                      userBalance
                                    )) / protocolState.totalSupply) * 100 :
                                    (Math.max(0, protocolState.totalSupply - (
                                      (merkleDistributorBalance ? parseFloat(formatUnits(merkleDistributorBalance as bigint, 8)) : 0) +
                                      (merklFeeCollectorBalance ? parseFloat(formatUnits(merklFeeCollectorBalance as bigint, 8)) : 0) +
                                      (devWalletBalance ? parseFloat(formatUnits(devWalletBalance as bigint, 8)) : 0) +
                                      (endowmentWalletBalance ? parseFloat(formatUnits(endowmentWalletBalance as bigint, 8)) : 0) +
                                      userBalance
                                    )) > 0 ? 100 : 0),
                          icon: "👥",
                          color: "bg-gray-500/10 text-gray-500"
                        },
                      ].map((holder) => (
                        <div key={holder.rank} className="flex flex-col items-center p-3 bg-gradient-to-br from-gray-700/40 to-gray-800/40 rounded-lg hover:from-gray-700/50 hover:to-gray-800/50 transition-all duration-300 border border-gray-600 hover:border-gray-500">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${holder.color} text-xl`}>
                            {holder.icon}
                          </div>
                          <div className="text-center mb-2">
                            <div className="font-bold text-white text-xs">{holder.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono mt-1">
                              {holder.address.substring(0, 6)}...{holder.address.substring(holder.address.length - 4)}
                            </div>
                          </div>
                          <div className="text-center w-full">
                            <div className="font-bold text-white text-sm">
                              {formatTokens(holder.balance, 2)}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">BTC1</div>
                            <div className="mt-2 w-full bg-gray-600 rounded-full h-1.5">
                              <div
                                className="bg-gradient-to-r from-orange-500 to-yellow-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, holder.percentage)}%` }}
                              ></div>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">
                              {protocolState.totalSupply === 0 && holder.balance > 0 ? (
                                "100% (of 0 supply)"
                              ) : (
                                `${holder.percentage.toFixed(1)}%`
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-5 border-t border-gray-600 text-center mt-5">
                      {protocolState.totalSupply === 0 ? (
                        <p className="text-xs text-yellow-500">
                          ⚠️ No BTC1 tokens have been minted yet. Total supply is currently 0.
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">
                          Real-time protocol statistics. Last updated: {new Date().toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
                ):null}
              </div>
            </div>
          )}

         

          {activeTab === "mint" && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Buy & Sell BTC1
                </h2>
                <p className="text-muted-foreground">
                  Deposit collateral to buy coins or sell them back for BTC
                </p>
              </div>
              <Tabs value={mintSubTab} onValueChange={(value) => setMintSubTab(value as "buy" | "sell")} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-6">
                  <TabsTrigger 
                    value="buy"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Buy
                  </TabsTrigger>
                  <TabsTrigger 
                    value="sell"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white"
                  >
                    <ArrowDownRight className="w-4 h-4 mr-2" />
                    Sell
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="buy">
                  <div className="max-w-2xl mx-auto">
                    {/* Mint BTC1 */}
                    <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                            <Plus className="w-6 h-6 text-white" />
                          </div>
                          Buy BTC1
                        </CardTitle>
                        <CardDescription className="text-gray-400 mt-2">
                          Deposit BTC collateral to buy coins
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Collateral Selection - Enhanced Dropdown Format */}
                    <div className="space-y-3">
                      <Label className="text-gray-300 text-sm font-medium">
                        Select Collateral Token
                      </Label>
                      <Select value={selectedCollateral} onValueChange={(value) => {
                        setSelectedCollateral(value);
                        setMintAmount("");
                      }}>
                        <SelectTrigger className="bg-gradient-to-r from-gray-700/50 to-gray-800/50 border-2 border-gray-600 focus:border-green-500 text-white h-14 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 px-4">
                          <SelectValue placeholder="Select collateral token" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-[200px]">
                          {["WBTC", "cbBTC", "tBTC"].map((token) => {
                            const balance = parseFloat(
                              token === "WBTC"
                                ? userWbtcBalance
                                : token === "cbBTC"
                                ? userCbbtcBalance
                                : userTbtcBalance
                            );
                            return (
                              <SelectItem 
                                key={token} 
                                value={token}
                                className="focus:bg-green-500/20 focus:text-green-400 py-3 px-4 cursor-pointer transition-colors duration-200"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium text-white">{token}</span>
                                  <span className="text-gray-400 text-sm ml-4">
                                    {balance.toFixed(4)}
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label
                          htmlFor="mint-amount"
                          className="text-gray-300 text-sm font-medium"
                        >
                          Amount to Deposit
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 bg-gray-700/50 px-3 py-1 rounded-full">
                            Balance:{" "}
                            {parseFloat(
                              selectedCollateral === "WBTC"
                                ? userWbtcBalance
                                : selectedCollateral === "cbBTC"
                                ? userCbbtcBalance
                                : userTbtcBalance
                            ).toFixed(8)}{" "}
                            {selectedCollateral}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-6 px-2 border-gray-600 text-gray-300 hover:bg-green-500/20 hover:border-green-500 hover:text-green-400"
                            onClick={() => {
                              const balance = parseFloat(
                                selectedCollateral === "WBTC"
                                  ? userWbtcBalance
                                  : selectedCollateral === "cbBTC"
                                  ? userCbbtcBalance
                                  : userTbtcBalance
                              );
                              setMintAmount(balance.toString());
                            }}
                          >
                            Max
                          </Button>
                        </div>
                      </div>
                      <div className="relative">
                        <Input
                          id="mint-amount"
                          type="number"
                          placeholder="0.00000000"
                          value={mintAmount}
                          onChange={(e) => setMintAmount(e.target.value)}
                          className="bg-gray-900 border-2 border-gray-700 focus:border-green-500 text-white text-2xl font-bold placeholder:text-gray-400 pr-24 h-16 rounded-xl"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                          <span className="text-gray-400 font-semibold">
                            {selectedCollateral}
                          </span>
                        </div>
                      </div>

                      {/* Quick amount buttons */}
                      <div className="grid grid-cols-4 xs:grid-cols-2 sm:grid-cols-4 gap-2">
                        {[0.001, 0.01, 0.1, 1].map((amount) => {
                          const userCollateral = parseFloat(
                            selectedCollateral === "WBTC"
                              ? userWbtcBalance
                              : selectedCollateral === "cbBTC"
                              ? userCbbtcBalance
                              : userTbtcBalance
                          );
                          const available = amount <= userCollateral;
                          return (
                            <Button
                              key={amount}
                              variant="outline"
                              size="sm"
                              className={`text-xs font-semibold rounded-lg h-10 ${
                                available
                                  ? "border-gray-600 text-gray-300 hover:bg-green-500/20 hover:border-green-500 hover:text-green-400 transition-all"
                                  : "border-gray-700 text-gray-600 cursor-not-allowed opacity-50"
                              }`}
                              disabled={!available}
                              onClick={() =>
                                available && setMintAmount(amount.toString())
                              }
                            >
                              {amount}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Real-time Mint Calculations */}
                    {mintAmount &&
                      parseFloat(mintAmount) > 0 &&
                      (() => {
                        const btcAmount = parseFloat(mintAmount);
                        if (isNaN(btcAmount) || btcAmount <= 0) return null;

                        const calc = calculateMintDetails(btcAmount);

                        // Validation checks - check balance based on selected collateral
                        const userCollateralBalance = parseFloat(
                          selectedCollateral === "WBTC"
                            ? userWbtcBalance
                            : selectedCollateral === "cbBTC"
                            ? userCbbtcBalance
                            : userTbtcBalance
                        );
                        const hasValidationErrors = [
                          {
                            condition: btcAmount > userCollateralBalance,
                            message: `Insufficient ${selectedCollateral} balance (${userCollateralBalance.toFixed(
                              8
                            )} available)`,
                          },
                        ].filter((error) => error.condition);

                        return (
                          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="text-base font-semibold text-green-400">
                                Preview
                              </div>
                              {hasValidationErrors.length === 0 && (
                                <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
                                  Ready to Mint
                                </div>
                              )}
                            </div>

                            {/* Validation Errors */}
                            {hasValidationErrors.length > 0 && (
                              <div className="space-y-1">
                                {hasValidationErrors.map((error, index) => (
                                  <div
                                    key={index}
                                    className="bg-red-900/30 border border-red-500/50 rounded-lg p-3"
                                  >
                                    <div className="text-red-400 text-sm font-medium">
                                      ⚠️ {error.message}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="space-y-3">
                              <div className="bg-gray-800/50 rounded-lg p-4">
                                <div className="text-center">
                                  <div className="text-gray-400 text-xs mb-1">
                                    You Will Receive
                                  </div>
                                  <div className="text-3xl font-bold text-green-400">
                                    {calc.userReceives.toFixed(4)}
                                  </div>
                                  <div className="text-gray-400 text-sm mt-1">
                                    BTC1
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-400">
                                    USD Value:
                                  </span>
                                  <span className="text-white font-semibold">
                                    {formatCurrency(calc.usdValue)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-400">
                                    Mint Price:
                                  </span>
                                  <span className="text-white font-semibold">
                                    {formatCurrency(calc.mintPrice)}
                                  </span>
                                </div>
                                <div className="border-t border-gray-600/50 pt-2">
                                  <div className="flex justify-between text-xs text-gray-500">
                                    <span>Dev Fee (1%):</span>
                                    <span>{calc.devFee.toFixed(6)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Endowment (1%):</span>
                                    <span>{calc.endowmentFee.toFixed(6)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                    <div className="pt-2">
                      <Button
                        onClick={handleMint}
                        disabled={
                          !isConnected ||
                          !mintAmount ||
                          (isPending &&
                            (pendingTransactionType === "approve" ||
                              pendingTransactionType === "mint")) ||
                          (isConfirming && pendingTransactionType === "mint")
                        }
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-lg h-14 rounded-xl shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {(isPending &&
                          (pendingTransactionType === "approve" ||
                            pendingTransactionType === "mint")) ||
                        (isConfirming && pendingTransactionType === "mint") ? (
                          <div className="flex items-center justify-center space-x-3">
                            <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span className="font-semibold">
                              {isPending ? "Confirm in wallet..." : "Buying..."}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-2">
                            <Plus className="w-5 h-5" />
                            <span>Buy BTC1</span>
                          </div>
                        )}
                      </Button>
                    </div>

                    {/* Progress indicator */}
                    {mintingStep !== "idle" && (
                      <div className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">
                            Progress
                          </span>
                          <span className="text-sm text-gray-400">
                            {mintingStep === "approving"
                              ? "Step 1 of 2"
                              : mintingStep === "minting"
                              ? "Step 2 of 2"
                              : ""}
                          </span>
                        </div>
                        <Progress
                          value={
                            mintingStep === "approving"
                              ? 50
                              : mintingStep === "minting"
                              ? 100
                              : 0
                          }
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Approve Vault</span>
                          <span>Buy BTC1</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                  </div>
                </TabsContent>

                <TabsContent value="sell">
                  <div className="max-w-2xl mx-auto">
                    {/* Redeem BTC1 */}
                    <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 12H4"
                              />
                            </svg>
                          </div>
                          Sell BTC1
                        </CardTitle>
                        <CardDescription className="text-gray-400 mt-2">
                          Sell coins to receive BTC collateral
                        </CardDescription>
                      </div>
                      <Button
                        onClick={async () => {
                          console.log("🔄 Manually refreshing vault balances...");
                          await Promise.all([
                            refetchVaultWbtcBalance(),
                            refetchVaultCbbtcBalance(),
                            refetchVaultTbtcBalance(),
                            refetchCollateralValue(),
                            refetchCollateralRatio(),
                          ]);
                          console.log("✅ Vault balances refreshed!");
                        }}
                        variant="outline"
                        size="sm"
                        className="text-gray-300 hover:text-white"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Redeem Collateral Selection - Enhanced Dropdown Format */}
                    <div className="space-y-3">
                      <Label className="text-gray-300 text-sm font-medium">
                        Receive Collateral
                      </Label>
                      <Select value={selectedRedeemCollateral} onValueChange={setSelectedRedeemCollateral}>
                        <SelectTrigger className="bg-gradient-to-r from-gray-700/50 to-gray-800/50 border-2 border-gray-600 focus:border-orange-500 text-white h-14 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 px-4">
                          <SelectValue placeholder="Select collateral token" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-[200px]">
                          {["WBTC", "cbBTC", "tBTC"].map((token) => {
                            const vaultBalance =
                              token === "WBTC"
                                ? vaultWbtcBalance
                                  ? parseFloat(formatUnits(vaultWbtcBalance as unknown as bigint, 8))
                                  : 0
                                : token === "cbBTC"
                                ? vaultCbbtcBalance
                                  ? parseFloat(formatUnits(vaultCbbtcBalance as unknown as bigint, 8))
                                  : 0
                                : vaultTbtcBalance
                                ? parseFloat(formatUnits(vaultTbtcBalance as unknown as bigint, 8))
                                : 0;

                            return (
                              <SelectItem 
                                key={token} 
                                value={token}
                                className="focus:bg-orange-500/20 focus:text-orange-400 py-3 px-4 cursor-pointer transition-colors duration-200"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium text-white">{token}</span>
                                  <span className="text-gray-400 text-sm ml-4">
                                    Available: {vaultBalance.toFixed(4)}
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label
                          htmlFor="redeem-amount"
                          className="text-gray-300 text-sm font-medium"
                        >
                          Amount to Sell
                        </Label>
                        <span className="text-xs text-gray-400 bg-gray-700/50 px-3 py-1 rounded-full">
                          Balance: {userBalance.toFixed(8)} BTC1
                        </span>
                      </div>
                      <div className="relative">
                        <Input
                          id="redeem-amount"
                          type="number"
                          placeholder="0.00000000"
                          value={redeemAmount}
                          onChange={(e) => setRedeemAmount(e.target.value)}
                          className="bg-gray-900 border-2 border-gray-700 focus:border-orange-500 text-white text-2xl font-bold placeholder:text-gray-400 pr-32 h-16 rounded-xl"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                          <span className="text-gray-400 font-semibold">
                            BTC1
                          </span>
                        </div>
                      </div>

                      {/* Quick amount buttons */}
                      <div className="grid grid-cols-4 gap-2">
                        {["10%", "25%", "50%", "100%"].map(
                          (amount, index) => {
                            const percentage = parseFloat(amount) / 100;
                            const actualAmount = userBalance * percentage;
                            const label = amount;

                            const available =
                              actualAmount <= userBalance && actualAmount > 0;

                            return (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                className={`text-xs font-semibold rounded-lg h-10 ${
                                  available
                                    ? "border-gray-600 text-gray-300 hover:bg-orange-500/20 hover:border-orange-500 hover:text-orange-400 transition-all"
                                    : "border-gray-700 text-gray-600 cursor-not-allowed opacity-50"
                                }`}
                                disabled={!available}
                                onClick={() =>
                                  available &&
                                  setRedeemAmount(actualAmount.toFixed(8))
                                }
                              >
                                {label}
                              </Button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* Real-time Redeem Calculations */}
                    {redeemAmount &&
                      parseFloat(redeemAmount) > 0 &&
                      (() => {
                        const tokenAmount = parseFloat(redeemAmount);
                        if (isNaN(tokenAmount) || tokenAmount <= 0) return null;

                        const calc = calculateRedeemDetails(tokenAmount);

                        // Validation checks
                        const hasValidationErrors = [
                          {
                            condition: tokenAmount > userBalance,
                            message: `Insufficient BTC1 balance (${userBalance.toFixed(
                              8
                            )} available)`,
                          },
                        ].filter((error) => error.condition);

                        return (
                          <div
                            className={`rounded-xl p-5 space-y-4 ${
                              calc.isStressMode
                                ? "bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30"
                                : "bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/30"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-base font-semibold text-orange-400">
                                Preview
                              </div>
                              <div
                                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  calc.isStressMode
                                    ? "bg-red-500/20 text-red-400"
                                    : hasValidationErrors.length === 0
                                    ? "bg-orange-500/20 text-orange-400"
                                    : "bg-gray-500/20 text-gray-400"
                                }`}
                              >
                                {calc.isStressMode
                                  ? "⚠️ Stress Mode"
                                  : calc.redemptionMode}
                              </div>
                            </div>

                            {/* Validation Errors */}
                            {hasValidationErrors.length > 0 && (
                              <div className="space-y-1">
                                {hasValidationErrors.map((error, index) => (
                                  <div
                                    key={index}
                                    className="bg-red-900/30 border border-red-500/50 rounded-lg p-3"
                                  >
                                    <div className="text-red-400 text-sm font-medium">
                                      ⚠️ {error.message}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {calc.isStressMode && (
                              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3">
                                <div className="text-red-400 text-sm font-semibold">
                                  ⚠️ Protocol in Stress Mode
                                </div>
                                <div className="text-red-300 text-xs mt-1">
                                  Receiving{" "}
                                  {(calc.effectivePrice * 100).toFixed(1)}% of
                                  face value
                                </div>
                              </div>
                            )}

                            <div className="space-y-3">
                              <div className="bg-gray-800/50 rounded-lg p-4">
                                <div className="text-center">
                                  <div className="text-gray-400 text-xs mb-1">
                                    You Will Receive
                                  </div>
                                  <div className="text-3xl font-bold text-orange-400">
                                    {calc.btcToReceive.toFixed(4)}
                                  </div>
                                  <div className="text-gray-400 text-sm mt-1">
                                    {selectedRedeemCollateral}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-400">
                                    USD Value:
                                  </span>
                                  <span className="text-white font-semibold">
                                    {formatCurrency(calc.usdValue)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-400">
                                    Effective Price:
                                  </span>
                                  <span className="text-white font-semibold">
                                    {formatCurrency(calc.effectivePrice)}
                                  </span>
                                </div>
                                <div className="border-t border-gray-600/50 pt-2">
                                  <div className="flex justify-between text-xs text-gray-500">
                                    <span>Dev Fee (0.1%):</span>
                                    <span>{calc.devFee.toFixed(6)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Efficiency:</span>
                                    <span
                                      className={
                                        calc.effectivePrice >= 0.95
                                          ? "text-green-400"
                                          : calc.effectivePrice >= 0.85
                                          ? "text-yellow-400"
                                          : "text-red-400"
                                      }
                                    >
                                      {(calc.effectivePrice * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                    <div className="pt-2">
                      <Button
                        onClick={handleRedeem}
                        disabled={
                          !isConnected ||
                          !redeemAmount ||
                          (isPending && pendingTransactionType === "redeem") ||
                          (isConfirming && pendingTransactionType === "redeem")
                        }
                        className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-lg h-14 rounded-xl shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {(isPending && pendingTransactionType === "redeem") ||
                        (isConfirming &&
                          pendingTransactionType === "redeem") ? (
                          <div className="flex items-center justify-center space-x-3">
                            <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span className="font-semibold">
                              {isPending
                                ? "Confirm in wallet..."
                                : "Selling..."}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-2">
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 12H4"
                              />
                            </svg>
                            <span>Sell BTC1</span>
                          </div>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Single Transaction Status Message - Visible to both Buy and Sell */}
              {transactionStatus && (
                <Alert
                  className={`${
                    transactionStatus.includes("success") ||
                    transactionStatus.includes("Success") ||
                    transactionStatus.includes("completed")
                      ? "bg-green-900/20 border-green-500/30"
                      : transactionStatus.includes("cancelled") ||
                        transactionStatus.includes("Cancelled") ||
                        transactionStatus.includes("failed") ||
                        transactionStatus.includes("Failed") ||
                        transactionStatus.includes("error") ||
                        transactionStatus.includes("Error")
                      ? "bg-red-900/20 border-red-500/30"
                      : "bg-blue-900/20 border-blue-500/30"
                  }`}
                >
                  <AlertCircle
                    className={`h-4 w-4 ${
                      transactionStatus.includes("success") ||
                      transactionStatus.includes("Success") ||
                      transactionStatus.includes("completed")
                        ? "text-green-400"
                        : transactionStatus.includes("cancelled") ||
                          transactionStatus.includes("Cancelled") ||
                          transactionStatus.includes("failed") ||
                          transactionStatus.includes("Failed") ||
                          transactionStatus.includes("error") ||
                          transactionStatus.includes("Error")
                        ? "text-red-400"
                        : "text-blue-400"
                    }`}
                  />
                  <AlertDescription className="text-gray-200 font-medium">
                    {transactionStatus}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {activeTab === "collateral-management" && isAdminUser && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Collateral Management & Testing
                </h2>
                <p className="text-muted-foreground">
                  Manage protocol collateral tokens and mint test tokens for development
                </p>
              </div>
              <CollateralManagement 
                isAdmin={!!isAdminUser} 
                protocolState={protocolState}
              />
            </div>
          )}

          {activeTab === "analytics" && (
            <AnalyticsDashboard
              btcPrice={protocolState.btcPrice}
              collateralRatio={collateralRatio}
              totalSupply={protocolState.totalSupply}
              address={address}
              userBalance={userBalance}
              nextDistributionTime={nextDistributionTime}
              distributionCount={distributionCount}
              weeklyReward={weeklyReward}
              devWalletBalance={devWalletBalance ? parseFloat(formatUnits(devWalletBalance as bigint, 8)) : 0}
              endowmentWalletBalance={endowmentWalletBalance ? parseFloat(formatUnits(endowmentWalletBalance as bigint, 8)) : 0}
              merkleDistributorBalance={merkleDistributorBalance ? parseFloat(formatUnits(merkleDistributorBalance as bigint, 8)) : 0}
              vaultWbtcBalance={vaultWbtcBalance ? parseFloat(formatUnits(vaultWbtcBalance as unknown as bigint, 8)) : 0}
              vaultCbbtcBalance={vaultCbbtcBalance ? parseFloat(formatUnits(vaultCbbtcBalance as unknown as bigint, 8)) : 0}
              vaultTbtcBalance={vaultTbtcBalance ? parseFloat(formatUnits(vaultTbtcBalance as unknown as bigint, 8)) : 0}
              totalCollateralUSD={totalCollateralUSD}
              totalCollateralBTC={totalCollateralBTC}
              canExecuteDistribution={canExecuteDistribution as boolean}
              currentRewardPerToken={currentRewardPerToken ? parseFloat(formatUnits(currentRewardPerToken, 8)) : 0}
            />
          )}
          {activeTab === "merkle-claim" && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Claim Your Rewards
                </h2>
                <p className="text-muted-foreground">
                  Claim your BTC1 rewards from multiple distributions (7-day cycle, 365-day claim window)
                </p>
              </div>
              <EnhancedMerkleClaim isAdmin={!!isAdminUser} />
            </div>
          )}
          {activeTab === "distribution-admin" && isAdminUser && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Distribution Administration
                </h2>
                <p className="text-muted-foreground">
                  Manage distributions (weekly cycle) and merkle tree operations
                </p>
              </div>
              <DistributionAdmin
                collateralRatio={collateralRatio}
                totalSupply={protocolState.totalSupply}
                onSetMerkleRoot={handleSetMerkleRoot}
                onExecuteDistribution={handleExecuteDistribution}
              />
            </div>
          )}
          {activeTab === "governance" && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Vote
                </h2>
                <p className="text-muted-foreground">
                  Comprehensive protocol governance, parameter management, and
                  endowment control
                </p>
              </div>
              <UnifiedGovernanceDashboard
                isAdmin={!!isAdminUser}
                userBalance={userBalance}
              />
            </div>
          )}
          {activeTab === "security" && isAdminUser && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Security & Access Control
                </h2>
                <p className="text-muted-foreground">
                  Monitor protocol security, manage critical address changes, and system health
                </p>
              </div>
              
              {/* BTC1USD Timelock Manager */}
              <BTC1USDTimelockManager />
              
              {/* Security Monitoring */}
              <SecurityMonitoring
                isAdmin={!!isAdminUser}
                collateralRatio={collateralRatio}
              />
            </div>
          )}
          {activeTab === "treasury" && isAdminUser && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Treasury Management
                </h2>
                <p className="text-muted-foreground">
                  Manage protocol treasury and financial operations
                </p>
              </div>
              <TreasuryDashboard isAdmin={!!isAdminUser} />
            </div>
          )}

        </main>
      </div>

      {/* Swap Modal */}
      <SwapModal isOpen={swapModalOpen} onClose={() => setSwapModalOpen(false)} />

      {/* Liquidity Modal */}
      <LiquidityModal isOpen={liquidityModalOpen} onClose={() => setLiquidityModalOpen(false)} />

      {/* Safe Transaction Modal */}
      {safeModalConfig && (
        <SafeTransactionModal
          isOpen={safeModalOpen}
          onClose={() => {
            setSafeModalOpen(false);
            setSafeModalConfig(null);
          }}
          title={safeModalConfig.title}
          description={safeModalConfig.description}
          contractAddress={safeModalConfig.contractAddress}
          functionSignature={safeModalConfig.functionSignature}
          calldata={safeModalConfig.calldata}
          category={safeModalConfig.category}
        />
      )}
    </div>
  );
}

export default Dashboard;
