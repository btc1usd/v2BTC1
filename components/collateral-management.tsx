"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import BTC1USDSafeTimelock from "@/components/btc1usd-safe-timelock";
import { AlertCircle, Plus, Trash2, CheckCircle, Settings, Shield, Copy, ExternalLink, ArrowRight, Lock } from "lucide-react";
import { CONTRACT_ADDRESSES, ABIS } from "@/lib/contracts";
import { encodeFunctionData } from "viem";

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
  
  // Proxy upgrade states
  const [selectedContract, setSelectedContract] = useState<string>("");
  const [newImplementation, setNewImplementation] = useState("");
  const [currentImplementation, setCurrentImplementation] = useState<string>("");
  const [showSafeModal, setShowSafeModal] = useState(false);
  const [upgradeCalldata, setUpgradeCalldata] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Safe Modal states for adding collateral
  const [showAddCollateralSafeModal, setShowAddCollateralSafeModal] = useState(false);
  const [addCollateralCalldata, setAddCollateralCalldata] = useState<string>("");

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
      const collateralAddresses = await vaultContract.getCollateralList();
      
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
        // First check if the address has code
        const code = await provider.getCode(newTokenAddress);
        if (code === '0x') {
          setTransactionStatus("Error: Address has no contract code. Please verify the address and network.");
          setIsLoading(false);
          return;
        }
        
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
      } catch (error: any) {
        console.error("ERC20 verification error:", error);
        let errorMessage = "Error: Address is not a valid ERC20 token";
        
        // Provide more specific error messages
        if (error.message?.includes('network')) {
          errorMessage += ". Please check your network connection.";
        } else if (error.message?.includes('CALL_EXCEPTION')) {
          errorMessage += ". The contract doesn't implement ERC20 interface (symbol, name, decimals).";
        } else if (error.code === 'NETWORK_ERROR') {
          errorMessage += ". Network error - please try again.";
        } else if (error.message) {
          errorMessage += `. Details: ${error.message.slice(0, 100)}`;
        }
        
        // Get current network for debugging
        try {
          const network = await provider.getNetwork();
          errorMessage += ` (Network: ${network.name || network.chainId})`;
        } catch (e) {
          console.error("Could not get network info:", e);
        }
        
        setTransactionStatus(errorMessage);
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

      // Safe Integration: Check if user has UI access
      const uiControllerAddress = process.env.NEXT_PUBLIC_UI_CONTROLLER || 
        process.env.NEXT_PUBLIC_ADMIN_WALLET || 
        "0xA1D4de75082562eA776b160e605acD587668111B";
      const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS || uiControllerAddress;
      
      const hasUIAccess = address?.toLowerCase() === uiControllerAddress.toLowerCase();
      const isSafeConnected = address?.toLowerCase() === safeAddress.toLowerCase();
      
      // If UI Controller is connected but not Safe, show modal with transaction data
      if (hasUIAccess && !isSafeConnected && safeAddress !== uiControllerAddress) {
        console.log('=== ADD COLLATERAL SAFE TRANSACTION ===');
        console.log('Contract Address:', CONTRACT_ADDRESSES.VAULT);
        console.log('Function: addCollateral(address)');
        console.log('Token Address:', newTokenAddress);
        console.log('Token Symbol:', newTokenSymbol);
        console.log('Token Name:', newTokenName);
        
        // Encode the function call
        const calldata = encodeFunctionData({
          abi: ABIS.VAULT,
          functionName: 'addCollateral',
          args: [newTokenAddress as `0x${string}`]
        });
        
        setAddCollateralCalldata(calldata);
        setShowAddCollateralSafeModal(true);
        setIsLoading(false);
        return;
      }

      // Add collateral directly if Safe is connected
      const tx = await vaultContract.addCollateral(newTokenAddress);
      setTransactionStatus("Transaction submitted. Waiting for confirmation...");
      
      await tx.wait();
      
      setTransactionStatus(`✅ Successfully added ${newTokenSymbol} as collateral!`);
      
      // Clear inputs
      setNewTokenSymbol("");
      setNewTokenAddress("");
      setNewTokenName("");
      
      // Reload collaterals immediately
      await loadSupportedCollaterals();

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
      setTransactionStatus("Reading token details...");
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      
      // Check if address has code
      const code = await provider.getCode(newTokenAddress);
      if (code === '0x') {
        setTransactionStatus("Error: Address has no contract code. Please verify the address and connected network.");
        return;
      }
      
      const tokenContract = new ethers.Contract(newTokenAddress, ABIS.ERC20, provider);
      
      const [symbol, name] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.name()
      ]);

      setNewTokenSymbol(symbol);
      setNewTokenName(name);
      setTransactionStatus(`✓ Token details loaded: ${symbol} (${name})`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setTransactionStatus(""), 3000);
    } catch (error: any) {
      console.error("Auto-fill error:", error);
      let errorMessage = "Error: Could not read token details";
      
      if (error.message?.includes('CALL_EXCEPTION')) {
        errorMessage = "Error: Contract doesn't implement ERC20 interface. Not a valid ERC20 token.";
      } else if (error.message?.includes('network')) {
        errorMessage = "Error: Network issue. Please check your connection and try again.";
      } else if (error.message) {
        errorMessage += `. ${error.message.slice(0, 80)}`;
      }
      
      setTransactionStatus(errorMessage);
    }
  };

  // Helper function for copying to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Load current implementation when contract is selected
  useEffect(() => {
    if (selectedContract) {
      loadCurrentImplementation(selectedContract);
    }
  }, [selectedContract]);

  const loadCurrentImplementation = async (contractName: string) => {
    if (!isConnected || typeof window === "undefined" || !window.ethereum) {
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const proxyAdminAbi = [
        "function getProxyImplementation(address proxy) view returns (address)"
      ];
      const proxyAdmin = new ethers.Contract(
        CONTRACT_ADDRESSES.PROXY_ADMIN,
        proxyAdminAbi,
        provider
      );

      const proxyAddress = UPGRADEABLE_CONTRACTS.find(c => c.name === contractName)?.address;
      if (!proxyAddress) return;

      const implAddress = await proxyAdmin.getProxyImplementation(proxyAddress);
      setCurrentImplementation(implAddress);
    } catch (error) {
      console.error("Error loading implementation:", error);
      setCurrentImplementation("Unable to load");
    }
  };

  const handleGenerateUpgradeTx = async () => {
    if (!selectedContract || !newImplementation) {
      setTransactionStatus("Please select a contract and enter new implementation address");
      return;
    }

    if (!ethers.isAddress(newImplementation)) {
      setTransactionStatus("Invalid implementation address");
      return;
    }

    try {
      const proxyAddress = UPGRADEABLE_CONTRACTS.find(c => c.name === selectedContract)?.address;
      if (!proxyAddress) {
        setTransactionStatus("Contract not found");
        return;
      }

      // Encode the upgrade function call
      const proxyAdminAbi = [
        "function upgrade(address proxy, address implementation)"
      ];
      const iface = new ethers.Interface(proxyAdminAbi);
      const calldata = iface.encodeFunctionData("upgrade", [proxyAddress, newImplementation]);

      setUpgradeCalldata(calldata);
      setShowSafeModal(true);
    } catch (error: any) {
      console.error("Error generating transaction:", error);
      setTransactionStatus(`Error: ${error.message || "Failed to generate transaction"}`);
    }
  };

  // Upgradeable contracts list
  const UPGRADEABLE_CONTRACTS = [
    { name: "DevWallet", address: CONTRACT_ADDRESSES.DEV_WALLET },
    { name: "EndowmentWallet", address: CONTRACT_ADDRESSES.ENDOWMENT_WALLET },
    { name: "MerkleFeeCollector", address: CONTRACT_ADDRESSES.MERKLE_FEE_COLLECTOR },
    { name: "Vault", address: CONTRACT_ADDRESSES.VAULT },
    { name: "ChainlinkBTCOracle", address: CONTRACT_ADDRESSES.CHAINLINK_BTC_ORACLE },
    { name: "MerkleDistributor", address: CONTRACT_ADDRESSES.MERKLE_DISTRIBUTOR },
    { name: "WeeklyDistribution", address: CONTRACT_ADDRESSES.WEEKLY_DISTRIBUTION },
    { name: "EndowmentManager", address: CONTRACT_ADDRESSES.ENDOWMENT_MANAGER },
    { name: "ProtocolGovernance", address: CONTRACT_ADDRESSES.PROTOCOL_GOVERNANCE },
    { name: "DAO", address: CONTRACT_ADDRESSES.GOVERNANCE_DAO },
  ];

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
        <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto mb-8">
          <TabsTrigger 
            value="manage"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Manage Collateral
          </TabsTrigger>
          <TabsTrigger 
            value="proxy-upgrades"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
          >
            <Settings className="h-4 w-4 mr-2" />
            Proxy Upgrades
          </TabsTrigger>
          <TabsTrigger 
            value="btc1usd-timelock"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white"
          >
            <Lock className="h-4 w-4 mr-2" />
            BTC1USD Timelock
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

        {/* Proxy Upgrades Tab */}
        <TabsContent value="proxy-upgrades" className="space-y-6">
          <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-white">Proxy Upgrades (Safe Multisig)</CardTitle>
              </div>
              <CardDescription className="text-gray-400">
                Generate Safe transactions to upgrade contract implementations via ProxyAdmin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Shield className="h-5 w-5 text-purple-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-purple-300 text-sm font-medium">Safe Multisig Required</p>
                    <p className="text-purple-300/80 text-xs">
                      All proxy upgrades must be executed through the Safe multisig wallet.
                      This tool generates the transaction data you need to propose in Safe.
                    </p>
                  </div>
                </div>
              </div>

              {/* Contract Selector */}
              <div className="space-y-3">
                <Label className="text-gray-300 text-sm font-medium">
                  Select Contract to Upgrade
                </Label>
                <Select value={selectedContract} onValueChange={setSelectedContract}>
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                    <SelectValue placeholder="Choose an upgradeable contract..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {UPGRADEABLE_CONTRACTS.map((contract) => (
                      <SelectItem 
                        key={contract.name} 
                        value={contract.name}
                        className="text-white hover:bg-gray-700"
                      >
                        {contract.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Current Implementation */}
              {selectedContract && (
                <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-300">Proxy Address</p>
                      <code className="text-xs text-gray-400 font-mono break-all">
                        {UPGRADEABLE_CONTRACTS.find(c => c.name === selectedContract)?.address}
                      </code>
                    </div>
                  </div>
                  <div className="border-t border-gray-700 pt-2">
                    <p className="text-sm font-medium text-gray-300">Current Implementation</p>
                    <code className="text-xs text-gray-400 font-mono break-all">
                      {currentImplementation || "Loading..."}
                    </code>
                  </div>
                </div>
              )}

              {/* New Implementation Input */}
              <div className="space-y-3">
                <Label htmlFor="new-implementation" className="text-gray-300 text-sm font-medium">
                  New Implementation Address
                </Label>
                <Input
                  id="new-implementation"
                  type="text"
                  placeholder="0x..."
                  value={newImplementation}
                  onChange={(e) => setNewImplementation(e.target.value)}
                  className="bg-gray-900 border-2 border-gray-700 focus:border-purple-500 text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-500">
                  Enter the address of the new implementation contract
                </p>
              </div>

              {/* Generate Transaction Button */}
              <Button
                onClick={handleGenerateUpgradeTx}
                disabled={!isConnected || !selectedContract || !newImplementation}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold h-12 shadow-lg"
              >
                <Settings className="h-5 w-5 mr-2" />
                Generate Safe Transaction
              </Button>

              {/* Info Section */}
              <div className="border-t border-gray-700 pt-4">
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-300 mb-2">How it works:</p>
                  <ol className="text-xs text-blue-300/80 space-y-1 list-decimal list-inside">
                    <li>Select the contract you want to upgrade</li>
                    <li>Enter the new implementation contract address</li>
                    <li>Click "Generate Safe Transaction" to create the upgrade calldata</li>
                    <li>A modal will open with transaction details to paste into Safe</li>
                    <li>Propose the transaction in Safe and get required signatures</li>
                    <li>Execute the upgrade through Safe multisig</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BTC1USD Safe Timelock Tab */}
        <TabsContent value="btc1usd-timelock" className="space-y-6">
          <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Lock className="h-5 w-5 text-orange-400" />
                <CardTitle className="text-white">BTC1USD Timelock Management (Safe Multisig)</CardTitle>
              </div>
              <CardDescription className="text-gray-400">
                Manage Vault and WeeklyDistribution address changes with 2-day timelock using Safe multisig
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BTC1USDSafeTimelock isAdmin={isAdmin} />
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

      {/* Safe Transaction Modal - Custom Dialog matching Treasury Dashboard */}
      <Dialog open={showSafeModal} onOpenChange={setShowSafeModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-purple-950 to-gray-900 border-2 border-purple-500/70 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/50">
                <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-2xl font-bold text-white">
                  Upgrade {selectedContract}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-purple-200">
                  Safe Multi-Signature Transaction
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
            {/* Contract Address */}
            <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-2 border-green-500/50 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <Label className="text-xs sm:text-sm text-green-300 font-bold uppercase">1️⃣ ProxyAdmin Contract</Label>
                <Button
                  size="sm"
                  className="h-8 px-3 sm:px-4 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                  onClick={() => copyToClipboard(CONTRACT_ADDRESSES.PROXY_ADMIN, 'contract')}
                >
                  {copiedField === 'contract' ? (
                    <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                  ) : (
                    <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy</>
                  )}
                </Button>
              </div>
              <code className="text-xs sm:text-sm text-green-300 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto border border-green-500/40 break-all">
                {CONTRACT_ADDRESSES.PROXY_ADMIN}
              </code>
            </div>

            {/* Encoded Calldata */}
            <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-2 border-cyan-500/50 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <Label className="text-xs sm:text-sm text-cyan-300 font-bold uppercase">2️⃣ Encoded Calldata</Label>
                <Button
                  size="sm"
                  className="h-8 px-3 sm:px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                  onClick={() => copyToClipboard(upgradeCalldata, 'calldata')}
                >
                  {copiedField === 'calldata' ? (
                    <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                  ) : (
                    <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy Calldata</>
                  )}
                </Button>
              </div>
              <code className="text-xs sm:text-sm text-cyan-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-cyan-500/40 break-all">
                {upgradeCalldata || '0x...'}
              </code>
            </div>

            {/* Transaction Summary */}
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-600/50 rounded-lg p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Upgrade Summary</h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Function:</span>
                  <code className="text-purple-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">upgrade(address,address)</code>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Contract:</span>
                  <code className="text-white bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">{selectedContract}</code>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Proxy Address:</span>
                  <code className="text-xs text-green-200 bg-black/40 px-2 py-1 rounded font-mono max-w-full sm:max-w-[300px] truncate">
                    {UPGRADEABLE_CONTRACTS.find(c => c.name === selectedContract)?.address}
                  </code>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">New Implementation:</span>
                  <code className="text-xs text-blue-200 bg-black/40 px-2 py-1 rounded font-mono max-w-full sm:max-w-[300px] truncate">
                    {newImplementation}
                  </code>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Value:</span>
                  <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">0 ETH</code>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-t-2 border-purple-700 pt-3 sm:pt-4">
            <Button
              variant="outline"
              onClick={() => setShowSafeModal(false)}
              className="flex-1 border-2 border-gray-600 hover:bg-gray-800 text-gray-200 font-semibold h-10 sm:h-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const safeUrl = `https://app.safe.global/base:${process.env.NEXT_PUBLIC_SAFE_ADDRESS || CONTRACT_ADDRESSES.ADMIN}`;
                window.open(safeUrl, '_blank');
              }}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/40 border-2 border-purple-400/60 font-semibold h-10 sm:h-auto"
            >
              <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Open Safe UI
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Collateral Safe Modal */}
      <Dialog open={showAddCollateralSafeModal} onOpenChange={setShowAddCollateralSafeModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 border-2 border-blue-500/70 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/50">
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-2xl font-bold text-white">
                  Add Collateral Token
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-blue-200">
                  Safe Multi-Signature Transaction
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
            {/* Token Information */}
            <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border-2 border-blue-500/50 rounded-lg p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-blue-300 mb-3">Token Details</h3>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Symbol:</span>
                  <code className="text-white bg-black/40 px-2 py-1 rounded font-mono">{newTokenSymbol}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Name:</span>
                  <code className="text-white bg-black/40 px-2 py-1 rounded font-mono">{newTokenName}</code>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-gray-400">Address:</span>
                  <code className="text-xs text-green-200 bg-black/40 px-2 py-1 rounded font-mono break-all">
                    {newTokenAddress}
                  </code>
                </div>
              </div>
            </div>
            
            {/* Contract Address */}
            <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-2 border-green-500/50 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <Label className="text-xs sm:text-sm text-green-300 font-bold uppercase">1️⃣ Vault Contract</Label>
                <Button
                  size="sm"
                  className="h-8 px-3 sm:px-4 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                  onClick={() => copyToClipboard(CONTRACT_ADDRESSES.VAULT, 'vault-contract')}
                >
                  {copiedField === 'vault-contract' ? (
                    <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                  ) : (
                    <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy</>
                  )}
                </Button>
              </div>
              <code className="text-xs sm:text-sm text-green-300 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto border border-green-500/40 break-all">
                {CONTRACT_ADDRESSES.VAULT}
              </code>
            </div>

            {/* Encoded Calldata */}
            <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-2 border-cyan-500/50 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <Label className="text-xs sm:text-sm text-cyan-300 font-bold uppercase">2️⃣ Encoded Calldata</Label>
                <Button
                  size="sm"
                  className="h-8 px-3 sm:px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                  onClick={() => copyToClipboard(addCollateralCalldata, 'add-collateral-calldata')}
                >
                  {copiedField === 'add-collateral-calldata' ? (
                    <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                  ) : (
                    <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy Calldata</>
                  )}
                </Button>
              </div>
              <code className="text-xs sm:text-sm text-cyan-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-cyan-500/40 break-all">
                {addCollateralCalldata || '0x...'}
              </code>
            </div>

            {/* Transaction Summary */}
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-600/50 rounded-lg p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Transaction Summary</h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Function:</span>
                  <code className="text-blue-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">addCollateral(address)</code>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Target Contract:</span>
                  <code className="text-white bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">Vault</code>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Value:</span>
                  <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">0 ETH</code>
                </div>
              </div>
            </div>
            
            {/* Instructions */}
            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm font-medium text-purple-300 mb-2">How to Execute:</p>
              <ol className="text-xs text-purple-300/80 space-y-1 list-decimal list-inside">
                <li>Copy the Vault contract address above</li>
                <li>Copy the encoded calldata</li>
                <li>Open Safe UI and create a new transaction</li>
                <li>Paste the contract address as the "To" address</li>
                <li>Paste the calldata in the "Data" field</li>
                <li>Set value to 0 ETH</li>
                <li>Propose and execute the transaction with required signatures</li>
              </ol>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-t-2 border-blue-700 pt-3 sm:pt-4">
            <Button
              variant="outline"
              onClick={() => setShowAddCollateralSafeModal(false)}
              className="flex-1 border-2 border-gray-600 hover:bg-gray-800 text-gray-200 font-semibold h-10 sm:h-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const safeUrl = `https://app.safe.global/base:${process.env.NEXT_PUBLIC_SAFE_ADDRESS || CONTRACT_ADDRESSES.ADMIN}`;
                window.open(safeUrl, '_blank');
              }}
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/40 border-2 border-blue-400/60 font-semibold h-10 sm:h-auto"
            >
              <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Open Safe UI
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
