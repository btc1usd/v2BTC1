"use client";

import { useAccount, useDisconnect, useWatchBlocks, useBalance } from "wagmi";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WalletSelectionModal } from "./wallet-selection-modal";
import { useWeb3 } from "@/lib/web3-provider";

interface WagmiWalletConnectProps {
  showModal?: boolean;
  onModalChange?: (show: boolean) => void;
}

export function WagmiWalletConnect({
  showModal,
  onModalChange,
}: WagmiWalletConnectProps = {}) {
  const [mounted, setMounted] = useState(false);
  const [internalShowModal, setInternalShowModal] = useState(false);

  // Use external modal state if provided, otherwise use internal state
  const modalOpen = showModal !== undefined ? showModal : internalShowModal;
  const setModalOpen = onModalChange || setInternalShowModal;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch - don't render wagmi hooks during SSR
  if (!mounted) {
    // If modal is controlled externally, show loading button
    if (showModal !== undefined) {
      return null;
    }

    return (
      <Button
        className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-6 rounded-lg opacity-50 cursor-not-allowed"
        disabled
      >
        <Wallet className="mr-2 h-4 w-4" />
        Loading...
      </Button>
    );
  }

  return (
    <WagmiWalletConnectInner
      showModal={showModal}
      onModalChange={onModalChange}
    />
  );
}

function WagmiWalletConnectInner({
  showModal,
  onModalChange,
}: WagmiWalletConnectProps) {
  const { address, isConnected, chainId, disconnectWallet } = useWeb3();
  const { status } = useAccount();
  const { data: balance } = useBalance({
    address: address,
  });
  const { toast } = useToast();
  const [internalShowModal, setInternalShowModal] = useState(false);

  // Use external modal state if provided, otherwise use internal state
  const modalOpen = showModal !== undefined ? showModal : internalShowModal;
  const setModalOpen = onModalChange || setInternalShowModal;

  // Log account changes for debugging
  useEffect(() => {
    if (status === "connected" && address) {
      console.log("Account connected/changed:", address);
    }
  }, [address, status]);

  // Watch for new blocks to trigger UI updates
  useWatchBlocks({
    onBlock() {
      // This will trigger re-renders when new blocks are mined
      // Useful for updating UI when transactions are confirmed
    },
  });

  const handleDisconnect = () => {
    try {
      disconnectWallet();
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      });
    }
  };

  const openInExplorer = () => {
    if (address) {
      // Using Base Mainnet explorer
      window.open(`https://basescan.org/address/${address}`, "_blank");
    }
  };

  // If modal is controlled externally, only render the modal (not the wallet card)
  if (showModal !== undefined) {
    return (
      <WalletSelectionModal open={modalOpen} onOpenChange={setModalOpen} />
    );
  }

  // For standalone mode: show wallet card when connected
  if (isConnected && address) {
    return (
      <Card className="w-full max-w-sm bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className="font-mono text-xs bg-orange-500 text-white"
              >
                {address.slice(0, 6)}...{address.slice(-4)}
              </Badge>
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openInExplorer}
                  className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {balance && (
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {parseFloat(
                    formatUnits(balance.value, balance.decimals)
                  ).toFixed(4)}{" "}
                  {balance.symbol}
                </div>
                <div className="text-sm text-gray-400">Wallet Balance</div>
              </div>
            )}

            {chainId && (
              <div className="text-center">
                <Badge
                  variant="outline"
                  className="text-xs text-gray-300 border-gray-600"
                >
                  Chain ID: {chainId}
                </Badge>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="w-full bg-transparent border-orange-500 text-orange-500 hover:bg-orange-500/10"
            >
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Otherwise render both button and modal
  return (
    <>
      <Button
        onClick={() => setModalOpen(true)}
        className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
      >
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet
      </Button>

      <WalletSelectionModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}