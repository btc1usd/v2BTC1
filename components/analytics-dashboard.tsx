"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  LineChart,
  Line,
  Bar,
  BarChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts"
import { RefreshCcw, Gift, Heart, Users, Activity, Shield } from "lucide-react"
import { formatCurrency, formatBTC } from "@/lib/protocol-math"
import { useAnalyticsData } from "@/hooks/use-analytics-data"
import { formatUnits } from "viem"

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num)
}

// Enhanced color palette for beautiful charts
const CHART_COLORS = {
  primary: "#f97316",      // Orange - primary data
  secondary: "#fb923c",    // Light Orange - secondary data
  accent: "#fdba74",       // Lighter Orange - accent data
  success: "#10b981",      // Emerald - positive trends
  warning: "#f59e0b",      // Amber - warnings
  danger: "#ef4444",       // Red - critical data
  neutral: "#94a3b8",      // Slate - neutral data
  background: "#1e293b",   // Slate - chart background
  grid: "#334155",         // Slate - grid lines
  text: "#cbd5e1"          // Slate - text
};

interface AnalyticsDashboardProps {
  btcPrice: number
  collateralRatio: number
  totalSupply: number
  address?: string
  userBalance: number
  nextDistributionTime?: bigint
  distributionCount?: bigint
  weeklyReward: number
  devWalletBalance: number
  endowmentWalletBalance: number
  merkleDistributorBalance: number
  vaultWbtcBalance: number
  vaultCbbtcBalance: number
  vaultTbtcBalance: number
  totalCollateralUSD: number
  totalCollateralBTC: number
  canExecuteDistribution?: boolean
  currentRewardPerToken: number
}

