'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BuyWidget } from "thirdweb/react";
import { client as thirdwebClient } from "@/lib/thirdweb-client";
import { base } from "thirdweb/chains";
import { Plus } from 'lucide-react';

interface BuyXModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BuyXModal({ isOpen, onClose }: BuyXModalProps) {
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
            <div className="p-2 bg-green-600/20 rounded-xl">
              <Plus className="h-6 w-6 text-green-400" />
            </div>
            BuyX
          </DialogTitle>
          <p className="text-gray-400 text-sm mt-2">
            Buy BTC1 with card or crypto via thirdweb Bridge.
          </p>
        </DialogHeader>

        {/* SCROLL BODY */}
        <div className="flex-1 w-full h-full force-scroll">
          <div className="min-w-[420px] min-h-[640px] p-3">
            <BuyWidget
              client={thirdwebClient}
              theme="dark"
              chain={base}
              tokenAddress="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
              tokenEditable
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
