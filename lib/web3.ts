import { BrowserProvider, JsonRpcProvider, Signer, Contract, BigNumberish } from "ethers"
import { CONTRACT_ADDRESSES, ABIS, NETWORK_CONFIG } from "./contracts"
import { createProviderWithFallback, executeWithProviderFallback } from "./rpc-provider"
import * as ethers from "ethers"

// Type definitions for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, callback: (...args: any[]) => void) => void
      removeListener: (event: string, callback: (...args: any[]) => void) => void
    }
  }
}

// Web3 provider setup with fallback mechanism
export const getProvider = async () => {
  if (typeof window !== "undefined" && window.ethereum) {
    return new BrowserProvider(window.ethereum)
  }
  
  // For server-side usage, use fallback RPC providers
  try {
    return await createProviderWithFallback(8453, {
      timeout: 15000, // Increased timeout
      maxRetries: 3,
      retryDelay: 2000, // Increased delay
      backoffMultiplier: 2
    });
  } catch (error) {
    console.error("Failed to create provider with fallback:", error);
    // Final fallback to default provider
    return new JsonRpcProvider("https://mainnet.base.org", 8453);
  }
}

// Contract instances
export const getContracts = async (signer?: Signer) => {
  let provider: BrowserProvider | JsonRpcProvider;
  
  if (signer) {
    provider = signer.provider as BrowserProvider | JsonRpcProvider;
  } else {
    provider = await getProvider();
  }

  const providerOrSigner = signer || provider

  return {
    btc1usd: new Contract(CONTRACT_ADDRESSES.BTC1USD, ABIS.BTC1USD, providerOrSigner),
    vault: new Contract(CONTRACT_ADDRESSES.VAULT, ABIS.VAULT, providerOrSigner),
    priceOracle: new Contract(CONTRACT_ADDRESSES.CHAINLINK_BTC_ORACLE, ABIS.CHAINLINK_BTC_ORACLE, providerOrSigner),
    weeklyDistribution: new Contract(
      CONTRACT_ADDRESSES.WEEKLY_DISTRIBUTION,
      ABIS.WEEKLY_DISTRIBUTION,
      providerOrSigner,
    ),
  }
}

// Utility functions
export const formatEther = (value: BigNumberish) => {
  return ethers.formatEther(value)
}

export const parseEther = (value: string) => {
  return ethers.parseEther(value)
}

export const formatUnits = (value: BigNumberish, decimals: number) => {
  return ethers.formatUnits(value, decimals)
}

export const parseUnits = (value: string, decimals: number) => {
  return ethers.parseUnits(value, decimals)
}

// Wallet connection
export const connectWallet = async () => {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not installed")
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" })

    // Switch to Base Mainnet if not already connected
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}` }],
      })
    } catch (switchError: any) {
      // Chain doesn't exist, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}`,
              chainName: NETWORK_CONFIG.chainName,
              rpcUrls: [NETWORK_CONFIG.rpcUrl],
              blockExplorerUrls: [NETWORK_CONFIG.blockExplorer],
              nativeCurrency: NETWORK_CONFIG.nativeCurrency,
            },
          ],
        })
      }
    }

    const provider = await getProvider() as BrowserProvider;
    const signer = await provider.getSigner()
    const address = await signer.getAddress()

    return { provider, signer, address }
  } catch (error) {
    console.error("Failed to connect wallet:", error)
    throw error
  }
}

// Protocol interaction helpers
export const mintBTC1USD = async (signer: Signer, collateralToken: string, amount: string, decimals = 8) => {
  const contracts = await getContracts(signer)
  const collateralContract = new Contract(collateralToken, ABIS.ERC20, signer)

  const amountBN = parseUnits(amount, decimals)

  // Approve vault to spend collateral
  const approveTx = await collateralContract.approve(CONTRACT_ADDRESSES.VAULT, amountBN)
  await approveTx.wait()

  // Mint BTC1USD
  const mintTx = await contracts.vault.mint(collateralToken, amountBN)
  return await mintTx.wait()
}

export const redeemBTC1USD = async (signer: Signer, amount: string, collateralToken: string) => {
  const contracts = await getContracts(signer)
  const amountBN = parseUnits(amount, 8) // Use 8 decimals for BTC1USD
  
  const redeemTx = await contracts.vault.redeem(amountBN, collateralToken)
  return await redeemTx.wait()
}

export const getProtocolStats = async () => {
  try {
    return await executeWithProviderFallback(async (provider) => {
      const contracts = {
        btc1usd: new Contract(CONTRACT_ADDRESSES.BTC1USD, ABIS.BTC1USD, provider),
        vault: new Contract(CONTRACT_ADDRESSES.VAULT, ABIS.VAULT, provider),
        priceOracle: new Contract(CONTRACT_ADDRESSES.CHAINLINK_BTC_ORACLE, ABIS.CHAINLINK_BTC_ORACLE, provider),
        weeklyDistribution: new Contract(
          CONTRACT_ADDRESSES.WEEKLY_DISTRIBUTION,
          ABIS.WEEKLY_DISTRIBUTION,
          provider,
        ),
      }

      const [btcPrice, collateralRatio, totalSupply, collateralValue, isHealthy, canDistribute, nextDistribution] =
        await Promise.all([
          contracts.priceOracle.getBTCPrice(),
          contracts.vault.getCurrentCollateralRatio(),
          contracts.btc1usd.totalSupply(),
          contracts.vault.getTotalCollateralValue(),
          contracts.vault.isHealthy(),
          contracts.weeklyDistribution.canDistribute(),
          contracts.weeklyDistribution.getNextDistributionTime(),
        ])

      return {
        btcPrice: Number.parseFloat(ethers.formatUnits(btcPrice, 8)), // BTC price has 8 decimals
        collateralRatio: Number.parseFloat(ethers.formatUnits(collateralRatio, 8)), // Ratio has 8 decimals
        totalSupply: Number.parseFloat(ethers.formatUnits(totalSupply, 8)), // BTC1USD has 8 decimals
        collateralValue: Number.parseFloat(ethers.formatUnits(collateralValue, 8)), // USD value has 8 decimals
        isHealthy,
        canDistribute,
        nextDistribution: Number(nextDistribution),
      }
    }, 8453, { // Base Mainnet chain ID
      timeout: 15000, // Increased timeout
      maxRetries: 3,
      retryDelay: 2000,
      backoffMultiplier: 2
    });
  } catch (error) {
    console.error("Failed to fetch protocol stats:", error)
    throw error
  }
}