'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SwapWidget } from "thirdweb/react";
import { client as thirdwebClient } from "@/lib/thirdweb-client";
import { base } from "thirdweb/chains";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { ArrowLeftRight } from 'lucide-react';

interface SwapXModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SwapXModal({ isOpen, onClose }: SwapXModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="w-[95vw] sm:max-w-lg p-0 bg-gray-950 border-gray-800 overflow-hidden rounded-2xl sm:rounded-[32px] shadow-2xl z-[9999] max-h-[90vh] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 sm:p-8 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-4 text-white text-2xl sm:text-3xl font-bold">
            <div className="p-2 sm:p-3 bg-blue-600/20 rounded-2xl">
              <ArrowLeftRight className="h-6 w-6 sm:h-7 sm:w-7 text-blue-400" />
            </div>
            SwapX
          </DialogTitle>
          <p className="text-gray-400 text-sm sm:text-base mt-2">
            Cross-chain swap into BTC1 using thirdweb Bridge.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
          <SwapWidget
            client={thirdwebClient}
            theme="dark"
            toChain={base}
            toToken={CONTRACT_ADDRESSES.BTC1USD as `0x${string}`}
          />
        </div>

        <div className="p-4 sm:p-6 bg-gray-900/50 border-t border-gray-800 flex justify-center flex-shrink-0">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}