"use client";

import { useState, useEffect } from "react";
import { useConnect, useAccount } from "wagmi";
import { useConnect as useThirdwebConnect, useActiveAccount, useConnectModal } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { client as thirdwebClient } from "@/lib/thirdweb-client";
import { baseSepolia, base } from "thirdweb/chains";
import { NETWORK_CONFIG } from "@/lib/contracts";
import { useWeb3 } from "../lib/web3-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Wallet,
  Smartphone,
  ChevronRight,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface WalletOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  gradient: string;
  recommended?: boolean;
}

const walletOptions: WalletOption[] = [
  {
    id: "thirdweb",
    name: "Thirdweb",
    icon: (
      <div className="w-8 h-8 flex items-center justify-center">
        <img 
          src="/thirweb-logo.png" 
          alt="Thirdweb" 
          className="w-8 h-8 object-contain" 
        />
      </div>
    ),
    description: "Email, Social, or Cross-chain Wallet",
    gradient: "from-purple-500/20 to-pink-500/20",
    recommended: true,
  },
  {
    id: "io.metamask",
    name: "MetaMask",
    icon: <Wallet className="w-8 h-8" />,
    description: "Most popular browser extension wallet",
    gradient: "from-orange-500/20 to-yellow-500/20",
    recommended: true,
  },
  {
    id: "walletConnect",
    name: "WalletConnect",
    icon: <Smartphone className="w-8 h-8" />,
    description: "Scan with your mobile wallet app",
    gradient: "from-blue-500/20 to-cyan-500/20",
  },
  {
    id: "coinbaseWalletSDK",
    name: "Coinbase Wallet",
    icon: (
      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
        CB
      </div>
    ),
    description: "Connect with Coinbase Wallet",
    gradient: "from-blue-600/20 to-indigo-600/20",
  },
];

interface WalletSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletSelectionModal({
  open,
  onOpenChange,
}: WalletSelectionModalProps) {
  const { connect, connectors, error: connectError } = useConnect();
  const { connect: connectThirdweb } = useThirdwebConnect();
  const { connect: openThirdwebModal } = useConnectModal();
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Helper function to find connector by wallet option ID
  const findConnector = (walletId: string) => {
    if (walletId === "io.metamask") {
      // MetaMask can be either "injected" or "io.metamask"
      return connectors.find(
        (c) =>
          c.id === "injected" ||
          c.id === "io.metamask" ||
          c.name.toLowerCase().includes("metamask")
      );
    }
    // For WalletConnect, match by ID
    if (walletId === "walletConnect") {
      return connectors.find((c) => c.id === "walletConnect");
    }
    return connectors.find((c) => c.id === walletId);
  };

  // Check if WalletConnect is available
  const isWalletConnectAvailable = () => {
    return connectors.some((c) => c.id === "walletConnect");
  };

  const handleConnect = async (connectorId: string) => {
    try {
      setConnectingWallet(connectorId);
      setError(null);

      if (connectorId === "thirdweb") {
        try {
          // Open Thirdweb's full connection modal with all supported options
          // Use environment-specific chain
          const activeChain = NETWORK_CONFIG.chainId === 84532 ? baseSepolia : base;
          
          await openThirdwebModal({
            client: thirdwebClient,
            theme: "dark",
            chain: activeChain,
            wallets: [
              inAppWallet({
                auth: {
                  options: ["google", "facebook", "apple", "email", "phone", "passkey"],
                },
              }),
              createWallet("io.metamask"),
              createWallet("com.coinbase.wallet"),
              createWallet("me.rainbow"),
              createWallet("io.rabby"),
              createWallet("org.uniswap"),
            ],
          });
        } catch (err) {
          console.error("Thirdweb modal error:", err);
          setError("Failed to open connection modal");
        }
        return;
      }

      const connector = findConnector(connectorId);

      if (!connector) {
        setError(`Wallet not available`);
        return;
      }

      // Connect with persistence options
      await connect({
        connector,
        // Ensure connection is persisted
        chainId: undefined,
      });
    } catch (error) {
      console.error("Wallet connection error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to connect wallet"
      );
    } finally {
      setConnectingWallet(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700/50 text-white shadow-2xl overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-blue-500/5 animate-pulse" />

        {/* Glowing orbs */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />

        <div className="relative z-10">
          <DialogHeader className="space-y-3 pb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/50"
            >
              <Wallet className="w-8 h-8 text-white" />
            </motion.div>

            <DialogTitle className="text-3xl font-bold text-center bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Connect Wallet
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-center text-base">
              Choose how you want to connect to BTC1USD Protocol
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-6">
            <AnimatePresence>
              {walletOptions.map((wallet, index) => {
                const connector = wallet.id === "thirdweb" ? { id: "thirdweb" } : findConnector(wallet.id);
                const isConnecting = connectingWallet === wallet.id;
                const isAvailable = !!connector;

                return (
                  <motion.div
                    key={wallet.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card
                      className={`group relative overflow-hidden transition-all duration-300 ${
                        isAvailable
                          ? "bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/10 cursor-pointer hover:-translate-y-1"
                          : "bg-gray-800/20 border-gray-700/30 opacity-40 cursor-not-allowed"
                      }`}
                      onClick={() =>
                        isAvailable && !isConnecting && handleConnect(wallet.id)
                      }
                    >
                      {/* Gradient overlay */}
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${wallet.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                      />

                      {/* Recommended badge */}
                      {wallet.recommended && isAvailable && (
                        <div className="absolute top-3 right-3">
                          <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 border border-orange-500/50 rounded-full text-xs text-orange-400">
                            <Sparkles className="w-3 h-3" />
                            <span>Popular</span>
                          </div>
                        </div>
                      )}

                      <div className="relative flex items-center gap-4 p-5">
                        {/* Icon */}
                        <div
                          className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${
                            isAvailable
                              ? "bg-gray-700/50 group-hover:bg-gray-700 text-orange-500"
                              : "bg-gray-800/30 text-gray-600"
                          } transition-all duration-300`}
                        >
                          {wallet.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white text-lg group-hover:text-orange-400 transition-colors">
                            {wallet.name}
                          </h3>
                          <p className="text-sm text-gray-400 mt-0.5">
                            {wallet.description}
                          </p>
                        </div>

                        {/* Status */}
                        <div className="flex-shrink-0">
                          {isConnecting ? (
                            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                          ) : isAvailable ? (
                            <ChevronRight className="h-6 w-6 text-gray-500 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                          ) : (
                            <span className="text-xs text-gray-600">
                              Unavailable
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom shine effect */}
                      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Error Message */}
          {(error || connectError) && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-sm text-red-400">
                {error || connectError?.message}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="pt-6 border-t border-gray-700/50">
            <div className="text-center space-y-3">
              <p className="text-xs text-gray-500">
                By connecting, you agree to our{" "}
                <a
                  href="#"
                  className="text-orange-500 hover:text-orange-400 transition-colors underline"
                >
                  Terms of Service
                </a>
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Secure connection via Web3</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
