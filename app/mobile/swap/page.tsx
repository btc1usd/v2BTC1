'use client';

import SwapModal from '@/components/swap-modal';

export default function MobileSwapPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <SwapModal isOpen={true} onClose={() => {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'close' }));
        }
      }} />
    </div>
  );
}
