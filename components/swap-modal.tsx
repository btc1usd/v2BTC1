'use client';

/**
 * Swap Modal Component
 * Beautiful, mobile-responsive modal for token swapping
 * Automatically detects and displays user's token balances
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import OneInchSwapWidget from './OneInchSwapWidget';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SwapModal({ isOpen, onClose }: SwapModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-2xl my-8 animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-red-500 transition-all shadow-lg"
          aria-label="Close modal"
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hover:text-red-400" />
        </button>

        {/* Modal content */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-2xl">
          <OneInchSwapWidget />
        </div>
      </div>
    </div>
  );
}
