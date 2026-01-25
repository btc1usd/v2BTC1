'use client';

import BuyXModal from '@/components/buyx-modal';

export default function MobileBuyPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <BuyXModal isOpen={true} onClose={() => {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'close' }));
        }
      }} />
    </div>
  );
}
