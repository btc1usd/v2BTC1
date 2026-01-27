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
        className="fixed inset-0 w-screen h-screen sm:fixed sm:inset-0 sm:w-[520px] sm:h-[95vh] p-0 bg-gray-950 border-0 sm:border border-gray-800 rounded-none sm:rounded-2xl sm:rounded-[32px] shadow-2xl flex flex-col z-50 data-[state=open]:animate-in data-[state=closed]:animate-out sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-4 sm:p-6 md:p-8 pb-3 sm:pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 sm:gap-4 text-white text-xl sm:text-2xl md:text-3xl font-bold">
            <div className="p-2 sm:p-2 md:p-3 bg-blue-600/20 rounded-xl sm:rounded-2xl">
              <ArrowLeftRight className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-blue-400" />
            </div>
            SwapX
          </DialogTitle>
          <p className="text-gray-400 text-xs sm:text-sm md:text-base mt-1 sm:mt-2">
            Cross-chain swap into BTC1 using thirdweb Bridge.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 py-2 overflow-y-auto overflow-x-hidden">
          <div className="w-full flex justify-center pb-6">
            <div className="w-full max-w-[500px]">
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

        <div className="p-3 sm:p-4 md:p-6 bg-gray-900/50 border-t border-gray-800 flex justify-center flex-shrink-0">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xs sm:text-sm font-medium transition-colors px-4 py-2 rounded-lg hover:bg-gray-800/50"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}