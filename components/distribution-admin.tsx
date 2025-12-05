"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { useAccount } from 'wagmi';
import {
  Settings,
  BarChart3,
  AlertCircle,
  Gift
} from 'lucide-react';
import { formatPercentage } from '@/lib/protocol-math';
import MerkleDistributionManagement from './merkle-distribution-management';

interface DistributionAdminProps {
  collateralRatio: number;
  totalSupply: number;
}

export default function DistributionAdmin({ collateralRatio, totalSupply }: DistributionAdminProps) {
  const { address, isConnected } = useAccount();
  
  // Admin check
  const isAdmin = () => {
    const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET || "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835"; // From deployment
    return address && address.toLowerCase() === adminAddress.toLowerCase();
  };

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

  if (!isAdmin()) {
    return (
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Distribution Administration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Access denied. This section is only available to administrators.
              <br />
              <span className="text-xs text-gray-400 mt-2 block">
                Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
        <MerkleDistributionManagement />
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