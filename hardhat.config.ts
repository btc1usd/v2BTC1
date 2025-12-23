import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      evmVersion: "shanghai", // Latest stable EVM version for Solidity 0.8.20
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    "base-sepolia": {
      // Use public RPC as primary to avoid rate limiting
      url: "https://sepolia.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
      timeout: 60000, // 60 seconds timeout (increased from default 20s)
      httpHeaders: {
        "Content-Type": "application/json",
      },
    },
    "base-sepolia-alchemy": {
      // Alchemy as fallback RPC
      url: process.env.ALCHEMY_API_KEY
        ? `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : "https://sepolia.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
      timeout: 60000,
    },
    "base-sepolia-infura": {
      // Infura as another fallback option
      url: process.env.INFURA_API_KEY
        ? `https://base-sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
        : "https://sepolia.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
      timeout: 60000,
    },
    "base-sepolia-pokt": {
      // Pokt Network as another fallback option
      url: "https://base-sepolia.gateway.pokt.network/v1/lb/62547375086761003a4a5695",
      accounts: process.env.DEPLOYER_PRIVATE_KEY? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
      timeout: 60000,
    },
    "base-sepolia-blockpi": {
      // BlockPI as another fallback option
      url: "https://base-sepolia.blockpi.network/v1/rpc/public",
      accounts: process.env.DEPLOYER_PRIVATE_KEY? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
      timeout: 60000,
    },
    "base-mainnet": {
      url: process.env.ALCHEMY_API_KEY
        ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : "https://mainnet.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 8453,
      timeout: 120000, // Increased timeout for mainnet
      gasPrice: "auto", // Let the network determine gas price
    },
  },
  etherscan: {
    apiKey: {
      "base-sepolia": process.env.BASESCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
      "base-mainnet": process.env.BASESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "base-mainnet",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};

export default config;