"use client";

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, AlertCircle, ExternalLink, ArrowUpCircle, ArrowDownCircle, Info } from 'lucide-react';
import { formatUnits } from 'viem';

interface ThirdwebTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'mint' | 'redeem';
  amount: string;
  collateralType: string;
  status: 'preparing' | 'signing' | 'confirming' | 'success' | 'error';
  errorMessage?: string;
  transactionHash?: string;
  onConfirm: () => void;
  chainId?: number;
}

export default function ThirdwebTransactionModal({
  isOpen,
  onClose,
  type,
  amount,
  collateralType,
  status,
  errorMessage,
  transactionHash,
  onConfirm,
  chainId = 84532,
}: ThirdwebTransactionModalProps) {
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    // Allow closing only if transaction is done (success/error) or not started
    setCanClose(status === 'success' || status === 'error' || status === 'preparing');
  }, [status]);

  const getExplorerUrl = () => {
    if (!transactionHash) return '';
    
    // Base Sepolia
    if (chainId === 84532) {
      return `https://sepolia.basescan.org/tx/${transactionHash}`;
    }
    // Base Mainnet
    if (chainId === 8453) {
      return `https://basescan.org/tx/${transactionHash}`;
    }
    return '';
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'preparing':
        return {
          icon: <Info className="h-6 w-6 text-blue-500" />,
          title: 'Review Transaction',
          description: 'Please review the details below before proceeding',
          color: 'blue',
          showSpinner: false,
        };
      case 'signing':
        return {
          icon: <Loader2 className="h-6 w-6 text-yellow-500 animate-spin" />,
          title: 'Signing Transaction',
          description: 'Please sign the transaction in your wallet',
          color: 'yellow',
          showSpinner: true,
        };
      case 'confirming':
        return {
          icon: <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />,
          title: 'Confirming Transaction',
          description: 'Transaction submitted. Waiting for blockchain confirmation...',
          color: 'blue',
          showSpinner: true,
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="h-6 w-6 text-green-500" />,
          title: 'Transaction Successful!',
          description: 'Your transaction has been confirmed on the blockchain',
          color: 'green',
          showSpinner: false,
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-6 w-6 text-red-500" />,
          title: 'Transaction Failed',
          description: errorMessage || 'An error occurred while processing your transaction',
          color: 'red',
          showSpinner: false,
        };
      default:
        return {
          icon: <Info className="h-6 w-6" />,
          title: 'Transaction',
          description: '',
          color: 'gray',
          showSpinner: false,
        };
    }
  };

  const config = getStatusConfig();
  const isMint = type === 'mint';

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open && canClose) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md p-0 bg-gray-950 border-gray-800 overflow-hidden rounded-[24px] shadow-2xl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-3 text-white text-2xl font-bold">
            <div className={`p-2.5 rounded-xl bg-${config.color}-500/10`}>
              {isMint ? (
                <ArrowUpCircle className={`h-6 w-6 text-${config.color}-500`} />
              ) : (
                <ArrowDownCircle className={`h-6 w-6 text-${config.color}-500`} />
              )}
            </div>
            <div>
              <p>{config.title}</p>
              <Badge 
                variant="outline" 
                className={`mt-1 text-xs capitalize border-${config.color}-500/30 text-${config.color}-400`}
              >
                {isMint ? 'Mint' : 'Redeem'}
              </Badge>
            </div>
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm mt-2">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Status Indicator */}
          <div className={`flex items-center justify-center gap-3 p-4 rounded-xl bg-${config.color}-500/10 border border-${config.color}-500/20`}>
            {config.icon}
            <span className={`font-semibold text-${config.color}-400`}>
              {status === 'preparing' && 'Ready to proceed'}
              {status === 'signing' && 'Awaiting signature...'}
              {status === 'confirming' && 'Processing on blockchain...'}
              {status === 'success' && 'Completed successfully'}
              {status === 'error' && 'Transaction failed'}
            </span>
          </div>

          {/* Transaction Details */}
          <div className="space-y-3 bg-gray-900/50 rounded-xl p-4 border border-gray-800">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Action:</span>
              <span className="font-semibold text-white">
                {isMint ? 'Mint BTC1USD' : 'Redeem Collateral'}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Amount:</span>
              <span className="font-semibold text-white">
                {amount} {isMint ? collateralType : 'BTC1USD'}
              </span>
            </div>

            {!isMint && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Receive:</span>
                <span className="font-semibold text-white">
                  {amount} {collateralType}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Method:</span>
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                {isMint ? 'Permit2' : 'EIP-2612'}
              </Badge>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Gas:</span>
              <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                Sponsored ⚡
              </Badge>
            </div>
          </div>

          {/* Info Alert for Preparing State */}
          {status === 'preparing' && (
            <Alert className="bg-blue-500/10 border-blue-500/20">
              <Info className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-sm text-blue-300">
                <p className="font-semibold mb-1">Gasless Transaction</p>
                <p className="text-xs">
                  This transaction uses {isMint ? 'Permit2' : 'EIP-2612 Permit'} for gasless approval. 
                  You'll only need to sign the message - no gas fees required!
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Transaction Hash */}
          {transactionHash && (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Transaction Hash:</p>
              <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-lg border border-gray-800">
                <code className="text-xs font-mono text-gray-300 flex-1 truncate">
                  {transactionHash}
                </code>
                {getExplorerUrl() && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => window.open(getExplorerUrl(), '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {status === 'error' && errorMessage && (
            <Alert className="bg-red-500/10 border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-sm text-red-300">
                <p className="font-semibold mb-1">Error Details:</p>
                <p className="text-xs">{errorMessage}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {status === 'preparing' && (
              <>
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-gray-700 hover:bg-gray-800"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-bold shadow-lg shadow-blue-500/20"
                  onClick={onConfirm}
                >
                  Confirm {isMint ? 'Mint' : 'Redeem'}
                </Button>
              </>
            )}

            {(status === 'signing' || status === 'confirming') && (
              <Button
                className="w-full h-12 rounded-xl bg-gray-800 cursor-not-allowed"
                disabled
              >
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </Button>
            )}

            {status === 'success' && (
              <Button
                className="w-full h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 font-bold"
                onClick={onClose}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Close
              </Button>
            )}

            {status === 'error' && (
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={onClose}
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
