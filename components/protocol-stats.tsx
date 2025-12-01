"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { formatPercentage } from "@/lib/protocol-math"

interface ProtocolStatsProps {
  btcPrice: number
  collateralRatio: number
  totalSupply: number
  totalCollateralValue: number
  weeklyRewards: number
  priceChange24h: number
}

export function ProtocolStats({
  btcPrice,
  collateralRatio,
  totalSupply,
  totalCollateralValue,
  weeklyRewards,
  priceChange24h,
}: ProtocolStatsProps) {
  const getHealthStatus = (ratio: number) => {
    if (ratio >= 1.2) return { status: "Excellent", color: "bg-green-500", variant: "default" as const }
    if (ratio >= 1.15) return { status: "Good", color: "bg-blue-500", variant: "secondary" as const }
    if (ratio >= 1.1) return { status: "Healthy", color: "bg-yellow-500", variant: "outline" as const }
    return { status: "Stressed", color: "bg-red-500", variant: "destructive" as const }
  }

  const healthStatus = getHealthStatus(collateralRatio)

  const getPriceChangeIcon = () => {
    if (priceChange24h > 0) return <TrendingUp className="h-3 w-3 text-green-500" />
    if (priceChange24h < 0) return <TrendingDown className="h-3 w-3 text-red-500" />
    return <Minus className="h-3 w-3 text-gray-500" />
  }

  const getPriceChangeColor = () => {
    if (priceChange24h > 0) return "text-green-600"
    if (priceChange24h < 0) return "text-red-600"
    return "text-gray-600"
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Bitcoin Price</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${btcPrice.toLocaleString()}</div>
          <div className={`flex items-center text-sm ${getPriceChangeColor()}`}>
            {getPriceChangeIcon()}
            <span className="ml-1">
              {priceChange24h > 0 ? "+" : ""}
              {priceChange24h.toFixed(2)}% (24h)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Collateral Ratio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPercentage(collateralRatio, 1)}</div>
          <div className="flex items-center justify-between mt-2">
            <Badge variant={healthStatus.variant} className="text-xs">
              {healthStatus.status}
            </Badge>
            <Progress value={Math.min((collateralRatio - 1) * 500, 100)} className="w-16 h-2" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Supply</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalSupply.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">BTC1 tokens</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Distribution Rewards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{weeklyRewards}¢</div>
          <div className="text-sm text-muted-foreground">Per token (weekly)</div>
        </CardContent>
      </Card>
    </div>
  )
}
