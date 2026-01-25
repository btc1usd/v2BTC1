'use client';

import SwapXModal from '@/components/swapx-modal';
import '@/lib/web3';

export default function MobileSwapPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <SwapXModal isOpen={true} onClose={() => {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'close' }));
        }
      }} />
    </div>
  );
}
