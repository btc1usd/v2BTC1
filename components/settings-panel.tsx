"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Bell,
  Shield,
  Zap,
  Info,
  Save,
  RotateCcw,
  Settings,
  TrendingUp,
  Coins,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react"
import type { ProtocolState } from "@/lib/protocol-math"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"
import BTC1USDTimelockManager from "@/components/btc1usd-timelock-manager"

interface SettingsPanelProps {
  isAdmin: boolean
  protocolState: ProtocolState
  onProtocolStateChange: (newState: ProtocolState) => void
}

export function SettingsPanel({ isAdmin, protocolState, onProtocolStateChange }: SettingsPanelProps) {
  const { address } = useAccount()
  const [emergencyCouncilStatus, setEmergencyCouncilStatus] = useState<string>("")
  const [isUpdatingCouncil, setIsUpdatingCouncil] = useState(false)

  // Contract write for setting emergency council
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract()
  
  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const [notifications, setNotifications] = useState({
    priceAlerts: true,
    distributionAlerts: true,
    governanceAlerts: true,
    securityAlerts: true,
    emailNotifications: false,
    pushNotifications: true,
  })

  const [preferences, setPreferences] = useState({
    theme: "dark",
    currency: "USD",
    language: "en",
    timezone: "UTC",
    refreshInterval: 5,
    chartType: "line",
  })

  // Comprehensive protocol parameter configuration
  const [protocolParameters, setProtocolParameters] = useState({
    // Core mathematical constants
    minCollateralRatio: 110,
    distributionMinRatio: 112,
    mintDevFee: 1.0,
    mintEndowmentFee: 0.1,
    redeemDevFee: 0.1,
    stressMultiplier: 90,

    // Distribution fees (in cents per token)
    merklFeePerToken: 0.03,
    endowmentFeePerToken: 0.01,
    devFeePerToken: 0.1,

    // Distribution reward tiers (in cents per token)
    tier1Reward: 1.0, // 112-121%
    tier2Reward: 2.0, // 122-131%
    tier3Reward: 3.0, // 132-141%
    tier4Reward: 4.0, // 142-151%
    tier5Reward: 5.0, // 152-161%
    tier6Reward: 6.0, // 162-171%
    tier7Reward: 7.0, // 172-181%
    tier8Reward: 8.0, // 182-191%
    tier9Reward: 9.0, // 192-201%
    maxReward: 10.0, // ≥202%
  })

  // Live protocol state configuration
  const [liveState, setLiveState] = useState<ProtocolState>(
    protocolState || {
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
        btc1usd: "0x0000000000000000000000000000000000000000",
        vault: "0x0000000000000000000000000000000000000000",
        priceOracle: "0x0000000000000000000000000000000000000000",
        weeklyDistribution: "0x0000000000000000000000000000000000000000",
        merkleDistributor: "0x0000000000000000000000000000000000000000",
        endowmentManager: "0x0000000000000000000000000000000000000000",
        protocolGovernance: "0x0000000000000000000000000000000000000000",
        wbtc: "0x0000000000000000000000000000000000000000",
        cbbtc: "0x0000000000000000000000000000000000000000",
        tbtc: "0x0000000000000000000000000000000000000000",
      },
    },
  )

  useEffect(() => {
    if (protocolState) {
      setLiveState(protocolState)
    }
  }, [protocolState])

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }))
  }

  const handlePreferenceChange = (key: string, value: any) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  const handleProtocolChange = (key: string, value: any) => {
    setProtocolParameters((prev) => ({ ...prev, [key]: value }))
  }

  const handleLiveStateChange = (key: keyof ProtocolState, value: any) => {
    if (!liveState) return

    const newState = { ...liveState, [key]: value }
    setLiveState(newState)
    if (onProtocolStateChange) {
      onProtocolStateChange(newState)
    }
  }

  const handleCollateralChange = (asset: "wbtc" | "cbbtc" | "tbtc", value: number) => {
    if (!liveState) return

    const newState = {
      ...liveState,
      collateralBalances: {
        ...liveState.collateralBalances,
        [asset]: value,
      },
    }
    setLiveState(newState)
    if (onProtocolStateChange) {
      onProtocolStateChange(newState)
    }
  }

  const handleParameterChange = (key: string, value: any) => {
    setProtocolParameters((prev) => ({ ...prev, [key]: value }))
  }

  const resetToDefaults = () => {
    const defaultState: ProtocolState = {
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
        btc1usd: "0x0000000000000000000000000000000000000000",
        vault: "0x0000000000000000000000000000000000000000",
        priceOracle: "0x0000000000000000000000000000000000000000",
        weeklyDistribution: "0x0000000000000000000000000000000000000000",
        merkleDistributor: "0x0000000000000000000000000000000000000000",
        endowmentManager: "0x0000000000000000000000000000000000000000",
        protocolGovernance: "0x0000000000000000000000000000000000000000",
        wbtc: "0x0000000000000000000000000000000000000000",
        cbbtc: "0x0000000000000000000000000000000000000000",
        tbtc: "0x0000000000000000000000000000000000000000",
      },
    }
    setLiveState(defaultState)
    onProtocolStateChange(defaultState)
  }

  const applyStressTest = (scenario: "crash" | "pump" | "volatility") => {
    if (!liveState?.btcPrice) return

    let newPrice = liveState.btcPrice
    switch (scenario) {
      case "crash":
        newPrice *= 0.7 // 30% crash
        break
      case "pump":
        newPrice *= 1.5 // 50% pump
        break
      case "volatility":
        newPrice *= 1 + (Math.random() - 0.5) * 0.1 // ±5% random
        break
    }
    handleLiveStateChange("btcPrice", newPrice)
  }

  // Handle setting emergency council to admin address
  const handleSetEmergencyCouncilToAdmin = async () => {
    if (!address || !isAdmin) {
      setEmergencyCouncilStatus("Error: You must be connected as admin")
      return
    }

    const ADMIN_ADDRESS = "0xA1D4de75082562eA776b160e605acD587668111B"
    if (address.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
      setEmergencyCouncilStatus("Error: Only admin can perform this action")
      return
    }

    try {
      setIsUpdatingCouncil(true)
      setEmergencyCouncilStatus("Preparing transaction...")

      writeContract({
        address: CONTRACT_ADDRESSES.PROTOCOL_GOVERNANCE as `0x${string}`,
        abi: [
          {
            inputs: [{ name: "newCouncil", type: "address" }],
            name: "setEmergencyCouncil",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "setEmergencyCouncil",
        args: [ADMIN_ADDRESS],
      })

      setEmergencyCouncilStatus("Transaction sent, waiting for confirmation...")
    } catch (err: any) {
      console.error("Error setting emergency council:", err)
      setEmergencyCouncilStatus(`Error: ${err.message || "Transaction failed"}`)
      setIsUpdatingCouncil(false)
    }
  }

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed) {
      setEmergencyCouncilStatus("✅ Emergency Council successfully set to admin address!")
      setIsUpdatingCouncil(false)
      setTimeout(() => setEmergencyCouncilStatus(""), 5000)
    }
    if (isError) {
      setEmergencyCouncilStatus(`❌ Transaction failed: ${error?.message || "Unknown error"}`)
      setIsUpdatingCouncil(false)
    }
  }, [isConfirmed, isError, error])

  return (
    <div className="space-y-6">
      {/* Settings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground flex items-center space-x-2">
              <DollarSign className="w-4 h-4" />
              <span>BTC Price</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">${(liveState?.btcPrice || 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Current price</div>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground flex items-center space-x-2">
              <Coins className="w-4 h-4" />
              <span>Total Supply</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">
              {((liveState?.totalSupply || 0) / 1000000).toFixed(2)}M
            </div>
            <div className="text-xs text-muted-foreground">BTC1USD tokens</div>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Collateral</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-3">
              {(
                (liveState?.collateralBalances?.wbtc || 0) +
                (liveState?.collateralBalances?.cbbtc || 0) +
                (liveState?.collateralBalances?.tbtc || 0)
              ).toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">Total BTC</div>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>Auto Refresh</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-4">{preferences.refreshInterval}s</div>
            <div className="text-xs text-muted-foreground">Update interval</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Settings Interface */}
      <Tabs defaultValue="notifications" className="w-full">
        <TabsList>
          <TabsTrigger value="live-config">Live Config</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="live-config" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-card-foreground flex items-center space-x-2">
                  <DollarSign className="w-5 h-5" />
                  <span>Market Configuration</span>
                </CardTitle>
                <CardDescription>Configure live market parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="btcPrice">BTC Price (USD)</Label>
                  <Input
                    id="btcPrice"
                    type="number"
                    value={liveState?.btcPrice || 0}
                    onChange={(e) => handleLiveStateChange("btcPrice", Number.parseFloat(e.target.value) || 0)}
                    className="bg-background/50"
                  />
                  <div className="text-xs text-muted-foreground">Current Bitcoin price in USD</div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalSupply">Total Supply</Label>
                  <Input
                    id="totalSupply"
                    type="number"
                    value={liveState?.totalSupply || 0}
                    onChange={(e) => handleLiveStateChange("totalSupply", Number.parseFloat(e.target.value) || 0)}
                    className="bg-background/50"
                  />
                  <div className="text-xs text-muted-foreground">Total BTC1USD tokens in circulation</div>
                </div>

                <div className="space-y-2">
                  <Label>Stress Test Scenarios</Label>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyStressTest("crash")}
                      className="bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
                    >
                      30% Crash
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyStressTest("pump")}
                      className="bg-green-500/10 hover:bg-green-500/20 border-green-500/20"
                    >
                      50% Pump
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyStressTest("volatility")}
                      className="bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/20"
                    >
                      Random ±5%
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-card-foreground flex items-center space-x-2">
                  <Coins className="w-5 h-5" />
                  <span>Collateral Configuration</span>
                </CardTitle>
                <CardDescription>Configure collateral asset balances</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wbtc">WBTC Balance</Label>
                  <Input
                    id="wbtc"
                    type="number"
                    step="0.01"
                    value={liveState?.collateralBalances?.wbtc || 0}
                    onChange={(e) => handleCollateralChange("wbtc", Number.parseFloat(e.target.value) || 0)}
                    className="bg-background/50"
                  />
                  <div className="text-xs text-muted-foreground">
                    Value: ${((liveState?.collateralBalances?.wbtc || 0) * (liveState?.btcPrice || 0)).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cbbtc">cbBTC Balance</Label>
                  <Input
                    id="cbbtc"
                    type="number"
                    step="0.01"
                    value={liveState?.collateralBalances?.cbbtc || 0}
                    onChange={(e) => handleCollateralChange("cbbtc", Number.parseFloat(e.target.value) || 0)}
                    className="bg-background/50"
                  />
                  <div className="text-xs text-muted-foreground">
                    Value: $
                    {((liveState?.collateralBalances?.cbbtc || 0) * (liveState?.btcPrice || 0)).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tbtc">tBTC Balance</Label>
                  <Input
                    id="tbtc"
                    type="number"
                    step="0.01"
                    value={liveState?.collateralBalances?.tbtc || 0}
                    onChange={(e) => handleCollateralChange("tbtc", Number.parseFloat(e.target.value) || 0)}
                    className="bg-background/50"
                  />
                  <div className="text-xs text-muted-foreground">
                    Value: ${((liveState?.collateralBalances?.tbtc || 0) * (liveState?.btcPrice || 0)).toLocaleString()}
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Total Collateral:{" "}
                    {(
                      (liveState?.collateralBalances?.wbtc || 0) +
                      (liveState?.collateralBalances?.cbbtc || 0) +
                      (liveState?.collateralBalances?.tbtc || 0)
                    ).toFixed(2)}{" "}
                    BTC ($
                    {(
                      ((liveState?.collateralBalances?.wbtc || 0) +
                        (liveState?.collateralBalances?.cbbtc || 0) +
                        (liveState?.collateralBalances?.tbtc || 0)) *
                      (liveState?.btcPrice || 0)
                    ).toLocaleString()}
                    )
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="parameters" className="space-y-4">
          {isAdmin ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-card-foreground flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>Core Protocol Parameters</span>
                  </CardTitle>
                  <CardDescription>Mathematical constants that govern protocol behavior</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Label>Minimum Collateral Ratio: {protocolParameters.minCollateralRatio}%</Label>
                    <Slider
                      value={[protocolParameters.minCollateralRatio]}
                      onValueChange={([value]) => handleParameterChange("minCollateralRatio", value)}
                      max={150}
                      min={105}
                      step={1}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground">Below this ratio, redemptions enter stress mode</div>
                  </div>

                  <div className="space-y-3">
                    <Label>Distribution Minimum Ratio: {protocolParameters.distributionMinRatio}%</Label>
                    <Slider
                      value={[protocolParameters.distributionMinRatio]}
                      onValueChange={([value]) => handleParameterChange("distributionMinRatio", value)}
                      max={150}
                      min={110}
                      step={1}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground">Minimum ratio required for weekly distributions</div>
                  </div>

                  <div className="space-y-3">
                    <Label>Stress Mode Multiplier: {protocolParameters.stressMultiplier}%</Label>
                    <Slider
                      value={[protocolParameters.stressMultiplier]}
                      onValueChange={([value]) => handleParameterChange("stressMultiplier", value)}
                      max={100}
                      min={70}
                      step={1}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground">Redemption value multiplier in stress mode</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-card-foreground">Fee Structure</CardTitle>
                  <CardDescription>Configure all protocol fees</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Label>Mint Dev Fee: {protocolParameters.mintDevFee}%</Label>
                    <Slider
                      value={[protocolParameters.mintDevFee]}
                      onValueChange={([value]) => handleParameterChange("mintDevFee", value)}
                      max={3}
                      min={0.1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Mint Endowment Fee: {protocolParameters.mintEndowmentFee}%</Label>
                    <Slider
                      value={[protocolParameters.mintEndowmentFee]}
                      onValueChange={([value]) => handleParameterChange("mintEndowmentFee", value)}
                      max={1}
                      min={0.01}
                      step={0.01}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Redeem Dev Fee: {protocolParameters.redeemDevFee}%</Label>
                    <Slider
                      value={[protocolParameters.redeemDevFee]}
                      onValueChange={([value]) => handleParameterChange("redeemDevFee", value)}
                      max={2}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Merkl Fee: {protocolParameters.merklFeePerToken}¢ per token</Label>
                    <Slider
                      value={[protocolParameters.merklFeePerToken]}
                      onValueChange={([value]) => handleParameterChange("merklFeePerToken", value)}
                      max={0.1}
                      min={0.01}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card border-border/50 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-card-foreground">Distribution Reward Tiers</CardTitle>
                  <CardDescription>
                    Configure reward amounts for each collateral ratio tier (cents per token)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Tier 1 (112-121%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={protocolParameters.tier1Reward}
                        onChange={(e) => handleParameterChange("tier1Reward", Number.parseFloat(e.target.value) || 0)}
                        className="bg-background/50 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tier 2 (122-131%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={protocolParameters.tier2Reward}
                        onChange={(e) => handleParameterChange("tier2Reward", Number.parseFloat(e.target.value) || 0)}
                        className="bg-background/50 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tier 3 (132-141%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={protocolParameters.tier3Reward}
                        onChange={(e) => handleParameterChange("tier3Reward", Number.parseFloat(e.target.value) || 0)}
                        className="bg-background/50 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tier 4 (142-151%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={protocolParameters.tier4Reward}
                        onChange={(e) => handleParameterChange("tier4Reward", Number.parseFloat(e.target.value) || 0)}
                        className="bg-background/50 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tier 5 (152-161%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={protocolParameters.tier5Reward}
                        onChange={(e) => handleParameterChange("tier5Reward", Number.parseFloat(e.target.value) || 0)}
                        className="bg-background/50 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tier 6 (162-171%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={protocolParameters.tier6Reward}
                        onChange={(e) => handleParameterChange("tier6Reward", Number.parseFloat(e.target.value) || 0)}
                        className="bg-background/50 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tier 7 (172-181%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={protocolParameters.tier7Reward}
                        onChange={(e) => handleParameterChange("tier7Reward", Number.parseFloat(e.target.value) || 0)}
                        className="bg-background/50 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tier 8 (182-191%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={protocolParameters.tier8Reward}
                        onChange={(e) => handleParameterChange("tier8Reward", Number.parseFloat(e.target.value) || 0)}
                        className="bg-background/50 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tier 9 (192-201%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={protocolParameters.tier9Reward}
                        onChange={(e) => handleParameterChange("tier9Reward", Number.parseFloat(e.target.value) || 0)}
                        className="bg-background/50 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Max (≥202%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={protocolParameters.maxReward}
                        onChange={(e) => handleParameterChange("maxReward", Number.parseFloat(e.target.value) || 0)}
                        className="bg-background/50 text-xs"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-card-foreground">Protocol Parameters</CardTitle>
                <CardDescription>View current protocol parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Protocol parameters can only be modified by administrators through governance proposals.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Notification Settings</span>
              </CardTitle>
              <CardDescription>Configure when and how you receive alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-card-foreground">Price Alerts</Label>
                    <div className="text-sm text-muted-foreground">
                      Get notified when BTC price changes significantly
                    </div>
                  </div>
                  <Switch
                    checked={notifications.priceAlerts}
                    onCheckedChange={(value) => handleNotificationChange("priceAlerts", value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-card-foreground">Distribution Alerts</Label>
                    <div className="text-sm text-muted-foreground">Notifications for weekly distribution events</div>
                  </div>
                  <Switch
                    checked={notifications.distributionAlerts}
                    onCheckedChange={(value) => handleNotificationChange("distributionAlerts", value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-card-foreground">Governance Alerts</Label>
                    <div className="text-sm text-muted-foreground">New proposals and voting reminders</div>
                  </div>
                  <Switch
                    checked={notifications.governanceAlerts}
                    onCheckedChange={(value) => handleNotificationChange("governanceAlerts", value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-card-foreground">Security Alerts</Label>
                    <div className="text-sm text-muted-foreground">Critical security events and system status</div>
                  </div>
                  <Switch
                    checked={notifications.securityAlerts}
                    onCheckedChange={(value) => handleNotificationChange("securityAlerts", value)}
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-card-foreground mb-4">Delivery Methods</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-card-foreground">Email Notifications</Label>
                      <div className="text-sm text-muted-foreground">Receive alerts via email</div>
                    </div>
                    <Switch
                      checked={notifications.emailNotifications}
                      onCheckedChange={(value) => handleNotificationChange("emailNotifications", value)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-card-foreground">Push Notifications</Label>
                      <div className="text-sm text-muted-foreground">Browser push notifications</div>
                    </div>
                    <Switch
                      checked={notifications.pushNotifications}
                      onCheckedChange={(value) => handleNotificationChange("pushNotifications", value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-card-foreground">Display Preferences</CardTitle>
                <CardDescription>Customize the appearance and behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={preferences.theme} onValueChange={(value) => handlePreferenceChange("theme", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Display Currency</Label>
                  <Select
                    value={preferences.currency}
                    onValueChange={(value) => handlePreferenceChange("currency", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="BTC">BTC (₿)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chartType">Chart Type</Label>
                  <Select
                    value={preferences.chartType}
                    onValueChange={(value) => handlePreferenceChange("chartType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line Chart</SelectItem>
                      <SelectItem value="area">Area Chart</SelectItem>
                      <SelectItem value="candlestick">Candlestick</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-card-foreground">System Preferences</CardTitle>
                <CardDescription>Configure system behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={preferences.language}
                    onValueChange={(value) => handlePreferenceChange("language", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={preferences.timezone}
                    onValueChange={(value) => handlePreferenceChange("timezone", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="EST">Eastern Time</SelectItem>
                      <SelectItem value="PST">Pacific Time</SelectItem>
                      <SelectItem value="GMT">Greenwich Mean Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Auto Refresh Interval: {preferences.refreshInterval}s</Label>
                  <Slider
                    value={[preferences.refreshInterval]}
                    onValueChange={([value]) => handlePreferenceChange("refreshInterval", value)}
                    max={30}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground">How often to refresh data automatically</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          {/* BTC1USD Timelock Manager - Admin Only */}
          {isAdmin && (
            <div className="mb-6">
              <BTC1USDTimelockManager />
            </div>
          )}

          {/* Admin Security Controls */}
          {isAdmin && (
            <Card className="gradient-card border-orange-500/20 border-2">
              <CardHeader>
                <CardTitle className="text-card-foreground flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-orange-500" />
                  <span>Admin Security Controls</span>
                </CardTitle>
                <CardDescription>Emergency admin functions for protocol security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-orange-500/30 bg-orange-500/10">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <AlertDescription className="text-sm">
                    <strong>Emergency Council Status:</strong> The Emergency Council can pause the protocol in case of security threats.
                    It is currently set to the deployer address. For maximum security, set it to the admin address.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-card-foreground font-semibold">Set Emergency Council to Admin</Label>
                      <div className="text-sm text-muted-foreground">
                        Update Emergency Council to admin address (0x6210FfE7...6ee835)
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        This ensures only the admin can use emergency pause functions
                      </div>
                    </div>
                    <Button
                      onClick={handleSetEmergencyCouncilToAdmin}
                      disabled={isUpdatingCouncil || isPending || isConfirming}
                      className="bg-orange-500 hover:bg-orange-600 text-white min-w-[200px]"
                    >
                      {(isPending || isConfirming) ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {isPending ? "Confirm in Wallet..." : "Confirming..."}
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-2" />
                          Set Emergency Council
                        </>
                      )}
                    </Button>
                  </div>

                  {emergencyCouncilStatus && (
                    <Alert className={emergencyCouncilStatus.includes("✅") ? "border-green-500/30 bg-green-500/10" : emergencyCouncilStatus.includes("❌") ? "border-red-500/30 bg-red-500/10" : "border-blue-500/30 bg-blue-500/10"}>
                      {emergencyCouncilStatus.includes("✅") ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : emergencyCouncilStatus.includes("❌") ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Info className="h-4 w-4 text-blue-500" />
                      )}
                      <AlertDescription className="text-sm">
                        {emergencyCouncilStatus}
                      </AlertDescription>
                    </Alert>
                  )}

                  {hash && (
                    <div className="text-xs text-muted-foreground">
                      Transaction: 
                      <a
                        href={`https://basescan.org/tx/${hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-500 hover:text-orange-400 ml-1 underline"
                      >
                        View on BaseScan
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-card-foreground flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Security Settings</span>
              </CardTitle>
              <CardDescription>Configure security and privacy options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-card-foreground">Two-Factor Authentication</Label>
                    <div className="text-sm text-muted-foreground">Add an extra layer of security to your account</div>
                  </div>
                  <Button variant="outline" size="sm">
                    Enable 2FA
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-card-foreground">Session Timeout</Label>
                    <div className="text-sm text-muted-foreground">Automatically log out after inactivity</div>
                  </div>
                  <Select defaultValue="30">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-card-foreground">Privacy Mode</Label>
                    <div className="text-sm text-muted-foreground">Hide sensitive information in screenshots</div>
                  </div>
                  <Switch defaultChecked={false} />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-card-foreground mb-4">Data & Privacy</h4>
                <div className="space-y-4">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    Download My Data
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600 hover:text-red-700 bg-transparent"
                  >
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <div className="flex space-x-2">
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Protocol State
          </Button>
          {isAdmin && (
            <Button variant="outline" className="text-yellow-600 hover:text-yellow-700 bg-transparent">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Export Config
            </Button>
          )}
        </div>
        <Button className="gradient-primary">
          <Save className="w-4 h-4 mr-2" />
          Save All Settings
        </Button>
      </div>
    </div>
  )
}
