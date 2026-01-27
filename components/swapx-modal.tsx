'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SwapWidget } from "thirdweb/react";
import { client as thirdwebClient } from "@/lib/thirdweb-client";
import { ArrowLeftRight } from 'lucide-react';

interface SwapXModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SwapXModal({ isOpen, onClose }: SwapXModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal={false}>
      <DialogContent 
        className="fixed inset-0 w-screen h-screen sm:w-[520px] sm:h-[95vh] p-0 bg-gray-950 border-0 sm:border border-gray-800 rounded-none sm:rounded-[32px] shadow-2xl flex flex-col z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* HEADER */}
        <DialogHeader className="p-4 sm:p-6 md:p-8 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 text-white text-xl sm:text-2xl font-bold">
            <div className="p-2 bg-blue-600/20 rounded-xl">
              <ArrowLeftRight className="h-6 w-6 text-blue-400" />
            </div>
            SwapX
          </DialogTitle>
          <p className="text-gray-400 text-sm mt-2">
            Cross-chain swap into BTC1 using thirdweb Bridge.
          </p>
        </DialogHeader>

        {/* SCROLL BODY */}
        <div className="flex-1 w-full h-full force-scroll">
          <div className="min-w-[420px] min-h-[640px] p-3">
            <SwapWidget
              client={thirdwebClient}
              theme="dark"
              prefill={{
                buyToken: {
                  chainId: 8453,
                  tokenAddress: "0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5",
                },
                sellToken: {
                  tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                  chainId: 8453,
                },
              }}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-gray-900/50 border-t border-gray-800 flex justify-center flex-shrink-0">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm font-medium transition-colors px-4 py-2 rounded-lg hover:bg-gray-800/50"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
