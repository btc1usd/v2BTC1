"use client";

import "@/lib/web3";
import { useState, useEffect } from "react";
import { ArrowLeftRight, Settings, Info, AlertCircle, Loader2 } from "lucide-react";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { sendToRN } from "@/lib/rnBridge";
import { useActiveAccount } from "thirdweb/react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MobileSwapPage() {
  const activeAccount = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<any[]>([]);
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available tokens on mount
  useEffect(() => {
    async function fetchMetadata() {
      try {
        setLoading(true);
        const res = await fetch("/api/swapx/metadata");
        const data = await res.json();
        if (data.tokens) {
          setTokens(data.tokens);
          // Set default to ETH or first available
          const eth = data.tokens.find((t: any) => t.symbol === "ETH");
          setSelectedToken(eth || data.tokens[0]);
        }
      } catch (err) {
        console.error("Failed to fetch metadata:", err);
        setError("Failed to load tokens");
      } finally {
        setLoading(false);
      }
    }
    fetchMetadata();
    sendToRN({ action: "READY" });
  }, []);

  // Fetch quote when amount changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (amount && parseFloat(amount) > 0 && selectedToken) {
        fetchQuote();
      } else {
        setQuote(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [amount, selectedToken]);

  async function fetchQuote() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/swapx/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromTokenAddress: selectedToken.address,
          fromChainId: 8453,
          amountWei: (parseFloat(amount) * 10 ** (selectedToken?.decimals || 18)).toString(),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuote(data.quote);
    } catch (err: any) {
      setError(err.message || "Failed to get quote");
    } finally {
      setLoading(false);
    }
  }

  async function handleSwap() {
    if (!quote || !activeAccount) {
      if (!activeAccount) setError("Please connect your wallet in the app");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/swapx/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromTokenAddress: selectedToken.address,
          fromChainId: 8453,
          amountWei: quote.intent.amount,
          toTokenAddress: CONTRACT_ADDRESSES.BTC1USD,
          sender: activeAccount.address,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Send transaction data to RN for signing
      sendToRN({
        action: "TX_SIGN_REQUEST",
        data: {
          transactions: data.transactions,
          type: "swap",
        },
      });
    } catch (err: any) {
      setError(err.message || "Failed to prepare transaction");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-950 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-xl">
            <ArrowLeftRight className="h-5 w-5 text-blue-400" />
          </div>
          <h1 className="text-xl font-bold">SwapX</h1>
        </div>
        <button onClick={() => sendToRN({ action: "CLOSE" })} className="p-2 hover:bg-gray-800 rounded-full">
          <Settings className="h-5 w-5 text-gray-400" />
        </button>
      </header>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6 max-w-md mx-auto">
          {/* Sell Panel */}
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl space-y-3">
            <div className="flex justify-between text-sm text-gray-400">
              <span>You Sell</span>
              <span>Balance: 0.00</span>
            </div>
            <div className="flex items-center gap-3">
              <select 
                className="bg-gray-800 border-none rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none min-w-[100px]"
                value={selectedToken?.address || ""}
                onChange={(e) => {
                  const t = tokens.find(tk => tk.address === e.target.value);
                  setSelectedToken(t);
                }}
              >
                {tokens.map(t => (
                  <option key={t.address} value={t.address}>{t.symbol}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="0.0"
                className="bg-transparent border-none text-2xl font-bold w-full focus:outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-center -my-4 relative z-10">
            <div className="bg-gray-950 p-2 rounded-full border border-gray-800">
              <ArrowLeftRight className="h-5 w-5 text-blue-400 rotate-90" />
            </div>
          </div>

          {/* Buy Panel */}
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl space-y-3">
            <div className="flex justify-between text-sm text-gray-400">
              <span>You Buy</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-full">
                <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">B</div>
                <span className="font-semibold">BTC1</span>
              </div>
              <div className="text-2xl font-bold text-gray-500">
                {quote ? (parseFloat(quote.destinationAmount) / 10**8).toFixed(6) : "0.00"}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 text-sm">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {quote && (
            <div className="p-3 bg-blue-900/10 border border-blue-500/20 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Rate</span>
                <span>1 {selectedToken?.symbol} ≈ {(parseFloat(quote.destinationAmount) / parseFloat(quote.originAmount) * 10**(selectedToken?.decimals || 18) / 10**8).toFixed(2)} BTC1</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Estimated Time</span>
                <span>{quote.estimatedExecutionTimeMs / 1000}s</span>
              </div>
            </div>
          )}

          <button
            onClick={handleSwap}
            disabled={loading || !amount || !!error}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Review Swap"}
          </button>

          <p className="text-center text-[10px] text-gray-500">
            Powered by Thirdweb Bridge API. Transactions are signed natively in the app.
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
