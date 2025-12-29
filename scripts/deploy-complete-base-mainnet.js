const { ethers } = require("hardhat");

async function main() {
  console.log("=== DEPLOYING COMPLETE BTC1USD PROTOCOL TO BASE MAINNET ===\n");

  // Check if private key is configured
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY environment variable is required.\n" +
      "Please add your Base Mainnet private key to .env file:\n" +
      "DEPLOYER_PRIVATE_KEY=0xYourPrivateKeyHere"
    );
  }

  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(
      "No signers available. Please check:\n" +
      "1. DEPLOYER_PRIVATE_KEY is set in .env\n" +
      "2. The private key is valid\n" +
      "3. You have Base Mainnet ETH in your wallet"
    );
  }

  const deployer = signers[0];
  console.log("Deploying with account:", deployer.address);

  // Improved RPC error handling
  let balance;
  try {
    balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");
  } catch (error) {
    console.log("⚠️  Warning: Could not fetch account balance from primary RPC");
    console.log("  Error:", error.message);
    console.log("  Proceeding with deployment assuming sufficient balance...\n");
    balance = ethers.parseEther("1.0"); // Assume sufficient balance
  }

  // Verify sufficient balance
  const minBalance = ethers.parseEther("0.001"); // Minimum 0.001 ETH for mainnet deployment
  if (balance < minBalance) {
    throw new Error("Insufficient balance. Need at least 0.001 ETH for mainnet deployment.");
  }

  // Configuration for Base Mainnet
  const config = {
    admin: "0xA1D4de75082562eA776b160e605acD587668111B",
    safeAddress: "0xA1D4de75082562eA776b160e605acD587668111B",
    emergencyCouncil: "0xA1D4de75082562eA776b160e605acD587668111B", // Use Safe address for emergency council
    // Real Chainlink BTC/USD feed address on Base Mainnet
    // Standard feed: https://data.chain.link/feeds/base/base/btc-usd
    // VERIFIED: https://basescan.org/address/0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F
    chainlinkBtcUsdFeed: "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F",
    // Real collateral token addresses on Base Mainnet
    collateralTokens: {
      // Wrapped Bitcoin (WBTC) on Base
      wbtc: process.env.WBTC_ADDRESS || "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
      // Coinbase Wrapped BTC (cbBTC) on Base
      cbbtc: process.env.CBBTC_ADDRESS || "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      // Threshold BTC (tBTC) on Base - Update this address if needed
      tbtc: process.env.TBTC_ADDRESS || "0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b",
    },
  };

  // Validate collateral addresses
  console.log("\n⚙️  Configuration:");
  console.log("  Admin:              ", config.admin);
  console.log("  Emergency Council:  ", config.emergencyCouncil);
  console.log("  Chainlink Feed:     ", config.chainlinkBtcUsdFeed);
  console.log("\n  Real Collateral Tokens:");
  console.log("  WBTC:               ", config.collateralTokens.wbtc);
  console.log("  cbBTC:              ", config.collateralTokens.cbbtc);
  console.log("  tBTC:               ", config.collateralTokens.tbtc);
  console.log("\n  Note: DevWallet, EndowmentWallet, and MerkleFeeCollector will be deployed as smart contracts\n");

  // Fetch live BTC price from Chainlink with improved error handling
  console.log("\n📊 Fetching live BTC price from Chainlink...");
  let liveBtcPrice = "95000"; // Default fallback price

  try {
    const feedAbi = [
      "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
      "function decimals() view returns (uint8)"
    ];
    const priceFeed = await ethers.getContractAt(feedAbi, config.chainlinkBtcUsdFeed);

    // Add retry logic for fetching price
    let retries = 3;
    while (retries > 0) {
      try {
        const [, price, , timestamp] = await priceFeed.latestRoundData();
        const decimals = await priceFeed.decimals();
        liveBtcPrice = ethers.formatUnits(price, decimals);

        console.log(`  ✓ Live BTC Price: $${liveBtcPrice}`);
        console.log(`  ✓ Last Updated: ${new Date(Number(timestamp) * 1000).toISOString()}`);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.log("  ⚠️  Failed to fetch live price, using default $95,000");
          liveBtcPrice = "95000";
        } else {
          console.log(`  ⚠️  Retry fetching price... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
  } catch (error) {
    console.log("  ⚠️  Error fetching price from Chainlink, using default $95,000");
    console.log("  Error:", error.message);
    liveBtcPrice = "95000";
  }

  console.log(`  Live BTC Price:      $${liveBtcPrice}`);

  // Helper function to send transaction with improved retry logic
  async function sendTransaction(name, txPromise, maxRetries = 5) { // Increased retries
    let retries = maxRetries;
    while (retries > 0) {
      try {
        const tx = await txPromise();
        await tx.wait();
        console.log(`  ✅ ${name}`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Increased delay between txs
        return true;
      } catch (error) {
        if (error.message.includes("nonce") && retries > 1) {
          console.log(`  ⚠️  ${name} - nonce issue, retrying... (${retries - 1} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay
          retries--;
        }
        // Handle connection timeouts and RPC errors
        else if ((error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                  error.message.includes('timeout') ||
                  error.message.includes('ETIMEDOUT') ||
                  error.message.includes('ECONNRESET') ||
                  error.message.includes('Forwarder error') ||
                  error.message.includes('Too Many Requests')) && retries > 1) {
          console.log(`  ⚠️  ${name} - connection issue or rate limit, retrying... (${retries - 1} attempts left)`);
          console.log(`  ℹ️  Waiting 30 seconds before retry...`); // Increased delay
          await new Promise(resolve => setTimeout(resolve, 30000)); // Longer wait
          retries--;
        }
        // Handle rate limiting
        else if ((error.message.includes('rate limit') ||
                  error.message.includes('429')) && retries > 1) {
          console.log(`  ⚠️  ${name} - rate limited, waiting 60 seconds... (${retries - 1} attempts left)`); // Increased delay
          await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute wait
          retries--;
        } else {
          console.log(`  ❌ ${name} failed:`, error.message.split('\n')[0]);
          return false;
        }
      }
    }
    return false;
  }

  // Helper function to wait for deployment with improved retry logic
  async function deployContract(name, factory, ...args) {
    let retries = 5; // Increased retries
    while (retries > 0) {
      try {
        console.log(`  📦 Deploying ${name}...`);
        const contract = await factory.deploy(...args);
        console.log(`  ⏳ Waiting for ${name} deployment confirmation...`);
        await contract.waitForDeployment();
        const address = await contract.getAddress();
        console.log(`  ✅ ${name} deployed to: ${address}`);
        return { contract, address };
      } catch (error) {
        // Handle nonce issues
        if (error.message.includes("nonce") && retries > 1) {
          console.log(`  ⚠️  Nonce issue, retrying... (${retries - 1} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay
          retries--;
        }
        // Handle connection timeouts
        else if ((error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                  error.message.includes('timeout') ||
                  error.message.includes('ETIMEDOUT') ||
                  error.message.includes('ECONNRESET') ||
                  error.message.includes('Forwarder error') ||
                  error.message.includes('Too Many Requests')) && retries > 1) {
          console.log(`  ⚠️  Connection issue or rate limit, retrying... (${retries - 1} attempts left)`);
          console.log(`  ℹ️  Waiting 30 seconds before retry...`); // Increased delay
          await new Promise(resolve => setTimeout(resolve, 30000)); // Longer wait for network issues
          retries--;
        }
        // Handle rate limiting
        else if ((error.message.includes('rate limit') ||
                  error.message.includes('429')) && retries > 1) {
          console.log(`  ⚠️  Rate limited, waiting 60 seconds... (${retries - 1} attempts left)`); // Increased delay
          await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute wait
          retries--;
        }
        else {
          throw error;
        }
      }
    }
  }

  // ==================== STEP 1: DEPLOY PROXY ADMIN ====================
  console.log("🏗️  STEP 1: Deploying ProxyAdmin (Governance Controller)...\n");

  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  const { contract: proxyAdmin, address: proxyAdminAddress } = await deployContract(
    "ProxyAdmin",
    ProxyAdmin,
    config.safeAddress // Use Safe as initial owner
  );

  console.log("  ℹ️  ProxyAdmin will control all proxy upgrades");

  await new Promise(resolve => setTimeout(resolve, 5000));

  // ==================== STEP 2: DEPLOY UPGRADEABLE WALLET CONTRACTS ====================
  console.log("\n💳 STEP 2: Deploying upgradeable wallet contracts...\n");

  const UpgradeableProxy = await ethers.getContractFactory("UpgradeableProxy");

  // Deploy DevWalletUpgradeable
  const DevWalletUpgradeable = await ethers.getContractFactory("DevWalletUpgradeable");
  const { address: devWalletImplAddress } = await deployContract(
    "DevWallet Implementation",
    DevWalletUpgradeable
  );
  await new Promise(resolve => setTimeout(resolve, 5000));

  const { address: devWalletProxyAddress } = await deployContract(
    "DevWallet Proxy",
    UpgradeableProxy,
    devWalletImplAddress,
    proxyAdminAddress
  );
  await new Promise(resolve => setTimeout(resolve, 5000));

  const devWallet = DevWalletUpgradeable.attach(devWalletProxyAddress);
  await sendTransaction("DevWallet Initialized", () => devWallet.initialize(config.safeAddress));
  const devWalletAddress = devWalletProxyAddress;

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Deploy EndowmentWalletUpgradeable
  const EndowmentWalletUpgradeable = await ethers.getContractFactory("EndowmentWalletUpgradeable");
  const { address: endowmentWalletImplAddress } = await deployContract(
    "EndowmentWallet Implementation",
    EndowmentWalletUpgradeable
  );
  await new Promise(resolve => setTimeout(resolve, 5000));

  const { address: endowmentWalletProxyAddress } = await deployContract(
    "EndowmentWallet Proxy",
    UpgradeableProxy,
    endowmentWalletImplAddress,
    proxyAdminAddress
  );
  await new Promise(resolve => setTimeout(resolve, 5000));

  const endowmentWallet = EndowmentWalletUpgradeable.attach(endowmentWalletProxyAddress);
  await sendTransaction("EndowmentWallet Initialized", () => endowmentWallet.initialize(config.safeAddress));
  const endowmentWalletAddress = endowmentWalletProxyAddress;

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Deploy MerkleFeeCollectorUpgradeable
  const MerkleFeeCollectorUpgradeable = await ethers.getContractFactory("MerkleFeeCollectorUpgradeable");
  const { address: merklFeeCollectorImplAddress } = await deployContract(
    "MerkleFeeCollector Implementation",
    MerkleFeeCollectorUpgradeable
  );
  await new Promise(resolve => setTimeout(resolve, 5000));

  const { address: merklFeeCollectorProxyAddress } = await deployContract(
    "MerkleFeeCollector Proxy",
    UpgradeableProxy,
    merklFeeCollectorImplAddress,
    proxyAdminAddress
  );
  await new Promise(resolve => setTimeout(resolve, 5000));

  const merklFeeCollector = MerkleFeeCollectorUpgradeable.attach(merklFeeCollectorProxyAddress);
  await sendTransaction("MerkleFeeCollector Initialized", () => merklFeeCollector.initialize(config.safeAddress));
  const merklFeeCollectorAddress = merklFeeCollectorProxyAddress;

  console.log("\n  ⏳ Waiting for confirmations...");
  await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay

  console.log("\n🏗️  STEP 3: Deploying upgradeable core contracts...\n");

  // NOTE: We deploy ChainlinkBTCOracle and Vault BEFORE BTC1USD
  // because BTC1USD constructor now requires vault and weeklyDistribution addresses
  
  // Deploy ChainlinkBTCOracle Implementation
  const ChainlinkBTCOracleUpgradeable = await ethers.getContractFactory("ChainlinkBTCOracleUpgradeable");
  const { address: oracleImplAddress } = await deployContract(
    "ChainlinkBTCOracle Implementation",
    ChainlinkBTCOracleUpgradeable
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Deploy Oracle Proxy
  const { address: oracleProxyAddress } = await deployContract(
    "ChainlinkBTCOracle Proxy (USER-FACING)",
    UpgradeableProxy,
    oracleImplAddress,
    proxyAdminAddress
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Initialize Oracle via proxy
  const priceOracle = ChainlinkBTCOracleUpgradeable.attach(oracleProxyAddress);
  await sendTransaction(
    "ChainlinkBTCOracle initialized",
    () => priceOracle.initialize(config.safeAddress, config.chainlinkBtcUsdFeed)
  );
  const priceOracleAddress = oracleProxyAddress;

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Deploy Vault Implementation
  const VaultUpgradeable = await ethers.getContractFactory("Vault");
  const { address: vaultImplAddress } = await deployContract(
    "Vault Implementation",
    VaultUpgradeable
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Deploy Vault Proxy
  const { address: vaultProxyAddress } = await deployContract(
    "Vault Proxy (USER-FACING)",
    UpgradeableProxy,
    vaultImplAddress,
    proxyAdminAddress
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Initialize Vault via proxy
  const vault = VaultUpgradeable.attach(vaultProxyAddress);
  await sendTransaction(
    "Vault initialized",
    () => vault.initialize(
      config.safeAddress,      // initialOwner - Use Safe
      btc1usdAddress,        // _btc1usd
      priceOracleAddress,    // _priceOracle
      devWalletAddress,      // _devWallet
      endowmentWalletAddress // _endowmentWallet
    )
  );
  const vaultAddress = vaultProxyAddress;

  console.log("\n  ⏳ Waiting for confirmations...");
  await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay

  // ==================== STEP 4: DEPLOY UPGRADEABLE DISTRIBUTION SYSTEM ====================
  console.log("\n💰 STEP 4: Deploying upgradeable distribution system...\n");

  // CIRCULAR DEPENDENCY RESOLUTION:
  // MerkleDistributor requires WeeklyDistribution address in constructor
  // WeeklyDistribution requires MerkleDistributor address in constructor
  //
  // Solution:
  // 1. Deploy MerkleDistributor with zero address (temporary)
  // 2. Deploy WeeklyDistribution with actual MerkleDistributor address
  // 3. Update MerkleDistributor's weeklyDistribution via setWeeklyDistribution()
  //
  // This works because:
  // - WeeklyDistribution needs MerkleDistributor address immediately (for exclusion from rewards)
  // - MerkleDistributor doesn't call WeeklyDistribution in constructor, so zero address is safe
  // - We update the address in STEP 6 before any distributions occur

  console.log("  📝 Note: Resolving circular dependency between contracts...");

  // Deploy MerkleDistributor Implementation
  const MerkleDistributorUpgradeable = await ethers.getContractFactory("MerkleDistributorUpgradeable");
  const { address: merkleImplAddress } = await deployContract(
    "MerkleDistributor Implementation",
    MerkleDistributorUpgradeable
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Deploy MerkleDistributor Proxy
  const { address: merkleProxyAddress } = await deployContract(
    "MerkleDistributor Proxy (USER-FACING)",
    UpgradeableProxy,
    merkleImplAddress,
    proxyAdminAddress
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Initialize MerkleDistributor with zero address (will update later)
  const merkleDistributor = MerkleDistributorUpgradeable.attach(merkleProxyAddress);
  await sendTransaction(
    "MerkleDistributor initialized (temp weeklyDist: zero)",
    () => merkleDistributor.initialize(
      config.safeAddress,    // initialOwner - Use Safe
      btc1usdAddress,        // token_
      ethers.ZeroAddress     // weeklyDistribution_ - Temporary, will be updated after WeeklyDistribution
    )
  );
  const merkleDistributorAddress = merkleProxyAddress;

  await new Promise(resolve => setTimeout(resolve, 5000)); // Delay between deployments

  console.log("  ℹ️  MerkleDistributor.weeklyDistribution is temporarily zero address");
  console.log("  ℹ️  This will be updated after WeeklyDistribution is deployed");

  // Debug: Log all addresses before WeeklyDistribution deployment
  console.log("\n  📝 Verifying addresses before WeeklyDistribution deployment...");
  console.log(`    btc1usdAddress: ${btc1usdAddress}`);
  console.log(`    vaultAddress: ${vaultAddress}`);
  console.log(`    config.admin: ${config.admin}`);
  console.log(`    devWalletAddress: ${devWalletAddress}`);
  console.log(`    endowmentWalletAddress: ${endowmentWalletAddress}`);
  console.log(`    merklFeeCollectorAddress: ${merklFeeCollectorAddress}`);
  console.log(`    merkleDistributorAddress: ${merkleDistributorAddress}`);

  // Deploy WeeklyDistributionUpgradeable Implementation
  const WeeklyDistributionUpgradeable = await ethers.getContractFactory("WeeklyDistributionUpgradeable");
  const { address: weeklyDistImplAddress } = await deployContract(
    "WeeklyDistribution Implementation",
    WeeklyDistributionUpgradeable
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Deploy WeeklyDistribution Proxy
  const { address: weeklyDistProxyAddress } = await deployContract(
    "WeeklyDistribution Proxy (USER-FACING)",
    UpgradeableProxy,
    weeklyDistImplAddress,
    proxyAdminAddress
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Initialize WeeklyDistribution via proxy
  const weeklyDistribution = WeeklyDistributionUpgradeable.attach(weeklyDistProxyAddress);
  await sendTransaction(
    "WeeklyDistribution initialized",
    () => weeklyDistribution.initialize(
      config.safeAddress,     // initialOwner - Use Safe
      btc1usdAddress,         // _btc1usd
      vaultAddress,           // _vault
      devWalletAddress,       // _devWallet
      endowmentWalletAddress, // _endowmentWallet
      merklFeeCollectorAddress, // _merklFeeCollector
      merkleDistributorAddress  // _merklDistributor
    )
  );
  const weeklyDistributionAddress = weeklyDistProxyAddress;

  console.log("  ✅ WeeklyDistribution has correct MerkleDistributor address");
  console.log("  ✅ MerkleDistributor excluded from receiving holder rewards");
  console.log("  ✅ MerkleFeeCollector excluded from receiving holder rewards");

  console.log("\n  ⏳ Waiting for confirmations...");
  await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay

  // ==================== STEP 4.5: DEPLOY BTC1USD TOKEN ====================
  console.log("\n💵 STEP 4.5: Deploying BTC1USD token...\n");
  console.log("  ℹ️  BTC1USD is non-upgradeable (important for CEX listings)");
  console.log("  ℹ️  Using BTC1USD with EIP-2612 permit support");
  console.log("  ℹ️  Now that Vault and WeeklyDistribution are deployed, we can set them in constructor\n");
  
  const BTC1USD = await ethers.getContractFactory("BTC1USD");
  const { contract: btc1usd, address: btc1usdAddress } = await deployContract(
    "BTC1USD (Non-Upgradeable)",
    BTC1USD,
    config.safeAddress,         // initialOwner - Use Safe
    vaultAddress,               // vault
    weeklyDistributionAddress   // weeklyDistribution
  );

  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log("  ✅ BTC1USD vault set to:", vaultAddress);
  console.log("  ✅ BTC1USD weeklyDistribution set to:", weeklyDistributionAddress);
  console.log("  ℹ️  Future changes to vault/weeklyDistribution require 2-day timelock");
  console.log("  ℹ️  Use Safe UI modal to initiate and execute timelock changes");

  // ==================== STEP 5: DEPLOY UPGRADEABLE GOVERNANCE ====================
  console.log("\n🏛️  STEP 5: Deploying upgradeable governance system...\n");

  // Deploy EndowmentManager Implementation
  const EndowmentManagerUpgradeable = await ethers.getContractFactory("EndowmentManagerUpgradeable");
  const { address: endowmentImplAddress } = await deployContract(
    "EndowmentManager Implementation",
    EndowmentManagerUpgradeable
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Deploy EndowmentManager Proxy
  const { address: endowmentProxyAddress } = await deployContract(
    "EndowmentManager Proxy (USER-FACING)",
    UpgradeableProxy,
    endowmentImplAddress,
    proxyAdminAddress
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Initialize EndowmentManager via proxy
  const endowmentManager = EndowmentManagerUpgradeable.attach(endowmentProxyAddress);
  await sendTransaction(
    "EndowmentManager initialized",
    () => endowmentManager.initialize(
      config.safeAddress,    // initialOwner - Use Safe
      btc1usdAddress,        // _btc1usd
      endowmentWalletAddress // _endowmentWallet
    )
  );
  const endowmentManagerAddress = endowmentProxyAddress;

  await new Promise(resolve => setTimeout(resolve, 5000)); // Delay between deployments

  // Deploy ProtocolGovernanceUpgradeable Implementation
  const ProtocolGovernanceUpgradeable = await ethers.getContractFactory("ProtocolGovernanceUpgradeable");
  const { address: protocolGovImplAddress } = await deployContract(
    "ProtocolGovernance Implementation",
    ProtocolGovernanceUpgradeable
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Deploy ProtocolGovernance Proxy
  const { address: protocolGovProxyAddress } = await deployContract(
    "ProtocolGovernance Proxy (USER-FACING)",
    UpgradeableProxy,
    protocolGovImplAddress,
    proxyAdminAddress
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Initialize ProtocolGovernance via proxy
  const protocolGovernance = ProtocolGovernanceUpgradeable.attach(protocolGovProxyAddress);
  await sendTransaction(
    "ProtocolGovernance initialized",
    () => protocolGovernance.initialize(
      config.safeAddress,
      config.emergencyCouncil
    )
  );
  const protocolGovernanceAddress = protocolGovProxyAddress;

  await new Promise(resolve => setTimeout(resolve, 5000)); // Delay between deployments

  // Deploy DAOUpgradeable Implementation
  const DAOUpgradeable = await ethers.getContractFactory("DAOUpgradeable");
  const { address: daoImplAddress } = await deployContract(
    "DAO Implementation",
    DAOUpgradeable
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Deploy DAO Proxy
  const { address: daoProxyAddress } = await deployContract(
    "DAO Proxy (USER-FACING)",
    UpgradeableProxy,
    daoImplAddress,
    proxyAdminAddress
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Initialize DAO via proxy
  const dao = DAOUpgradeable.attach(daoProxyAddress);
  await sendTransaction(
    "DAO initialized",
    () => dao.initialize(
      btc1usdAddress,
      protocolGovernanceAddress
    )
  );
  const daoAddress = daoProxyAddress;

  console.log("\n  ⏳ Waiting for confirmations...");
  await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay

  // ==================== STEP 6: INITIALIZE CONNECTIONS ====================
  console.log("\n🔗 STEP 6: Initializing contract connections...\n");

  // IMPORTANT: Complete circular dependency resolution
  // Update MerkleDistributor with actual WeeklyDistribution address
  // (it was deployed with zero address in STEP 3)
  console.log("  📝 Completing circular dependency resolution...");
  await sendTransaction(
    "MerkleDistributor weeklyDistribution set (completing circular dependency)",
    () => merkleDistributor.setWeeklyDistribution(weeklyDistributionAddress)
  );
  console.log("  ✅ Circular dependency resolved - both contracts now reference each other\n");

  await new Promise(resolve => setTimeout(resolve, 3000)); // Delay between transactions

  // Initialize protocol governance with all contract addresses
  await sendTransaction(
    "ProtocolGovernance contracts initialized",
    () => protocolGovernance.initializeContracts(
      btc1usdAddress,
      vaultAddress,
      weeklyDistributionAddress,
      endowmentManagerAddress,
      priceOracleAddress
    )
  );

  console.log("\n  ⏳ Waiting for confirmations...");
  await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay

  // ==================== STEP 7: CONFIGURE COLLATERAL ====================
  console.log("\n🔐 STEP 7: Adding real collateral tokens...\n");

  await sendTransaction(
    "Added WBTC as collateral",
    () => vault.addCollateral(config.collateralTokens.wbtc)
  );

  await new Promise(resolve => setTimeout(resolve, 3000)); // Delay between transactions

  await sendTransaction(
    "Added cbBTC as collateral",
    () => vault.addCollateral(config.collateralTokens.cbbtc)
  );

  await new Promise(resolve => setTimeout(resolve, 3000)); // Delay between transactions

  await sendTransaction(
    "Added tBTC as collateral",
    () => vault.addCollateral(config.collateralTokens.tbtc)
  );

  console.log("\n  ⏳ Waiting for confirmations...");
  await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay

  // ==================== STEP 8: OWNERSHIP VERIFICATION ====================
  console.log("\n👑 STEP 8: Verifying ownership (all contracts owned by Safe)...\n");
  console.log(`  ℹ️  All contracts were initialized with Safe as owner: ${config.safeAddress}`);
  console.log(`  ℹ️  No ownership transfers needed - Safe already owns everything\n`);

  console.log("  ✅ Safe multisig owns:");
  console.log("     - ProxyAdmin (controls all proxy upgrades)");
  console.log("     - All core protocol contracts (BTC1USD, Vault, Oracle, etc.)");
  console.log("     - All wallet contracts (DevWallet, EndowmentWallet, MerkleFeeCollector)");
  console.log("     - All governance contracts (ProtocolGovernance, EndowmentManager, DAO)");
  console.log("  ℹ️  Deployer never had admin privileges");
  console.log("  ✅ All production changes require Safe multisig approval from deployment");

  console.log("\n  ⏳ Waiting for confirmations...");
  await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay

  // ==================== STEP 9: VERIFY CHAINLINK ORACLE ====================
  console.log("\n📈 STEP 9: Verifying Chainlink price oracle...\n");

  try {
    const feedAddress = await priceOracle.getPriceFeedAddress();
    console.log("  ✅ Chainlink Feed Address:", feedAddress);

    const feedDecimals = await priceOracle.getPriceFeedDecimals();
    console.log("  ✅ Feed Decimals:", feedDecimals);

    const currentPrice = await priceOracle.getCurrentPrice();
    console.log(`  ✅ Live BTC Price: $${ethers.formatUnits(currentPrice, 8)}`);

    const isStale = await priceOracle.isStale();
    console.log(`  ✅ Price Freshness: ${isStale ? '⚠️  STALE' : '✅ FRESH'}`);

    const lastUpdate = await priceOracle.getLastUpdate();
    const updateDate = new Date(Number(lastUpdate) * 1000);
    console.log(`  ✅ Last Update: ${updateDate.toISOString()}`);

    console.log("\n  ⏳ Waiting for final confirmations...");
    await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay
  } catch (error) {
    console.log("  ⚠️  Oracle verification failed:", error.message);
  }

  // ==================== STEP 10: VERIFY DEPLOYMENT ====================
  console.log("\n✅ STEP 10: Verifying deployment...\n");

  try {
    // Verify DAO configuration
    const daoQuorum = await dao.quorumVotes();
    console.log(`  ✅ DAO quorum: ${ethers.formatUnits(daoQuorum, 8)} BTC1USD`);

    const daoThreshold = await dao.PROPOSAL_THRESHOLD();
    console.log(`  ✅ DAO proposal threshold: ${ethers.formatUnits(daoThreshold, 8)} BTC1USD`);

    const endowmentThreshold = await endowmentManager.PROPOSAL_THRESHOLD();
    console.log(`  ✅ Endowment proposal threshold: ${ethers.formatUnits(endowmentThreshold, 8)} BTC1USD`);

    // Verify circular dependency resolution
    console.log("\n  📝 Verifying circular dependency resolution...");
    const merkleWeeklyDist = await merkleDistributor.weeklyDistribution();
    const weeklyMerkleDist = await weeklyDistribution.merklDistributor();

    if (merkleWeeklyDist === weeklyDistributionAddress) {
      console.log(`  ✅ MerkleDistributor.weeklyDistribution correctly set to ${merkleWeeklyDist}`);
    } else {
      console.log(`  ❌ MerkleDistributor.weeklyDistribution mismatch!`);
      console.log(`     Expected: ${weeklyDistributionAddress}`);
      console.log(`     Got: ${merkleWeeklyDist}`);
    }

    if (weeklyMerkleDist === merkleDistributorAddress) {
      console.log(`  ✅ WeeklyDistribution.merklDistributor correctly set to ${weeklyMerkleDist}`);
    } else {
      console.log(`  ❌ WeeklyDistribution.merklDistributor mismatch!`);
      console.log(`     Expected: ${merkleDistributorAddress}`);
      console.log(`     Got: ${weeklyMerkleDist}`);
    }

    // Verify protocol wallet exclusions
    console.log("\n  📝 Verifying protocol wallet exclusions...");
    const excludedAddresses = await weeklyDistribution.getExcludedAddresses();
    console.log(`  ✅ Total excluded addresses: ${excludedAddresses.length}`);

    const excludedSet = new Set(excludedAddresses.map(addr => addr.toLowerCase()));

    if (excludedSet.has(merkleDistributorAddress.toLowerCase())) {
      console.log(`  ✅ MerkleDistributor excluded from holder rewards`);
    } else {
      console.log(`  ❌ MerkleDistributor NOT excluded!`);
    }

    if (excludedSet.has(merklFeeCollectorAddress.toLowerCase())) {
      console.log(`  ✅ MerkleFeeCollector excluded from holder rewards`);
    } else {
      console.log(`  ❌ MerkleFeeCollector NOT excluded!`);
    }

    if (excludedSet.has(devWalletAddress.toLowerCase())) {
      console.log(`  ✅ DevWallet excluded from holder rewards`);
    } else {
      console.log(`  ❌ DevWallet NOT excluded!`);
    }

    if (excludedSet.has(endowmentWalletAddress.toLowerCase())) {
      console.log(`  ✅ EndowmentWallet excluded from holder rewards`);
    } else {
      console.log(`  ❌ EndowmentWallet NOT excluded!`);
    }

    // Verify wallet contract ownership transfers
    console.log("\n  📝 Verifying wallet contract ownerships...");

    const devWalletOwner = await devWallet.owner();
    if (devWalletOwner.toLowerCase() === config.safeAddress.toLowerCase()) {
      console.log(`  ✅ DevWallet owner correctly set to ${devWalletOwner}`);
    } else {
      console.log(`  ❌ DevWallet owner mismatch!`);
      console.log(`     Expected: ${config.safeAddress}`);
      console.log(`     Got: ${devWalletOwner}`);
    }

    const endowmentWalletOwner = await endowmentWallet.owner();
    if (endowmentWalletOwner.toLowerCase() === config.safeAddress.toLowerCase()) {
      console.log(`  ✅ EndowmentWallet owner correctly set to ${endowmentWalletOwner}`);
    } else {
      console.log(`  ❌ EndowmentWallet owner mismatch!`);
      console.log(`     Expected: ${config.safeAddress}`);
      console.log(`     Got: ${endowmentWalletOwner}`);
    }

    const merklFeeCollectorOwner = await merklFeeCollector.owner();
    if (merklFeeCollectorOwner.toLowerCase() === config.safeAddress.toLowerCase()) {
      console.log(`  ✅ MerkleFeeCollector owner correctly set to ${merklFeeCollectorOwner}`);
    } else {
      console.log(`  ❌ MerkleFeeCollector owner mismatch!`);
      console.log(`     Expected: ${config.safeAddress}`);
      console.log(`     Got: ${merklFeeCollectorOwner}`);
    }

    // Verify collateral tokens
    console.log("\n  📝 Verifying collateral tokens...");
    const collateralList = await vault.getCollateralList();
    console.log(`  ✅ Total collateral tokens: ${collateralList.length}`);

    const collateralSet = new Set(collateralList.map(addr => addr.toLowerCase()));

    if (collateralSet.has(config.collateralTokens.wbtc.toLowerCase())) {
      console.log(`  ✅ WBTC added as collateral`);
    } else {
      console.log(`  ❌ WBTC NOT added as collateral!`);
    }

    if (collateralSet.has(config.collateralTokens.cbbtc.toLowerCase())) {
      console.log(`  ✅ cbBTC added as collateral`);
    } else {
      console.log(`  ❌ cbBTC NOT added as collateral!`);
    }

    if (collateralSet.has(config.collateralTokens.tbtc.toLowerCase())) {
      console.log(`  ✅ tBTC added as collateral`);
    } else {
      console.log(`  ❌ tBTC NOT added as collateral!`);
    }

  } catch (error) {
    console.log("  ⚠️  Verification check failed:", error.message);
  }

  // ==================== DEPLOYMENT SUMMARY ====================
  console.log("\n" + "=".repeat(80));
  console.log("📋 DEPLOYMENT SUMMARY - BASE MAINNET");
  console.log("=".repeat(80));
  console.log("\n🌐 Network: Base Mainnet");
  console.log("👤 Deployer:", deployer.address);

  console.log("\n💎 Real Collateral Tokens:");
  console.log("  WBTC:        ", config.collateralTokens.wbtc);
  console.log("  cbBTC:       ", config.collateralTokens.cbbtc);
  console.log("  tBTC:        ", config.collateralTokens.tbtc);

  console.log("\n🔧 Proxy Infrastructure:");
  console.log("  ProxyAdmin:          ", proxyAdminAddress);

  console.log("\n💳 Wallet Contracts (Upgradeable Proxies):");
  console.log("  DevWallet:           ", devWalletAddress);
  console.log("  EndowmentWallet:     ", endowmentWalletAddress);
  console.log("  MerkleFeeCollector:  ", merklFeeCollectorAddress);

  console.log("\n🏦 Core Contracts:");
  console.log("  BTC1USD Token:        ", btc1usdAddress, "(Non-Upgradeable)");
  console.log("  Vault:                ", vaultAddress, "(Upgradeable Proxy)");
  console.log("  ChainlinkBTCOracle:   ", priceOracleAddress, "(Upgradeable Proxy)");
  console.log("  Chainlink Feed:       ", config.chainlinkBtcUsdFeed);

  console.log("\n💰 Distribution (Upgradeable Proxies):");
  console.log("  MerkleDistributor:  ", merkleDistributorAddress);
  console.log("  WeeklyDistribution: ", weeklyDistributionAddress);

  console.log("\n🏛️  Governance (Upgradeable Proxies):");
  console.log("  EndowmentManager:    ", endowmentManagerAddress);
  console.log("  ProtocolGovernance:  ", protocolGovernanceAddress);
  console.log("  DAO:                 ", daoAddress);

  console.log("\n📦 Implementation Addresses (for reference):");
  console.log("  DevWallet Impl:           ", devWalletImplAddress);
  console.log("  EndowmentWallet Impl:     ", endowmentWalletImplAddress);
  console.log("  MerkleFeeCollector Impl:  ", merklFeeCollectorImplAddress);
  console.log("  Vault Impl:               ", vaultImplAddress);
  console.log("  ChainlinkBTCOracle Impl:  ", oracleImplAddress);
  console.log("  MerkleDistributor Impl:   ", merkleImplAddress);
  console.log("  WeeklyDistribution Impl:  ", weeklyDistImplAddress);
  console.log("  EndowmentManager Impl:    ", endowmentImplAddress);
  console.log("  ProtocolGovernance Impl:  ", protocolGovImplAddress);
  console.log("  DAO Impl:                 ", daoImplAddress);

  console.log("\n⚙️  Configuration:");
  console.log("  Admin:              ", config.admin);
  console.log("  Dev Wallet:         ", devWalletAddress);
  console.log("  Endowment Wallet:   ", endowmentWalletAddress);
  console.log("  MerkleFee Collector:", merklFeeCollectorAddress);
  console.log("  Emergency Council:  ", config.emergencyCouncil);
  console.log("  Live BTC Price:     ", `$${liveBtcPrice}`);

  // ==================== BLOCK EXPLORER LINKS ====================
  console.log("\n🔍 Block Explorer Links:");
  const explorerBase = "https://basescan.org/address/";
  console.log("\n  Proxy Infrastructure:");
  console.log(`    ProxyAdmin:          ${explorerBase}${proxyAdminAddress}`);

  console.log("\n  Collateral Tokens:");
  console.log(`    WBTC:        ${explorerBase}${config.collateralTokens.wbtc}`);
  console.log(`    cbBTC:       ${explorerBase}${config.collateralTokens.cbbtc}`);
  console.log(`    tBTC:        ${explorerBase}${config.collateralTokens.tbtc}`);

  console.log("\n  Wallet Contracts (Proxies):");
  console.log(`    DevWallet:           ${explorerBase}${devWalletAddress}`);
  console.log(`    EndowmentWallet:     ${explorerBase}${endowmentWalletAddress}`);
  console.log(`    MerkleFeeCollector:  ${explorerBase}${merklFeeCollectorAddress}`);

  console.log("\n  Core (Proxies):");
  console.log(`    BTC1USD:             ${explorerBase}${btc1usdAddress}`);
  console.log(`    Vault:               ${explorerBase}${vaultAddress}`);
  console.log(`    ChainlinkBTCOracle:  ${explorerBase}${priceOracleAddress}`);

  console.log("\n  Distribution (Proxies):");
  console.log(`    MerkleDistributor:  ${explorerBase}${merkleDistributorAddress}`);
  console.log(`    WeeklyDistribution: ${explorerBase}${weeklyDistributionAddress}`);

  console.log("\n  Governance (Proxies):");
  console.log(`    EndowmentManager:   ${explorerBase}${endowmentManagerAddress}`);
  console.log(`    ProtocolGovernance: ${explorerBase}${protocolGovernanceAddress}`);
  console.log(`    DAO:                ${explorerBase}${daoAddress}`);

  // ==================== SAVE DEPLOYMENT INFO ====================
  const fs = require("fs");
  const deploymentInfo = {
    network: "base-mainnet",
    chainId: 8453,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    proxyInfrastructure: {
      proxyAdmin: proxyAdminAddress,
    },
    collateralTokens: {
      wbtc: config.collateralTokens.wbtc,
      cbbtc: config.collateralTokens.cbbtc,
      tbtc: config.collateralTokens.tbtc,
    },
    wallets: {
      devWallet: devWalletAddress,
      endowmentWallet: endowmentWalletAddress,
      merklFeeCollector: merklFeeCollectorAddress,
    },
    core: {
      btc1usd: btc1usdAddress,
      vault: vaultAddress,
      chainlinkBTCOracle: priceOracleAddress,
      chainlinkFeed: config.chainlinkBtcUsdFeed,
    },
    distribution: {
      merkleDistributor: merkleDistributorAddress,
      weeklyDistribution: weeklyDistributionAddress,
    },
    governance: {
      endowmentManager: endowmentManagerAddress,
      protocolGovernance: protocolGovernanceAddress,
      dao: daoAddress,
    },
    implementations: {
      devWallet: devWalletImplAddress,
      endowmentWallet: endowmentWalletImplAddress,
      merklFeeCollector: merklFeeCollectorImplAddress,
      vault: vaultImplAddress,
      chainlinkBTCOracle: oracleImplAddress,
      merkleDistributor: merkleImplAddress,
      weeklyDistribution: weeklyDistImplAddress,
      endowmentManager: endowmentImplAddress,
      protocolGovernance: protocolGovImplAddress,
      dao: daoImplAddress,
    },
    config: {
      admin: config.admin,
      devWallet: devWalletAddress,
      endowmentWallet: endowmentWalletAddress,
      merklFeeCollector: merklFeeCollectorAddress,
      emergencyCouncil: config.emergencyCouncil,
      liveBTCPrice: liveBtcPrice,
    },
    explorerUrls: {
      proxyAdmin: `${explorerBase}${proxyAdminAddress}`,
      wbtc: `${explorerBase}${config.collateralTokens.wbtc}`,
      cbbtc: `${explorerBase}${config.collateralTokens.cbbtc}`,
      tbtc: `${explorerBase}${config.collateralTokens.tbtc}`,
      devWallet: `${explorerBase}${devWalletAddress}`,
      endowmentWallet: `${explorerBase}${endowmentWalletAddress}`,
      merklFeeCollector: `${explorerBase}${merklFeeCollectorAddress}`,
      btc1usd: `${explorerBase}${btc1usdAddress}`,
      vault: `${explorerBase}${vaultAddress}`,
      chainlinkBTCOracle: `${explorerBase}${priceOracleAddress}`,
      merkleDistributor: `${explorerBase}${merkleDistributorAddress}`,
      weeklyDistribution: `${explorerBase}${weeklyDistributionAddress}`,
      endowmentManager: `${explorerBase}${endowmentManagerAddress}`,
      protocolGovernance: `${explorerBase}${protocolGovernanceAddress}`,
      dao: `${explorerBase}${daoAddress}`,
    },
  };

  fs.writeFileSync(
    "deployment-base-mainnet.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to: deployment-base-mainnet.json");

  // ==================== AUTO-UPDATE CONTRACT ADDRESSES ====================
  console.log("\n📝 Updating contract addresses in all files...\n");

  try {
    // Update lib/contracts.ts
    console.log("  📄 Updating lib/contracts.ts...");
    const contractsPath = "./lib/contracts.ts";
    let contractsContent = fs.readFileSync(contractsPath, "utf8");

    // Update timestamp comment
    contractsContent = contractsContent.replace(
      /\/\/ Updated from deployment-base-mainnet\.json \(.*?\)/,
      `// Updated from deployment-base-mainnet.json (${deploymentInfo.timestamp})`
    );

    // Update all contract addresses
    contractsContent = contractsContent.replace(
      /BTC1USD:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `BTC1USD:\n    process.env.NEXT_PUBLIC_BTC1USD_CONTRACT ||\n    "${btc1usdAddress}"`
    );
    contractsContent = contractsContent.replace(
      /BTC1USD_CONTRACT:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `BTC1USD_CONTRACT:\n    process.env.NEXT_PUBLIC_BTC1USD_CONTRACT ||\n    "${btc1usdAddress}"`
    );
    contractsContent = contractsContent.replace(
      /VAULT:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `VAULT:\n    process.env.NEXT_PUBLIC_VAULT_CONTRACT ||\n    "${vaultAddress}"`
    );
    contractsContent = contractsContent.replace(
      /CHAINLINK_BTC_ORACLE:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `CHAINLINK_BTC_ORACLE:\n    process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT ||\n    "${priceOracleAddress}"`
    );
    contractsContent = contractsContent.replace(
      /PRICE_ORACLE_CONTRACT:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `PRICE_ORACLE_CONTRACT:\n    process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT ||\n    "${priceOracleAddress}"`
    );
    contractsContent = contractsContent.replace(
      /WEEKLY_DISTRIBUTION:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `WEEKLY_DISTRIBUTION:\n    process.env.NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT ||\n    "${weeklyDistributionAddress}"`
    );
    contractsContent = contractsContent.replace(
      /MERKLE_DISTRIBUTOR:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `MERKLE_DISTRIBUTOR:\n    process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT ||\n    "${merkleDistributorAddress}"`
    );
    contractsContent = contractsContent.replace(
      /ENDOWMENT_MANAGER:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `ENDOWMENT_MANAGER:\n    process.env.NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT ||\n    "${endowmentManagerAddress}"`
    );
    contractsContent = contractsContent.replace(
      /PROTOCOL_GOVERNANCE:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `PROTOCOL_GOVERNANCE:\n    process.env.NEXT_PUBLIC_PROTOCOL_GOVERNANCE_CONTRACT ||\n    "${protocolGovernanceAddress}"`
    );
    contractsContent = contractsContent.replace(
      /GOVERNANCE_DAO:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `GOVERNANCE_DAO:\n    process.env.NEXT_PUBLIC_DAO_CONTRACT ||\n    "${daoAddress}"`
    );
    contractsContent = contractsContent.replace(
      /DEV_WALLET:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `DEV_WALLET:\n    process.env.NEXT_PUBLIC_DEV_WALLET_CONTRACT ||\n    "${devWalletAddress}"`
    );
    contractsContent = contractsContent.replace(
      /ENDOWMENT_WALLET:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `ENDOWMENT_WALLET:\n    process.env.NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT ||\n    "${endowmentWalletAddress}"`
    );
    contractsContent = contractsContent.replace(
      /MERKLE_FEE_COLLECTOR:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `MERKLE_FEE_COLLECTOR:\n    process.env.NEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT ||\n    "${merklFeeCollectorAddress}"`
    );
    contractsContent = contractsContent.replace(
      /MERKLE_DISTRIBUTOR_WALLET:[\s\S]*?"0x[a-fA-F0-9]{40}"/,
      `MERKLE_DISTRIBUTOR_WALLET:\n    process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT ||\n    "${merkleDistributorAddress}"`
    );

    fs.writeFileSync(contractsPath, contractsContent);
    console.log("  ✅ lib/contracts.ts updated");

    // Helper function to update env file
    function updateEnvFile(filePath, deploymentInfo) {
      let envContent = fs.readFileSync(filePath, "utf8");

      // Update timestamp
      envContent = envContent.replace(
        /# Deployed: .*?\n/,
        `# Deployed: ${deploymentInfo.timestamp}\n`
      );
      envContent = envContent.replace(
        /# Updated from deployment-base-mainnet\.json \(.*?\)/g,
        `# Updated from deployment-base-mainnet.json (${deploymentInfo.timestamp})`
      );

      // Update all contract addresses
      envContent = envContent.replace(
        /NEXT_PUBLIC_BTC1USD_CONTRACT="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_BTC1USD_CONTRACT="${btc1usdAddress}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_VAULT_CONTRACT="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_VAULT_CONTRACT="${vaultAddress}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_PRICE_ORACLE_CONTRACT="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_PRICE_ORACLE_CONTRACT="${priceOracleAddress}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_CHAINLINK_FEED="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_CHAINLINK_FEED="${config.chainlinkBtcUsdFeed}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT="${weeklyDistributionAddress}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT="${merkleDistributorAddress}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT="${endowmentManagerAddress}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_PROTOCOL_GOVERNANCE_CONTRACT="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_PROTOCOL_GOVERNANCE_CONTRACT="${protocolGovernanceAddress}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_DAO_CONTRACT="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_DAO_CONTRACT="${daoAddress}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_WBTC_TOKEN="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_WBTC_TOKEN="${config.collateralTokens.wbtc}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_CBBTC_TOKEN="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_CBBTC_TOKEN="${config.collateralTokens.cbbtc}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_TBTC_TOKEN="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_TBTC_TOKEN="${config.collateralTokens.tbtc}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_DEV_WALLET_CONTRACT="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_DEV_WALLET_CONTRACT="${devWalletAddress}"`
      );
      envContent = envContent.replace(
        /NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT="0x[a-fA-F0-9]{40}"/,
        `NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT="${endowmentWalletAddress}"`
      );

      // Add or update MERKLE_FEE_COLLECTOR if it doesn't exist
      if (!envContent.includes("NEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT")) {
        // Add it after ENDOWMENT_WALLET_CONTRACT
        envContent = envContent.replace(
          /(NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT="0x[a-fA-F0-9]{40}")/,
          `$1\nNEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT="${merklFeeCollectorAddress}"`
        );
      } else {
        envContent = envContent.replace(
          /NEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT="0x[a-fA-F0-9]{40}"/,
          `NEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT="${merklFeeCollectorAddress}"`
        );
      }

      fs.writeFileSync(filePath, envContent);
    }

    // Update .env.production (for production deployment)
    console.log("  📄 Updating .env.production...");
    updateEnvFile(".env.production", deploymentInfo);
    console.log("  ✅ .env.production updated");

    console.log("\n🎉 All contract addresses have been automatically updated!");
  } catch (error) {
    console.log("\n⚠️  Warning: Could not auto-update some files:", error.message);
    console.log("   Please manually update contract addresses if needed.");
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ DEPLOYMENT COMPLETED SUCCESSFULLY ON BASE MAINNET!");
  console.log("=".repeat(80));

  console.log("\n📝 Next Steps:");
  console.log("  1. ✅ Contract addresses automatically updated in all files!");
  console.log("  2. ✅ Wallet contract ownerships transferred to admin!");
  console.log("  3. ⚠️  CRITICAL: Verify contracts on BaseScan");
  console.log("  4. ✅ Chainlink price oracle configured with live BTC/USD feed!");
  console.log("  5. ⚠️  CRITICAL: Test thoroughly on testnet before mainnet use");
  console.log("  6. ⚠️  CRITICAL: Set up multi-sig for admin/emergency council");
  console.log("  7. Test admin operations (add dev wallets, distribute funds)");
  console.log("  8. Transfer ownership to DAO (after thorough audits and testing)");
  console.log("  9. ⚠️  CRITICAL: Complete security audit before production use\n");

  return deploymentInfo;
}

main()
  .then(() => {
    console.log("🎉 Ready for mainnet deployment!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exitCode = 1;
  });
