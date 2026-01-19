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
      <DialogContent className="max-w-xl p-0 bg-gray-950 border-gray-800 overflow-hidden rounded-3xl shadow-2xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-3 text-white text-2xl">
            <div className="p-2 bg-blue-600/20 rounded-xl">
              <ArrowLeftRight className="h-6 w-6 text-blue-400" />
            </div>
            Token Swap
          </DialogTitle>
          <p className="text-gray-400 text-sm mt-1">
            Exchange any token on Base with the best available rates.
          </p>
        </DialogHeader>

        <div className="max-h-[85vh] overflow-y-auto custom-scrollbar">
          <OneInchSwapWidget />
        </div>
      </DialogContent>
    </Dialog>
  );
}
