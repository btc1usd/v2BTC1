'use client';

/**
 * Swap Modal Component
 * Beautiful, mobile-responsive modal for token swapping
 * Automatically detects and displays user's token balances
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OneInchSwapWidget from './OneInchSwapWidget';
import { ArrowLeftRight } from 'lucide-react';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SwapModal({ isOpen, onClose }: SwapModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="w-[95vw] sm:max-w-lg p-0 bg-gray-950 border-gray-800 rounded-2xl sm:rounded-[32px] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 sm:p-8 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-4 text-white text-3xl font-bold">
            <div className="p-3 bg-blue-600/20 rounded-2xl">
              <ArrowLeftRight className="h-7 w-7 text-blue-400" />
            </div>
            Token Swap
          </DialogTitle>
          <p className="text-gray-400 text-base mt-2">
            Exchange any token on Base with the best available rates.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 pb-4">
          <div className="w-full max-w-md mx-auto">
            <OneInchSwapWidget />
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-gray-900/50 border-t border-gray-800 flex justify-center flex-shrink-0">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-sm font-medium transition-colors"
          >
            Cancel and Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
