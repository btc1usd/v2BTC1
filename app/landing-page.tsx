"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Wallet, 
  Bitcoin, 
  Shield, 
  TrendingUp, 
  Users, 
  Coins,
  ChevronRight,
  ExternalLink,
  CheckCircle
} from "lucide-react"
import { useWeb3 } from "@/lib/web3-provider"
import { motion } from "framer-motion"
import { WagmiWalletConnect } from "@/components/wagmi-wallet-connect"
import { ThemeToggle } from "@/components/theme-toggle"
import { useLandingStats } from "@/hooks/use-landing-stats"

export function LandingPage() {
  const { isConnected, setModalOpen } = useWeb3()
  const { 
    totalSupply, 
    btcReserves, 
    collateralRatio, 
    rewardPeriod, 
    totalHolders, 
    loading 
  } = useLandingStats()

  const features = [
    {
      icon: <Bitcoin className="h-8 w-8 text-orange-500" />,
      title: "Bitcoin-Backed",
      description: "100% backed by Bitcoin reserves with Shariah compliance"
    },
    {
      icon: <Shield className="h-8 w-8 text-orange-500" />,
      title: "Secure & Audited",
      description: "Enterprise-grade security with regular third-party audits"
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-orange-500" />,
      title: "Yield Generation",
      description: "Earn weekly rewards from protocol fees and donations"
    },
    {
      icon: <Users className="h-8 w-8 text-orange-500" />,
      title: "Community Governed",
      description: "Decentralized governance with community voting"
    }
  ]

  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K'
    }
    return num.toFixed(2)
  }

  const stats = [
    { value: loading ? "..." : formatNumber(totalSupply), label: "Circulating Supply in BTC1" },
    { value: loading ? "..." : formatNumber(btcReserves), label: "BTC reserves value in USD" },
    { value: loading ? "..." : collateralRatio.toFixed(2), label: "Real-time collateral ratio (R)" },
    { value: rewardPeriod.toString(), label: "Rewards Distribution Period in Days" }
  ]

  if (isConnected) {
    return null // This will be handled in the page.tsx
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-muted/50">
      {/* Theme Toggle - Fixed position */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="flex flex-col items-center text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-orange-500 rounded-full blur opacity-20"></div>
            <div className="relative bg-card p-4 rounded-full border border-border">
              {/* BTC1USD transparent logo */}
              <img
                src="/btc1usd-logo-transparent.png"
                alt="BTC1USD Protocol Logo"
                className="h-24 w-24 object-contain"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
              BTC1 <span className="text-orange-500"></span>
            </h1>
            <p className="text-xl md:text-2xl text-foreground/80 max-w-3xl mx-auto">
              Bitcoin-backed Coin with built-in Profit Sharing & Charity
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Button 
              size="lg" 
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-6 text-lg"
              onClick={() => setModalOpen(true)}
            >
              <Wallet className="mr-2 h-5 w-5" />
              Connect Wallet
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="px-8 py-6 text-lg"
              onClick={() => window.open("https://docs.btc1usd.com", "_blank")}
            >
              <ExternalLink className="mr-2 h-5 w-5" />
              View Documentation
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Wallet Connection Modal is now managed globally in Web3Provider */}

      {/* Stats Section - Moved to be above "How It Works" */}
      <div className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                className="text-center"
              >
                {/* Simplified stat display without image-based rendering */}
                <div className="p-4">
                  <div className="text-5xl md:text-6xl font-bold text-orange-500 mb-2">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground text-sm md:text-base">
                    {stat.label}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works - Beautiful Infographic */}
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Get started in 4 simple steps: Connect, Deposit, Mint, and Earn rewards
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 relative">
          {[
            {
              step: 1,
              title: "Connect Wallet",
              description: "Link your Web3 wallet (MetaMask, WalletConnect, or Coinbase Wallet) to get started",
              icon: <Wallet className="w-12 h-12" />,
              color: "from-orange-500 to-orange-600",
              bgColor: "bg-orange-500/10",
              borderColor: "border-orange-500/20"
            },
            {
              step: 2,
              title: "Deposit Collateral",
              description: "Deposit Bitcoin-backed tokens (WBTC, cbBTC, tBTC) with minimum 110% collateral ratio",
              icon: <Coins className="w-12 h-12" />,
              color: "from-yellow-500 to-yellow-600",
              bgColor: "bg-yellow-500/10",
              borderColor: "border-yellow-500/20"
            },
            {
              step: 3,
              title: "Get BTC1",
              description: "Mint Shariah-compliant BTC1 coins backed by your Bitcoin collateral",
              icon: <Bitcoin className="w-12 h-12" />,
              color: "from-blue-500 to-blue-600",
              bgColor: "bg-blue-500/10",
              borderColor: "border-blue-500/20"
            },
            {
              step: 4,
              title: "Earn Rewards",
              description: "Hold BTC1 and receive weekly rewards from protocol fees and endowment distributions",
              icon: <TrendingUp className="w-12 h-12" />,
              color: "from-green-500 to-green-600",
              bgColor: "bg-green-500/10",
              borderColor: "border-green-500/20"
            }
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + index * 0.15 }}
              className="relative"
            >
              {/* Connection indicator for desktop - subtle dots */}
              {index < 3 && (
                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20"></div>
                  <div className="w-1 h-1 rounded-full bg-muted-foreground/10"></div>
                </div>
              )}

              {/* Vertical connection line for mobile */}
              {index < 3 && (
                <div className="lg:hidden absolute left-1/2 bottom-0 w-0.5 h-6 bg-gradient-to-b from-muted-foreground/20 to-transparent -translate-x-1/2 translate-y-full"></div>
              )}

              <Card className="relative overflow-hidden bg-card border-border hover:border-opacity-50 hover:shadow-2xl transition-all duration-300 h-full group">
                {/* Subtle background gradient on hover */}
                <div className={`absolute inset-0 ${item.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

                <CardContent className="relative p-6 flex flex-col items-center text-center space-y-4">
                  {/* Step number badge - cleaner design */}
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${item.color} flex items-center justify-center text-white font-bold text-lg shadow-lg mb-2`}>
                      {item.step}
                    </div>
                    {/* Connecting line from number to icon */}
                    <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-4 bg-gradient-to-b from-muted-foreground/20 to-transparent"></div>
                  </div>

                  {/* Icon with enhanced styling */}
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                    {item.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-foreground mt-2">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Why Choose BTC1?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The most trusted Shariah-compliant Bitcoin-backed stable asset protocol
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow bg-card border-border">
                <CardHeader>
                  <div className="mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        >
          <Card className="bg-card border-border shadow-xl">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of users earning yield with Shariah-compliant Bitcoin-backed assets
              </p>
              <Button
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-6 text-lg shadow-lg shadow-orange-500/30"
                onClick={() => setModalOpen(true)}
              >
                <Wallet className="mr-2 h-5 w-5" />
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}