"use client";

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle2, Clock, ExternalLink, Copy, Loader2, Users, AlertCircle } from 'lucide-react';
import { ethers } from 'ethers';

interface SafeTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  contractAddress: string;
  functionSignature: string;
  calldata: string;
  category?: 'security' | 'rewards' | 'governance';
}

export default function SafeTransactionModal({
  isOpen,
  onClose,
  title,
  description,
  contractAddress,
  functionSignature,
  calldata,
  category = 'governance',
}: SafeTransactionModalProps) {
  const { address } = useAccount();
  
  const [safeAddress, setSafeAddress] = useState<string>('');
  const [isOwner, setIsOwner] = useState(false);
  const [threshold, setThreshold] = useState(0);
  const [owners, setOwners] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [proposing, setProposing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSafeInfo();
    }
  }, [isOpen, address]);

  const loadSafeInfo = async () => {
    try {
      setLoading(true);
      
      // Load from deployment file
      const response = await fetch('/deployment-base-sepolia.json');
      const deployment = await response.json();
      const adminAddress = deployment.config?.admin;
      
      if (!adminAddress) {
        throw new Error('Admin address not found');
      }
      
      setSafeAddress(adminAddress);
      
      // Load Safe details from Safe Transaction Service API
      const safeResponse = await fetch(
        `https://safe-transaction-base-sepolia.safe.global/api/v1/safes/${adminAddress}/`
      );
      const data = await safeResponse.json();
      
      setOwners(data.owners || []);
      setThreshold(data.threshold || 0);
      setIsOwner(data.owners?.includes(address?.toLowerCase()) || false);
      
    } catch (error) {
      console.error('Error loading Safe info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCalldata = () => {
    navigator.clipboard.writeText(calldata);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInSafe = () => {
    window.open(
      `https://app.safe.global/home?safe=base-sep:${safeAddress}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const getCategoryColor = () => {
    switch (category) {
      case 'security': return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
      case 'rewards': return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
      case 'governance': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getCategoryColor()}`}>
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl">{title}</p>
              <Badge variant="outline" className="mt-1 text-xs capitalize">
                {category}
              </Badge>
            </div>
          </DialogTitle>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Safe Info Card */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Safe Multi-Signature Wallet</h3>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Safe Address:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded">
                      {safeAddress.slice(0, 6)}...{safeAddress.slice(-4)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(safeAddress);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Required Signatures:</span>
                  <span className="font-semibold text-blue-600">
                    {threshold} of {owners.length}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Your Status:</span>
                  <Badge variant={isOwner ? "default" : "secondary"} className="text-xs">
                    {isOwner ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Signer</>
                    ) : (
                      <><Users className="h-3 w-3 mr-1" /> Observer</>
                    )}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Transaction Details */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Transaction Details
            </h3>
            
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-slate-600 dark:text-slate-400 mb-1">Contract Address</p>
                <code className="text-xs font-mono break-all">{contractAddress}</code>
              </div>
              
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-slate-600 dark:text-slate-400 mb-1">Function</p>
                <code className="text-xs font-mono">{functionSignature}</code>
              </div>
              
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-slate-600 dark:text-slate-400">Calldata</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={handleCopyCalldata}
                  >
                    {copied ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Copied!</>
                    ) : (
                      <><Copy className="h-3 w-3 mr-1" /> Copy</>
                    )}
                  </Button>
                </div>
                <code className="text-xs font-mono break-all block p-2 bg-white dark:bg-slate-950 rounded">
                  {calldata}
                </code>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-2 mt-2">
                <p className="font-semibold">How to execute this transaction:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Click "Open Safe App" below</li>
                  <li>In Safe App, click "New Transaction" → "Contract Interaction"</li>
                  <li>Paste the contract address: <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{contractAddress.slice(0, 10)}...</code></li>
                  <li>Enter function: <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{functionSignature}</code></li>
                  <li>Or paste the calldata directly in the "data" field</li>
                  <li>Submit and sign with MetaMask</li>
                  <li>Wait for {threshold} signer(s) to approve</li>
                  <li>Execute the transaction</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>

          {/* Signers */}
          {owners.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Signers ({owners.length})
              </h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {owners.map((owner, index) => (
                  <div
                    key={owner}
                    className={`flex items-center gap-2 p-2 rounded text-xs ${
                      owner.toLowerCase() === address?.toLowerCase()
                        ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                        : 'bg-slate-50 dark:bg-slate-900'
                    }`}
                  >
                    <Badge variant="outline" className="w-6 h-5 text-xs p-0 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <code className="font-mono flex-1 truncate">{owner}</code>
                    {owner.toLowerCase() === address?.toLowerCase() && (
                      <Badge variant="default" className="text-xs h-5">You</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={handleOpenInSafe}
              disabled={!safeAddress}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Safe App
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
