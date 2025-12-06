"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ethers } from "ethers";
import { parseUnits } from "viem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Plus, Trash2, CheckCircle, Coins, Info } from "lucide-react";
import { CONTRACT_ADDRESSES, ABIS } from "@/lib/contracts";

interface CollateralToken {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  isSupported: boolean;
}

interface CollateralManagementProps {
  isAdmin: boolean;
  protocolState?: {
    contractAddresses: {
      wbtc: string;
      cbbtc: string;
      tbtc: string;
    };
  };
}

export default function CollateralManagement({ isAdmin, protocolState }: CollateralManagementProps) {
  const { address, isConnected } = useAccount();
  const [newTokenSymbol, setNewTokenSymbol] = useState("");
  const [newTokenAddress, setNewTokenAddress] = useState("");
  const [newTokenName, setNewTokenName] = useState("");
  const [supportedCollaterals, setSupportedCollaterals] = useState<CollateralToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState("");
  const [isLoadingCollaterals, setIsLoadingCollaterals] = useState(true);
  
  // Test minting states
  const [selectedMintCollateral, setSelectedMintCollateral] = useState("WBTC");
  const [mintAmount, setMintAmount] = useState("");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Load supported collaterals
  useEffect(() => {
    loadSupportedCollaterals();
  }, [isConnected]);

  const loadSupportedCollaterals = async () => {
    if (!isConnected || typeof window === "undefined" || !window.ethereum) {
      setIsLoadingCollaterals(false);
      return;
    }

    try {
      setIsLoadingCollaterals(true);
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const vaultContract = new ethers.Contract(
        CONTRACT_ADDRESSES.VAULT,
        ABIS.VAULT,
        provider
      );

      // Get supported collateral addresses
      const collateralAddresses = await vaultContract.getSupportedCollateral();
      
      // Get details for each collateral
      const collateralDetails = await Promise.all(
        collateralAddresses.map(async (addr: string) => {
          try {
            const tokenContract = new ethers.Contract(addr, ABIS.ERC20, provider);
            const [symbol, name, balance] = await Promise.all([
              tokenContract.symbol(),
              tokenContract.name(),
              vaultContract.collateralBalances(addr)
            ]);

            return {
              address: addr,
              symbol,
              name,
              balance: ethers.formatUnits(balance, 8),
              isSupported: true
            };
          } catch (error) {
            console.error(`Error loading token ${addr}:`, error);
            return {
              address: addr,
              symbol: "Unknown",
              name: "Unknown Token",
              balance: "0",
              isSupported: true
            };
          }
        })
      );

      setSupportedCollaterals(collateralDetails);
    } catch (error) {
      console.error("Error loading collaterals:", error);
      setTransactionStatus("Error loading supported collaterals");
    } finally {
      setIsLoadingCollaterals(false);
    }
  };

  const handleAddCollateral = async () => {
    if (!isConnected || !address) {
      setTransactionStatus("Please connect your wallet");
      return;
    }

    if (!isAdmin) {
      setTransactionStatus("Only admin can add collateral tokens");
      return;
    }

    if (!ethers.isAddress(newTokenAddress)) {
      setTransactionStatus("Invalid token address");
      return;
    }

    if (!newTokenSymbol || !newTokenName) {
      setTransactionStatus("Please provide token symbol and name");
      return;
    }

    try {
      setIsLoading(true);
      setTransactionStatus("Preparing transaction...");

      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();

      // Verify it's an ERC20 token
      const tokenContract = new ethers.Contract(newTokenAddress, ABIS.ERC20, provider);
      
      try {
        const [tokenSymbol, tokenName, decimals] = await Promise.all([
          tokenContract.symbol(),
          tokenContract.name(),
          tokenContract.decimals()
        ]);

        if (decimals !== 8n) {
          setTransactionStatus(`Warning: Token has ${decimals} decimals, protocol expects 8 decimals for BTC tokens`);
          const proceed = confirm(`Token has ${decimals} decimals instead of expected 8. Continue anyway?`);
          if (!proceed) {
            setIsLoading(false);
            return;
          }
        }

        console.log(`Token verified: ${tokenSymbol} (${tokenName})`);
      } catch (error) {
        setTransactionStatus("Error: Address is not a valid ERC20 token");
        setIsLoading(false);
        return;
      }

      setTransactionStatus("Adding collateral to Vault...");
      
      const vaultContract = new ethers.Contract(
        CONTRACT_ADDRESSES.VAULT,
        ABIS.VAULT,
        signer
      );

      // Check if already supported
      const isSupported = await vaultContract.supportedCollateral(newTokenAddress);
      if (isSupported) {
        setTransactionStatus("Error: Token is already supported as collateral");
        setIsLoading(false);
        return;
      }

      // Add collateral
      const tx = await vaultContract.addCollateral(newTokenAddress);
      setTransactionStatus("Transaction submitted. Waiting for confirmation...");
      
      await tx.wait();
      
      setTransactionStatus(`✅ Successfully added ${newTokenSymbol} as collateral!`);
      
      // Clear inputs
      setNewTokenSymbol("");
      setNewTokenAddress("");
      setNewTokenName("");
      
      // Reload collaterals
      setTimeout(() => {
        loadSupportedCollaterals();
      }, 2000);

    } catch (error: any) {
      console.error("Error adding collateral:", error);
      setTransactionStatus(`Error: ${error.message || "Failed to add collateral"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCollateral = async (tokenAddress: string, symbol: string) => {
    if (!isConnected || !address) {
      setTransactionStatus("Please connect your wallet");
      return;
    }

    if (!isAdmin) {
      setTransactionStatus("Only admin can remove collateral tokens");
      return;
    }

    const confirm = window.confirm(
      `Are you sure you want to remove ${symbol} as collateral? This can only be done if the vault has zero balance of this token.`
    );

    if (!confirm) return;

    try {
      setIsLoading(true);
      setTransactionStatus("Preparing transaction...");

      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      
      const vaultContract = new ethers.Contract(
        CONTRACT_ADDRESSES.VAULT,
        ABIS.VAULT,
        signer
      );

      // Check balance
      const balance = await vaultContract.collateralBalances(tokenAddress);
      if (balance > 0n) {
        setTransactionStatus("Error: Cannot remove collateral with non-zero balance in vault");
        setIsLoading(false);
        return;
      }

      setTransactionStatus("Removing collateral from Vault...");
      
      const tx = await vaultContract.removeCollateral(tokenAddress);
      setTransactionStatus("Transaction submitted. Waiting for confirmation...");
      
      await tx.wait();
      
      setTransactionStatus(`✅ Successfully removed ${symbol} as collateral!`);
      
      // Reload collaterals
      setTimeout(() => {
        loadSupportedCollaterals();
      }, 2000);

    } catch (error: any) {
      console.error("Error removing collateral:", error);
      setTransactionStatus(`Error: ${error.message || "Failed to remove collateral"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoFill = async () => {
    if (!ethers.isAddress(newTokenAddress)) {
      setTransactionStatus("Please enter a valid token address first");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const tokenContract = new ethers.Contract(newTokenAddress, ABIS.ERC20, provider);
      
      const [symbol, name] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.name()
      ]);

      setNewTokenSymbol(symbol);
      setNewTokenName(name);
      setTransactionStatus("");
    } catch (error) {
      setTransactionStatus("Error: Could not read token details. Make sure it's a valid ERC20 token.");
    }
  };

  const handleTestMint = async () => {
    if (!isConnected || !address) {
      setTransactionStatus("Please connect your wallet");
      return;
    }

    if (!isAdmin) {
      setTransactionStatus("Only admin can mint test collateral tokens");
      return;
    }

    if (!mintAmount) {
      setTransactionStatus("Please enter an amount");
      return;
    }

    const amountFloat = parseFloat(mintAmount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      setTransactionStatus("Please enter a valid amount");
      return;
    }

    try {
      setTransactionStatus("Preparing transaction...");
      
      let contractAddress: string;
      switch (selectedMintCollateral) {
        case "WBTC":
          contractAddress = protocolState?.contractAddresses?.wbtc || CONTRACT_ADDRESSES.WBTC_TOKEN;
          break;
        case "cbBTC":
          contractAddress = protocolState?.contractAddresses?.cbbtc || CONTRACT_ADDRESSES.CBBTC_TOKEN;
          break;
        case "tBTC":
          contractAddress = protocolState?.contractAddresses?.tbtc || CONTRACT_ADDRESSES.TBTC_TOKEN;
          break;
        default:
          throw new Error("Invalid collateral type");
      }

      const amount = parseUnits(mintAmount, 8);
      
      setTransactionStatus(`Minting ${mintAmount} ${selectedMintCollateral}...`);
      
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: [
          {
            name: "mint",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "to", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [],
          },
        ],
        functionName: "mint",
        args: [address, amount],
      });
    } catch (error: any) {
      console.error("Error minting:", error);
      setTransactionStatus(`Error: ${error.message || "Failed to mint"}`);
    }
  };

  // Update status based on transaction state
  useEffect(() => {
    if (isConfirming) {
      setTransactionStatus("Waiting for confirmation...");
    } else if (isSuccess) {
      setTransactionStatus(`✅ Successfully minted ${mintAmount} ${selectedMintCollateral}!`);
      setMintAmount("");
    } else if (error) {
      setTransactionStatus(`Error: ${error.message}`);
    }
  }, [isConfirming, isSuccess, error, mintAmount, selectedMintCollateral]);

  if (!isAdmin) {
    return (
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <CardTitle className="text-red-400">Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-300">Only administrators can manage collateral tokens.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unified Tabs */}
      <Tabs defaultValue="manage" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
          <TabsTrigger 
            value="manage"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Manage Collateral
          </TabsTrigger>
          <TabsTrigger 
            value="test-mint"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white"
          >
            <Coins className="h-4 w-4 mr-2" />
            Test Mint
          </TabsTrigger>
        </TabsList>

        {/* Manage Collateral Tab */}
        <TabsContent value="manage" className="space-y-6">
          {/* Add New Collateral */}
          <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Plus className="h-5 w-5 text-green-400" />
            <CardTitle className="text-white">Add New Collateral Token</CardTitle>
          </div>
          <CardDescription className="text-gray-400">
            Add a new BTC-backed token as accepted collateral for minting BTC1
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
              <div className="space-y-1">
                <p className="text-blue-300 text-sm font-medium">Important Notes</p>
                <ul className="text-blue-300 text-xs space-y-1 list-disc list-inside">
                  <li>Token must be a valid ERC20 contract</li>
                  <li>Ideally should have 8 decimals (BTC standard)</li>
                  <li>Ensure the token is trustworthy and represents real BTC collateral</li>
                  <li>Once added, users can immediately use it for minting</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token-address" className="text-gray-300">
                Token Contract Address
              </Label>
              <div className="flex gap-2">
                <Input
                  id="token-address"
                  type="text"
                  placeholder="0x..."
                  value={newTokenAddress}
                  onChange={(e) => setNewTokenAddress(e.target.value)}
                  className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleAutoFill}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  disabled={!ethers.isAddress(newTokenAddress)}
                >
                  Auto-fill
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Enter the Ethereum address of the ERC20 token contract
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="token-symbol" className="text-gray-300">
                  Token Symbol
                </Label>
                <Input
                  id="token-symbol"
                  type="text"
                  placeholder="e.g., WBTC"
                  value={newTokenSymbol}
                  onChange={(e) => setNewTokenSymbol(e.target.value)}
                  className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="token-name" className="text-gray-300">
                  Token Name
                </Label>
                <Input
                  id="token-name"
                  type="text"
                  placeholder="e.g., Wrapped Bitcoin"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            <Button
              onClick={handleAddCollateral}
              disabled={!isConnected || isLoading || !newTokenAddress || !newTokenSymbol || !newTokenName}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Adding Collateral...</span>
                </div>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Collateral Token
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

          {/* Current Supported Collaterals */}
          <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white">Current Supported Collaterals</CardTitle>
          <CardDescription className="text-gray-400">
            Tokens currently accepted as collateral in the protocol
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingCollaterals ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-gray-400">Loading collaterals...</span>
            </div>
          ) : supportedCollaterals.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No collateral tokens configured yet
            </div>
          ) : (
            <div className="space-y-3">
              {supportedCollaterals.map((token) => (
                <div
                  key={token.address}
                  className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="font-bold text-white">{token.symbol}</span>
                      <span className="text-gray-400">-</span>
                      <span className="text-gray-300">{token.name}</span>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      {token.address}
                    </div>
                    <div className="text-sm text-gray-300 mt-1">
                      Vault Balance: <span className="font-semibold">{parseFloat(token.balance).toFixed(8)} {token.symbol}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleRemoveCollateral(token.address, token.symbol)}
                    disabled={isLoading || parseFloat(token.balance) > 0}
                    variant="outline"
                    size="sm"
                    className={`border-red-500 text-red-400 hover:bg-red-900/20 ${
                      parseFloat(token.balance) > 0 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        {/* Test Mint Tab */}
        <TabsContent value="test-mint" className="space-y-6">
          <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Coins className="h-5 w-5 text-orange-400" />
                <CardTitle className="text-white">Test Mint Collateral (Admin Only)</CardTitle>
              </div>
              <CardDescription className="text-gray-400">
                Mint test collateral tokens for development and testing purposes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Info className="h-5 w-5 text-orange-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-orange-300 text-sm font-medium">Development Only</p>
                    <p className="text-orange-300/80 text-xs">
                      This feature is for testing purposes only. Use it to mint collateral tokens on testnet.
                      Admin wallet: {CONTRACT_ADDRESSES.ADMIN.slice(0, 6)}...{CONTRACT_ADDRESSES.ADMIN.slice(-4)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Collateral Type Selector */}
              <div className="space-y-3">
                <Label className="text-gray-300 text-sm font-medium">
                  Select Collateral Type
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {["WBTC", "cbBTC", "tBTC"].map((token) => (
                    <Button
                      key={token}
                      variant={selectedMintCollateral === token ? "default" : "outline"}
                      onClick={() => setSelectedMintCollateral(token)}
                      className={
                        selectedMintCollateral === token
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 shadow-lg"
                          : "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                      }
                    >
                      <Coins className="h-4 w-4 mr-2" />
                      {token}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-3">
                <Label htmlFor="test-mint-amount" className="text-gray-300 text-sm font-medium">
                  Amount to Mint
                </Label>
                <div className="relative">
                  <Input
                    id="test-mint-amount"
                    type="number"
                    placeholder="10.0"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    className="bg-gray-900 border-2 border-gray-700 focus:border-orange-500 text-white text-lg placeholder:text-gray-500 pr-24 h-14"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                    <span className="text-gray-400 font-semibold">
                      {selectedMintCollateral}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[1, 5, 10, 50].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-orange-500"
                    onClick={() => setMintAmount(amount.toString())}
                  >
                    {amount}
                  </Button>
                ))}
              </div>

              {/* Mint Button */}
              <Button
                onClick={handleTestMint}
                disabled={!isConnected || !mintAmount || isPending || isConfirming}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold h-12 shadow-lg"
              >
                {isPending || isConfirming ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>
                      {isPending ? "Confirming in wallet..." : "Processing transaction..."}
                    </span>
                  </div>
                ) : (
                  <>
                    <Coins className="h-5 w-5 mr-2" />
                    Mint {selectedMintCollateral} Tokens
                  </>
                )}
              </Button>

              {/* Alternative Script Method */}
              <div className="border-t border-gray-700 pt-4">
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                    <Info className="h-4 w-4 mr-2 text-blue-400" />
                    Alternative: Use Script
                  </div>
                  <code className="text-xs bg-gray-800 px-3 py-2 rounded text-gray-400 block font-mono">
                    npx hardhat run scripts/mint-collateral.js --network localhost
                  </code>
                  <p className="text-xs text-gray-500 mt-2">
                    The script will mint test tokens to your account for testing.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction Status - Global */}
      {transactionStatus && (
        <Alert
          className={`${
            transactionStatus.includes("Error") || transactionStatus.includes("Warning")
              ? "bg-red-900/20 border-red-500/30"
              : transactionStatus.includes("✅")
              ? "bg-green-900/20 border-green-500/30"
              : "bg-blue-900/20 border-blue-500/30"
          } shadow-lg`}
        >
          <AlertCircle
            className={`h-4 w-4 ${
              transactionStatus.includes("Error") || transactionStatus.includes("Warning")
                ? "text-red-400"
                : transactionStatus.includes("✅")
                ? "text-green-400"
                : "text-blue-400"
            }`}
          />
          <AlertDescription
            className={`${
              transactionStatus.includes("Error") || transactionStatus.includes("Warning")
                ? "text-red-300"
                : transactionStatus.includes("✅")
                ? "text-green-300"
                : "text-blue-300"
            }`}
          >
            {transactionStatus}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
