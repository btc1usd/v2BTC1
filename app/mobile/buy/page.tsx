"use client";

import "@/lib/web3";
import { useState, useEffect } from "react";
import { Plus, CreditCard, Landmark, ShieldCheck, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { sendToRN } from "@/lib/rnBridge";
import { useActiveAccount } from "thirdweb/react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MobileBuyPage() {
  const activeAccount = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [onrampProvider, setOnrampProvider] = useState<"stripe" | "coinbase" | "transak">("coinbase");

  useEffect(() => {
    sendToRN({ action: "READY" });
  }, []);

  async function handleBuy() {
    if (!activeAccount) {
      setError("Please connect your wallet in the app");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/buyx/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onramp: onrampProvider,
          chainId: 8453,
          tokenAddress: CONTRACT_ADDRESSES.BTC1USD,
          receiver: activeAccount.address,
          amountWei: amount ? (parseFloat(amount) * 10 ** 8).toString() : undefined, // BTC1 uses 8 decimals
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Send onramp link to RN to open in browser or system browser
      sendToRN({
        action: "ONRAMP_LINK",
        data: {
          link: data.link,
          provider: onrampProvider,
        },
      });
    } catch (err: any) {
      setError(err.message || "Failed to start on-ramp");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-950 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-600/20 rounded-xl">
            <Plus className="h-5 w-5 text-green-400" />
          </div>
          <h1 className="text-xl font-bold">Buy BTC1</h1>
        </div>
        <button onClick={() => sendToRN({ action: "CLOSE" })} className="p-2 hover:bg-gray-800 rounded-full">
          <ShieldCheck className="h-5 w-5 text-gray-400" />
        </button>
      </header>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6 max-w-md mx-auto">
          {/* Amount Input */}
          <div className="p-6 bg-gray-900 border border-gray-800 rounded-3xl space-y-4">
            <div className="text-center space-y-1">
              <span className="text-gray-400 text-sm">You want to buy</span>
              <div className="flex items-center justify-center gap-2">
                <input
                  type="number"
                  placeholder="0.0"
                  className="bg-transparent border-none text-4xl font-bold w-full focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="text-2xl font-bold text-gray-500">BTC1</span>
              </div>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400 px-1">Payment Provider</h3>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setOnrampProvider("coinbase")}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  onrampProvider === "coinbase" ? "bg-blue-600/10 border-blue-500" : "bg-gray-900 border-gray-800 grayscale opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <div className="w-6 h-6 bg-blue-600 rounded-full" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">Coinbase Pay</div>
                    <div className="text-xs text-gray-400 italic">Cards, Bank, Coinbase account</div>
                  </div>
                </div>
                {onrampProvider === "coinbase" && <ShieldCheck className="h-5 w-5 text-blue-400" />}
              </button>

              <button
                onClick={() => setOnrampProvider("transak")}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  onrampProvider === "transak" ? "bg-blue-600/10 border-blue-500" : "bg-gray-900 border-gray-800 grayscale opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">Transak</div>
                    <div className="text-xs text-gray-400 italic">Global support, many methods</div>
                  </div>
                </div>
                {onrampProvider === "transak" && <ShieldCheck className="h-5 w-5 text-blue-400" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 text-sm">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={loading || !amount}
            className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-500 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                Continue to Payment
                <ExternalLink className="h-5 w-5" />
              </>
            )}
          </button>

          <div className="p-4 bg-gray-900/50 rounded-2xl border border-gray-800 space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Why buy BTC1?</h4>
            <ul className="text-xs text-gray-500 space-y-2">
              <li className="flex gap-2">
                <ShieldCheck className="h-3 w-3 text-green-500 shrink-0" />
                <span>100% Bitcoin-backed and Shariah-compliant</span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="h-3 w-3 text-green-500 shrink-0" />
                <span>Earn rewards automatically by holding</span>
              </li>
            </ul>
          </div>

          <p className="text-center text-[10px] text-gray-500">
            Payment services are provided by third-party providers. Terms and conditions apply.
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
