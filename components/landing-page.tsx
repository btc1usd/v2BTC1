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

export function LandingPage() {
  const { isConnected } = useWeb3()
  const [showWalletOptions, setShowWalletOptions] = useState(false)

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
      description: "Earn rewards from protocol fees and donations (7-day distribution cycle)"
    },
    {
      icon: <Users className="h-8 w-8 text-orange-500" />,
      title: "Community Governed",
      description: "Decentralized governance with community voting"
    }
  ]

  const stats = [
    { value: "$1.2M", label: "Total Value Locked" },
    { value: "4.8%", label: "Avg. Per-Dist Yield" },
    { value: "1,250+", label: "Holders" },
    { value: "99.9%", label: "Uptime" }
  ]

  if (isConnected) {
    return null // This will be handled in the page.tsx
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50">
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
            <div className="relative bg-white p-4 rounded-full">
              <Bitcoin className="h-16 w-16 text-orange-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              BTC1USD <span className="text-orange-500">Protocol</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
              Shariah-compliant Bitcoin-backed stable asset management with yield generation
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
              onClick={() => setShowWalletOptions(true)}
            >
              <Wallet className="mr-2 h-5 w-5" />
              Connect Wallet
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="px-8 py-6 text-lg border-2"
              onClick={() => window.open("https://docs.btc1usd.com", "_blank")}
            >
              <ExternalLink className="mr-2 h-5 w-5" />
              View Documentation
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Wallet Connection Dialog */}
      {showWalletOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md"
          >
            <Card className="border-0 shadow-none">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">Connect Wallet</CardTitle>
                <CardDescription>
                  Connect with MetaMask to access BTC1USD Protocol
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <WagmiWalletConnect />
              </CardContent>
              <CardFooter className="flex justify-center">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowWalletOptions(false)}
                  className="text-gray-500"
                >
                  Cancel
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Choose BTC1USD?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            The most trusted Shariah-compliant Bitcoin-backed stable asset protocol
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-orange-500 mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Simple steps to participate in the BTC1USD ecosystem
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: 1,
              title: "Connect Wallet",
              description: "Connect your MetaMask wallet to access the protocol dashboard"
            },
            {
              step: 2,
              title: "Mint BTC1USD",
              description: "Deposit Bitcoin-backed collateral to mint BTC1USD tokens"
            },
            {
              step: 3,
              title: "Earn Rewards",
              description: "Earn yield from protocol fees and donations (weekly distributions)"
            }
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
            >
              <Card className="text-center h-full">
                <CardHeader>
                  <div className="mx-auto bg-orange-100 text-orange-500 rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold mb-4">
                    {item.step}
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{item.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
              Join thousands of users earning yield with Shariah-compliant Bitcoin-backed assets
            </p>
            <Button 
              size="lg" 
              className="bg-white text-orange-500 hover:bg-orange-50 px-8 py-6 text-lg"
              onClick={() => setShowWalletOptions(true)}
            >
              <Wallet className="mr-2 h-5 w-5" />
              Connect with MetaMask
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}