export function AnalyticsDashboard({
  btcPrice,
  collateralRatio,
  totalSupply,
  address,
  userBalance,
  nextDistributionTime,
  distributionCount,
  weeklyReward,
  devWalletBalance,
  endowmentWalletBalance,
  merkleDistributorBalance,
  vaultWbtcBalance,
  vaultCbbtcBalance,
  vaultTbtcBalance,
  totalCollateralUSD,
  totalCollateralBTC,
  canExecuteDistribution,
  currentRewardPerToken
}: AnalyticsDashboardProps) {
  // Fetch real analytics data from contracts
  const { collateralData, totalSupply: totalSupplyFromContract, totalHolders, loading, error, refetch } = useAnalyticsData(btcPrice);

  // Use contract data if available, fallback to prop
  const actualTotalSupply = totalSupplyFromContract > 0n ? Number(totalSupplyFromContract) / 1e8 : totalSupply;

  // Calculate user-specific earnings metrics
  const lifetimeRewards = userBalance * weeklyReward * (distributionCount ? Number(distributionCount) : 0);
  const estimatedWeeklyEarnings = userBalance * weeklyReward;
  const annualizedYield = actualTotalSupply > 0 ? (weeklyReward * 52 / collateralRatio) * 100 : 0;

  // Calculate reward tier based on collateral ratio
  const getRewardTier = (ratio: number) => {
    if (ratio >= 2.02) return { name: "Diamond", reward: "10¢", color: "text-cyan-400" };
    if (ratio >= 1.92) return { name: "Platinum", reward: "9¢", color: "text-slate-300" };
    if (ratio >= 1.82) return { name: "Gold", reward: "8¢", color: "text-yellow-400" };
    if (ratio >= 1.72) return { name: "Silver", reward: "7¢", color: "text-gray-400" };
    if (ratio >= 1.62) return { name: "Bronze", reward: "6¢", color: "text-orange-600" };
    if (ratio >= 1.52) return { name: "Tier 5", reward: "5¢", color: "text-green-400" };
    if (ratio >= 1.42) return { name: "Tier 4", reward: "4¢", color: "text-blue-400" };
    if (ratio >= 1.32) return { name: "Tier 3", reward: "3¢", color: "text-purple-400" };
    if (ratio >= 1.22) return { name: "Tier 2", reward: "2¢", color: "text-pink-400" };
    if (ratio >= 1.12) return { name: "Tier 1", reward: "1¢", color: "text-red-400" };
    return { name: "No Rewards", reward: "0¢", color: "text-gray-500" };
  };

  const currentTier = getRewardTier(collateralRatio);

  // Calculate countdown to next distribution
  const getTimeUntilDistribution = () => {
    if (!nextDistributionTime) return "N/A";
    const nextDist = new Date(Number(nextDistributionTime) * 1000);
    const now = new Date();
    const diff = nextDist.getTime() - now.getTime();

    if (diff <= 0) return "Ready Now";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Current reward projection for next 6 weeks (based on current tier)
  // Note: weeklyRewardGrowth represents per-distribution rewards (testnet: 7-hour cycle, mainnet: weekly)
  const weeklyRewardGrowth = Array.from({ length: 6 }, (_, i) => ({
    week: `Dist ${i + 1}`, // Distribution cycle (7 hours in testnet, 7 days in mainnet)
    earned: userBalance * weeklyReward,
    currentBalance: userBalance + (userBalance * weeklyReward * i),
  }));

  // Show current collateral ratio across timeframe (historical data requires indexing)
  const collateralRatioTrend = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ratio: collateralRatio,
  }));

  // Fee allocation data
  const feeAllocationData = [
    { name: "Holders (Per Dist)", value: 98.9, amount: merkleDistributorBalance, color: CHART_COLORS.primary },
    { name: "Development", value: 1.0, amount: devWalletBalance, color: CHART_COLORS.secondary },
    { name: "Endowment", value: 0.1, amount: endowmentWalletBalance, color: CHART_COLORS.success },
  ];

  // Vault composition data
  const vaultComposition = [
    { name: "WBTC", value: vaultWbtcBalance, percentage: totalCollateralBTC > 0 ? (vaultWbtcBalance / totalCollateralBTC) * 100 : 0, color: "#f59e0b" },
    { name: "cbBTC", value: vaultCbbtcBalance, percentage: totalCollateralBTC > 0 ? (vaultCbbtcBalance / totalCollateralBTC) * 100 : 0, color: "#0ea5e9" },
    { name: "tBTC", value: vaultTbtcBalance, percentage: totalCollateralBTC > 0 ? (vaultTbtcBalance / totalCollateralBTC) * 100 : 0, color: "#8b5cf6" },
  ];

  // Total distributed calculation
  const totalDistributed = merkleDistributorBalance + devWalletBalance + endowmentWalletBalance;

  // Participation metrics (based on distribution data)
  // Use real holder count from Alchemy API
  const activeHolders = totalHolders > 0 ? totalHolders : 0;

  // Claim rate calculation based on merkle distributor balance
  // If distributions have occurred, estimate claim rate
  const totalRewardsIssued = (distributionCount ? Number(distributionCount) : 0) * actualTotalSupply * weeklyReward;
  const rewardsInDistributor = merkleDistributorBalance;
  const claimRate = totalRewardsIssued > 0 ? Math.min(100, Math.max(0, ((totalRewardsIssued - rewardsInDistributor) / totalRewardsIssued) * 100)) : 0;

  const avgRewardPerUser = activeHolders > 0 ? (actualTotalSupply * weeklyReward) / activeHolders : 0;

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gradient-to-br from-gray-800/95 to-gray-900/95 border border-orange-500/30 p-4 rounded-xl shadow-2xl backdrop-blur-md">
          <p className="font-semibold text-orange-400 mb-2 text-sm uppercase tracking-wide">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-sm text-slate-300">{entry.name}:</span>
                </div>
                <span className="text-sm font-bold text-white">
                  {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Analytics</h2>
          <p className="text-gray-400 mt-1">Comprehensive protocol and earnings analytics</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────
          📊 MY EARNINGS OVERVIEW
          ──────────────────────────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-orange-900/20 to-yellow-900/20 border-orange-500/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Gift className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-2xl text-white">My Earnings Overview</CardTitle>
              <CardDescription className="text-gray-400">Your personal rewards and performance metrics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Earnings Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Lifetime Rewards */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Lifetime Rewards</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-400 break-all">${lifetimeRewards.toFixed(4)}</div>
                <div className="text-xs text-gray-500 mt-1">All-time earnings</div>
              </CardContent>
            </Card>

            {/* Claimed / Unclaimed */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Est. Claim Rate</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-400">{claimRate.toFixed(1)}%</div>
                <div className="text-xs text-gray-500 mt-1">Based on distributor</div>
              </CardContent>
            </Card>

            {/* This Week's Tier */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">This Week's Tier</div>
                <div className={`text-base sm:text-lg lg:text-xl font-bold ${currentTier.color} truncate`}>{currentTier.name}</div>
                <div className="text-xs text-gray-500 mt-1">{currentTier.reward} per token</div>
              </CardContent>
            </Card>

            {/* Avg Weekly Yield */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Est. Weekly Earnings</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-400 break-all">${estimatedWeeklyEarnings.toFixed(4)}</div>
                <div className="text-xs text-gray-500 mt-1">{annualizedYield.toFixed(2)}% APY</div>
              </CardContent>
            </Card>

            {/* Countdown to Next Distribution */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Next Distribution</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-400 break-words">{getTimeUntilDistribution()}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {canExecuteDistribution ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Ready</Badge>
                  ) : (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">Pending</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Reward Projection Chart */}
          <Card className="bg-gray-800/30 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Distribution Reward Projection</CardTitle>
              <CardDescription className="text-gray-400">Estimated earnings based on current tier and balance (7-hour cycle)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyRewardGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} opacity={0.3} />
                  <XAxis dataKey="week" stroke={CHART_COLORS.text} style={{ fontSize: '12px' }} />
                  <YAxis stroke={CHART_COLORS.text} style={{ fontSize: '12px' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="earned" fill={CHART_COLORS.primary} name="Projected Earnings ($)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────────────────
          🏦 PROTOCOL PERFORMANCE
          ──────────────────────────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border-blue-500/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-2xl text-white">Protocol Performance</CardTitle>
              <CardDescription className="text-gray-400">Overall system health and metrics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Protocol Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Collateral Ratio */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Collateral Ratio</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-400 break-all">{(collateralRatio * 100).toFixed(2)}%</div>
                <Progress value={Math.min(100, (collateralRatio / 2) * 100)} className="mt-2 h-2" />
              </CardContent>
            </Card>

            {/* Collateral Value */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Collateral Value</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-400 break-all">{formatCurrency(totalCollateralUSD, 0)}</div>
                <div className="text-xs text-gray-500 mt-1 truncate">{formatBTC(totalCollateralBTC, 4)}</div>
              </CardContent>
            </Card>

            {/* Total Supply */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Total Supply</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-cyan-400 break-all">{formatNumber(Math.floor(actualTotalSupply))}</div>
                <div className="text-xs text-gray-500 mt-1">BTC1 tokens</div>
              </CardContent>
            </Card>

            {/* Total Distributed */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Total Distributed</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-400 break-all">{formatNumber(Math.floor(totalDistributed))}</div>
                <div className="text-xs text-gray-500 mt-1">In rewards pool</div>
              </CardContent>
            </Card>
          </div>

          {/* Collateral Ratio Status Chart */}
          <Card className="bg-gray-800/30 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Collateral Ratio Status</CardTitle>
              <CardDescription className="text-gray-400">Current protocol health vs minimum threshold (historical data requires indexing)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={collateralRatioTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} opacity={0.3} />
                  <XAxis dataKey="date" stroke={CHART_COLORS.text} style={{ fontSize: '12px' }} />
                  <YAxis domain={[1.0, 2.5]} stroke={CHART_COLORS.text} style={{ fontSize: '12px' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="ratio" stroke={CHART_COLORS.primary} strokeWidth={3} name="Current Ratio" dot={{ r: 4 }} />
                  {/* Minimum threshold line */}
                  <Line type="monotone" dataKey={() => 1.1} stroke={CHART_COLORS.danger} strokeDasharray="5 5" strokeWidth={2} name="Minimum (110%)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────────────────
          🤲 ENDOWMENT & COMMUNITY IMPACT
          ──────────────────────────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-pink-900/20 to-rose-900/20 border-pink-500/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
              <Heart className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <CardTitle className="text-2xl text-white">Endowment & Community Impact</CardTitle>
              <CardDescription className="text-gray-400">Charitable giving and fee allocation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Endowment Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Donated */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Total Donated</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-pink-400 break-all">{formatNumber(Math.floor(endowmentWalletBalance))}</div>
                <div className="text-xs text-gray-500 mt-1">BTC1 to endowment</div>
              </CardContent>
            </Card>

            {/* % of Fees to Charity */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Fee Allocation</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-rose-400">0.1%</div>
                <div className="text-xs text-gray-500 mt-1">Of each mint to charity</div>
              </CardContent>
            </Card>

            {/* # of Beneficiaries (mock) */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Est. Beneficiaries</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-400">∞</div>
                <div className="text-xs text-gray-500 mt-1">Through endowment</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────────────────
          👥 PARTICIPATION METRICS
          ──────────────────────────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-purple-500/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-2xl text-white">Participation Metrics</CardTitle>
              <CardDescription className="text-gray-400">User engagement and activity statistics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Participation Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Holders */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Active Holders</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-400 break-all">{formatNumber(activeHolders)}</div>
                <div className="text-xs text-gray-500 mt-1">Real-time from Alchemy</div>
              </CardContent>
            </Card>

            {/* Claim Rate */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Est. Claim Rate</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-400">{claimRate.toFixed(1)}%</div>
                <Progress value={claimRate} className="mt-2 h-2" />
              </CardContent>
            </Card>

            {/* Distribution Count */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Total Distributions</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-400">{distributionCount ? Number(distributionCount) : 0}</div>
                <div className="text-xs text-gray-500 mt-1">Completed rounds</div>
              </CardContent>
            </Card>

            {/* Avg Reward per User */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-400 mb-2 truncate">Avg Reward/User</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-cyan-400 break-all">${avgRewardPerUser.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-1">Per distribution</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────────────────
          🛡️ SYSTEM INTEGRITY
          ──────────────────────────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border-emerald-500/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-2xl text-white">System Integrity</CardTitle>
              <CardDescription className="text-gray-400">Vault health and collateral composition</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Vault BTC Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vaultComposition.map((asset) => (
              <Card key={asset.name} className="bg-gray-800/50 border-gray-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-400 truncate">{asset.name} Balance</div>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color }}></div>
                  </div>
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white break-all">{formatBTC(asset.value, 4)}</div>
                  <div className="text-xs text-gray-500 mt-1 truncate">{asset.percentage.toFixed(2)}% of vault</div>
                  <Progress value={asset.percentage} className="mt-2 h-2" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Health Status */}
          <Card className="bg-gray-800/30 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">System Health Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Collateral Ratio</span>
                  <Badge className={collateralRatio >= 1.2 ? "bg-green-500/20 text-green-400" : collateralRatio >= 1.1 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}>
                    {collateralRatio >= 1.2 ? "Excellent" : collateralRatio >= 1.1 ? "Healthy" : "Critical"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Vault Diversification</span>
                  <Badge className="bg-blue-500/20 text-blue-400">
                    {vaultComposition.filter(a => a.value > 0).length} Asset Types
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Distribution Status</span>
                  <Badge className={canExecuteDistribution ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}>
                    {canExecuteDistribution ? "Ready" : "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Current Reward Tier</span>
                  <Badge className="bg-orange-500/20 text-orange-400">
                    {currentTier.name} - {currentTier.reward}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
