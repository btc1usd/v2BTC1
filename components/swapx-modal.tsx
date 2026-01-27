'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal={false}>
      <DialogContent
        className="
          fixed inset-0 z-50 flex flex-col
          h-[100dvh] w-[100dvw]
          sm:h-[95vh] sm:w-[95vw]
          sm:max-w-2xl
          sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
          bg-gray-950 border-0 sm:border sm:border-gray-800
          rounded-none sm:rounded-[32px]
          shadow-2xl
        "
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* HEADER */}
        <DialogHeader className="p-4 sm:p-6 flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 text-white text-xl sm:text-2xl font-bold">
            <div className="p-2 bg-blue-600/20 rounded-xl">
              <ArrowLeftRight className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
            </div>
            SwapX
          </DialogTitle>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Cross-chain swap into BTC1 using thirdweb Bridge.
          </p>
        </DialogHeader>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="flex justify-center px-3 pb-8">
              <div className="w-full max-w-[420px]">
                <SwapWidget
                  client={thirdwebClient}
                  theme="dark"
                  prefill={{
                    buyToken: {
                      chainId: base.id,
                      tokenAddress: CONTRACT_ADDRESSES.BTC1USD as string,
                    },
                  }}
                />
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* FOOTER */}
        <div className="p-3 sm:p-4 bg-gray-900/60 border-t border-gray-800 flex justify-center flex-shrink-0">
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
