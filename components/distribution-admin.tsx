"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { useWeb3 } from '@/lib/web3-provider';
import {
  Settings,
  BarChart3,
  AlertCircle,
  Gift,
  Shield
} from 'lucide-react';
import { formatPercentage } from '@/lib/protocol-math';
import MerkleDistributionManagement from './merkle-distribution-management';
import { hasUIAccess, getAuthStatus, getTransactionInstructions } from '@/lib/auth-config';

interface DistributionAdminProps {
  collateralRatio: number;
  totalSupply: number;
  onSetMerkleRoot?: (epoch: number, merkleRoot: string) => void;
  onExecuteDistribution?: () => void;
}

export default function DistributionAdmin({ 
  collateralRatio, 
  totalSupply,
  onSetMerkleRoot,
  onExecuteDistribution 
}: DistributionAdminProps) {
  const { address, isConnected } = useWeb3();
  
  // Use new auth system - separates UI access from transaction execution
  const authStatus = getAuthStatus(address);
  const canViewAdmin = authStatus.canViewAdmin;
  const txInstructions = getTransactionInstructions();

  if (!isConnected) {
    return (
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Distribution Administration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to access admin functions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!canViewAdmin) {
    return (
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Distribution Administration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Access denied. This section is only available to UI controllers.
              <br />
              <span className="text-xs text-gray-400 mt-2 block">
                Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <span className="text-xs text-gray-400 mt-1 block">
                Controller: {authStatus.controllerAddress?.slice(0, 6)}...{authStatus.controllerAddress?.slice(-4)}
              </span>
            </AlertDescription>
          </Alert>
          
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Shield className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-100">
              <div className="font-semibold mb-2">Transaction Execution</div>
              <div className="text-xs space-y-1">
                {txInstructions.instructions.map((instruction, i) => (
                  <div key={i}>• {instruction}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auth Status Banner */}
      <Alert className={authStatus.isSafe ? "bg-green-500/10 border-green-500/30" : "bg-blue-500/10 border-blue-500/30"}>
        <Shield className={`h-4 w-4 ${authStatus.isSafe ? 'text-green-400' : 'text-blue-400'}`} />
        <AlertDescription className={authStatus.isSafe ? "text-green-100" : "text-blue-100"}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{authStatus.message}</div>
              <div className="text-xs mt-1">
                Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
            </div>
            {!authStatus.isSafe && (
              <Badge variant="outline" className="text-xs border-blue-400 text-blue-400">
                Transactions via Safe
              </Badge>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* Admin Header */}
      <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
            <Settings className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Distribution Administration</h2>
            <p className="text-gray-400 text-sm">
              Manage merkle tree distributions and claim operations
            </p>
          </div>
        </div>
      </div>

      {/* Merkle Distribution Management */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3 sm:p-4 border border-gray-700 shadow-xl">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
          Merkle Distribution Control
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Generate merkle trees, set roots, and manage claim distributions
        </p>
        <MerkleDistributionManagement 
          onSetMerkleRoot={onSetMerkleRoot}
          onExecuteDistribution={onExecuteDistribution}
        />
      </div>

      {/* Protocol Status Overview */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Protocol Status Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-700/30 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">
                {formatPercentage(collateralRatio, 1)}
              </div>
              <div className="text-sm text-gray-400">Collateral Ratio</div>
              <Badge variant={collateralRatio >= 1.12 ? "default" : "secondary"} className="mt-2">
                {collateralRatio >= 1.12 ? "Distribution Ready" : "Below Threshold"}
              </Badge>
            </div>

            <div className="text-center p-4 bg-gray-700/30 rounded-lg">
              <div className="text-2xl font-bold text-green-400">
                {totalSupply.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">Total Supply</div>
              <div className="text-xs text-gray-500 mt-2">BTC1 Tokens</div>
            </div>

            <div className="text-center p-4 bg-gray-700/30 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">
                {collateralRatio >= 2.02 ? '10.0¢' :
                 collateralRatio >= 1.92 ? '9.0¢' :
                 collateralRatio >= 1.82 ? '8.0¢' :
                 collateralRatio >= 1.72 ? '7.0¢' :
                 collateralRatio >= 1.62 ? '6.0¢' :
                 collateralRatio >= 1.52 ? '5.0¢' :
                 collateralRatio >= 1.42 ? '4.0¢' :
                 collateralRatio >= 1.32 ? '3.0¢' :
                 collateralRatio >= 1.22 ? '2.0¢' :
                 collateralRatio >= 1.12 ? '1.0¢' : '0.0¢'}
              </div>
              <div className="text-sm text-gray-400">Current Reward Rate</div>
              <div className="text-xs text-gray-500 mt-2">Per Token Weekly</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Distribution Schedule - User Info */}
      <Card className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-500/30 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Weekly Distribution Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-300">
          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="font-semibold text-blue-400 mb-2">When do distributions happen?</div>
            <div className="space-y-1 text-xs">
              <div>• Distributions occur every <strong>7 days</strong> (weekly)</div>
              <div>• Once 7 days pass, admin can execute distribution</div>
              <div>• Typically executed on Fridays at 14:00 UTC</div>
              <div>• Requires collateral ratio <strong>≥ 112%</strong> to proceed</div>
            </div>
          </div>

          <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <div className="font-semibold text-purple-400 mb-2">How do rewards work?</div>
            <div className="space-y-1 text-xs">
              <div>• Higher collateral ratio = higher rewards (1¢-10¢ per BTC1 per distribution)</div>
              <div>• Rewards are distributed proportionally to all BTC1 holders</div>
              <div>• After distribution, claim your rewards via Merkle Claim tab</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Instructions */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white text-sm">Admin Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-400">
          <div>• <strong>Distribution Window:</strong> Opens 7 days after last distribution. Execute anytime once available.</div>
          <div>• <strong>Requirements Check:</strong> Verify collateral ratio ≥ 112% and admin wallet connected</div>
          <div>• <strong>Execute Distribution:</strong> Mints new BTC1 tokens based on reward tier</div>
          <div>• <strong>Generate Merkle Tree:</strong> Create distribution data after execution</div>
          <div>• <strong>Set Root:</strong> Upload merkle root on-chain to enable user claims</div>
          <div>• <strong>Monitor Claims:</strong> Track claim progress and distribution success</div>
        </CardContent>
      </Card>
    </div>
  );
}