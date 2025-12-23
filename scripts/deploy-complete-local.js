const { ethers } = require("hardhat");

async function main() {
  console.log("=== DEPLOYING COMPLETE BTC1USD PROTOCOL TO LOCAL NETWORK ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance));

  // Configuration
  const config = {
    admin: deployer.address,
    devWallet: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    endowmentWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    emergencyCouncil: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    initialBTCPrice: ethers.parseUnits("65000", 8), // $65,000 with 8 decimals
  };

  // ==================== STEP 1: DEPLOY MOCK TOKENS ====================
  console.log("\n📦 STEP 1: Deploying mock tokens...");

  const MockWBTC = await ethers.getContractFactory("MockWBTC");
  const mockWBTC = await MockWBTC.deploy(deployer.address);
  await mockWBTC.waitForDeployment();
  const mockWBTCAddress = await mockWBTC.getAddress();
  console.log("  ✓ MockWBTC deployed to:", mockWBTCAddress);

  const MockCBTC = await ethers.getContractFactory("MockERC20");
  const mockCBTC = await MockCBTC.deploy("Coinbase Wrapped BTC", "cbBTC", 8);
  await mockCBTC.waitForDeployment();
  const mockCBTCAddress = await mockCBTC.getAddress();
  console.log("  ✓ MockCBTC deployed to:", mockCBTCAddress);

  const MockTBTC = await ethers.getContractFactory("MockERC20");
  const mockTBTC = await MockTBTC.deploy("Threshold BTC", "tBTC", 8);
  await mockTBTC.waitForDeployment();
  const mockTBTCAddress = await mockTBTC.getAddress();
  console.log("  ✓ MockTBTC deployed to:", mockTBTCAddress);

  // ==================== STEP 2: DEPLOY CORE CONTRACTS ====================
  console.log("\n🏗️  STEP 2: Deploying core contracts...");

  // Deploy BTC1USD token
  const BTC1USD = await ethers.getContractFactory("BTC1USD");
  const btc1usd = await BTC1USD.deploy(config.admin);
  await btc1usd.waitForDeployment();
  const btc1usdAddress = await btc1usd.getAddress();
  console.log("  ✓ BTC1USD deployed to:", btc1usdAddress);

  // Deploy Price Oracle
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(config.admin, config.initialBTCPrice);
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();
  console.log("  ✓ PriceOracle deployed to:", priceOracleAddress);

  // Deploy Vault
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(
    btc1usdAddress,
    priceOracleAddress,
    config.admin,
    config.devWallet,
    config.endowmentWallet,
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("  ✓ Vault deployed to:", vaultAddress);

  // ==================== STEP 3: DEPLOY DISTRIBUTION SYSTEM ====================
  console.log("\n💰 STEP 3: Deploying distribution system...");

  // Deploy MerkleDistributor first
  const MerkleDistributor = await ethers.getContractFactory("MerkleDistributor");
  const merkleDistributor = await MerkleDistributor.deploy(
    config.admin, // initialOwner for Ownable
    btc1usdAddress,
    config.admin,
    "0x0000000000000000000000000000000000000000" // Temporary, will be updated
  );
  await merkleDistributor.waitForDeployment();
  const merkleDistributorAddress = await merkleDistributor.getAddress();
  console.log("  ✓ MerkleDistributor deployed to:", merkleDistributorAddress);

  // Deploy Weekly Distribution
  const WeeklyDistribution = await ethers.getContractFactory("WeeklyDistribution");
  const weeklyDistribution = await WeeklyDistribution.deploy(
    btc1usdAddress,
    vaultAddress,
    config.admin,
    config.devWallet,
    config.endowmentWallet,
    merkleDistributorAddress,
  );
  await weeklyDistribution.waitForDeployment();
  const weeklyDistributionAddress = await weeklyDistribution.getAddress();
  console.log("  ✓ WeeklyDistribution deployed to:", weeklyDistributionAddress);

  // ==================== STEP 4: DEPLOY GOVERNANCE ====================
  console.log("\n🏛️  STEP 4: Deploying governance system...");

  // Deploy Endowment Manager
  const EndowmentManager = await ethers.getContractFactory("EndowmentManager");
  const endowmentManager = await EndowmentManager.deploy(
    btc1usdAddress,
    config.admin,
    config.endowmentWallet
  );
  await endowmentManager.waitForDeployment();
  const endowmentManagerAddress = await endowmentManager.getAddress();
  console.log("  ✓ EndowmentManager deployed to:", endowmentManagerAddress);

  // Deploy Protocol Governance
  const ProtocolGovernance = await ethers.getContractFactory("ProtocolGovernance");
  const protocolGovernance = await ProtocolGovernance.deploy(
    config.admin,
    config.emergencyCouncil
  );
  await protocolGovernance.waitForDeployment();
  const protocolGovernanceAddress = await protocolGovernance.getAddress();
  console.log("  ✓ ProtocolGovernance deployed to:", protocolGovernanceAddress);

  // Deploy DAO
  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(btc1usdAddress, protocolGovernanceAddress);
  await dao.waitForDeployment();
  const daoAddress = await dao.getAddress();
  console.log("  ✓ DAO deployed to:", daoAddress);

  // ==================== STEP 5: INITIALIZE CONNECTIONS ====================
  console.log("\n🔗 STEP 5: Initializing contract connections...");

  await btc1usd.setVault(vaultAddress);
  console.log("  ✓ BTC1USD vault set");

  await btc1usd.setWeeklyDistribution(weeklyDistributionAddress);
  console.log("  ✓ BTC1USD weeklyDistribution set");

  await merkleDistributor.setWeeklyDistribution(weeklyDistributionAddress);
  console.log("  ✓ MerkleDistributor weeklyDistribution set");

  await protocolGovernance.initializeContracts(
    btc1usdAddress,
    vaultAddress,
    weeklyDistributionAddress,
    endowmentManagerAddress,
    priceOracleAddress,
  );
  console.log("  ✓ ProtocolGovernance contracts initialized");

  // ==================== STEP 6: CONFIGURE COLLATERAL ====================
  console.log("\n🔐 STEP 6: Adding collateral tokens...");

  await vault.addCollateral(mockWBTCAddress);
  console.log("  ✓ Added MockWBTC as collateral");

  await vault.addCollateral(mockCBTCAddress);
  console.log("  ✓ Added MockCBTC as collateral");

  await vault.addCollateral(mockTBTCAddress);
  console.log("  ✓ Added MockTBTC as collateral");

  // ==================== STEP 7: MINT TEST TOKENS ====================
  console.log("\n🪙  STEP 7: Minting test tokens...");

  const testAmount = ethers.parseUnits("100", 8); // 100 tokens with 8 decimals

  await mockWBTC.mint(deployer.address, testAmount);
  console.log("  ✓ Minted 100 WBTC to deployer");

  await mockCBTC.mint(deployer.address, testAmount);
  console.log("  ✓ Minted 100 cbBTC to deployer");

  await mockTBTC.mint(deployer.address, testAmount);
  console.log("  ✓ Minted 100 tBTC to deployer");

  // ==================== STEP 8: CONFIGURE PRICE ORACLE ====================
  console.log("\n📈 STEP 8: Configuring price oracle...");

  await priceOracle.setPriceFeeder(deployer.address);
  console.log("  ✓ Deployer set as price feeder");

  const freshPrice = ethers.parseUnits("65000", 8);
  await priceOracle.setBTCPrice(freshPrice);
  console.log("  ✓ BTC price set to $65,000");

  const currentPrice = await priceOracle.getCurrentPrice();
  console.log(`  ✓ Current BTC price verified: $${ethers.formatUnits(currentPrice, 8)}`);

  // ==================== STEP 9: VERIFY ENHANCED FEATURES ====================
  console.log("\n✅ STEP 9: Verifying enhanced features...");

  try {
    await merkleDistributor.getAllDistributionIds();
    console.log("  ✓ MerkleDistributor enhanced functions available");

    const daoQuorum = await dao.quorumVotes();
    console.log(`  ✓ DAO quorum: ${ethers.formatUnits(daoQuorum, 8)} BTC1USD`);

    const daoThreshold = await dao.PROPOSAL_THRESHOLD();
    console.log(`  ✓ DAO proposal threshold: ${ethers.formatUnits(daoThreshold, 8)} BTC1USD`);
  } catch (error) {
    console.log("  ⚠️  Enhanced features verification failed:", error.message);
  }

  // ==================== DEPLOYMENT SUMMARY ====================
  console.log("\n" + "=".repeat(80));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(80));
  console.log("\n🌐 Network: Hardhat Local Network");
  console.log("👤 Deployer:", deployer.address);

  console.log("\n💎 Mock Tokens:");
  console.log("  MockWBTC:        ", mockWBTCAddress);
  console.log("  MockCBTC:        ", mockCBTCAddress);
  console.log("  MockTBTC:        ", mockTBTCAddress);

  console.log("\n🏦 Core Contracts:");
  console.log("  BTC1USD Token:   ", btc1usdAddress);
  console.log("  Vault:           ", vaultAddress);
  console.log("  Price Oracle:    ", priceOracleAddress);

  console.log("\n💰 Distribution:");
  console.log("  MerkleDistributor:  ", merkleDistributorAddress);
  console.log("  WeeklyDistribution: ", weeklyDistributionAddress);

  console.log("\n🏛️  Governance:");
  console.log("  EndowmentManager:    ", endowmentManagerAddress);
  console.log("  ProtocolGovernance:  ", protocolGovernanceAddress);
  console.log("  DAO:                 ", daoAddress);

  console.log("\n⚙️  Configuration:");
  console.log("  Admin:            ", config.admin);
  console.log("  Dev Wallet:       ", config.devWallet);
  console.log("  Endowment Wallet: ", config.endowmentWallet);
  console.log("  Emergency Council:", config.emergencyCouncil);
  console.log("  Initial BTC Price: $65,000");

  // ==================== SAVE DEPLOYMENT INFO ====================
  const fs = require("fs");
  const deploymentInfo = {
    network: "hardhat-local",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    mockTokens: {
      wbtc: mockWBTCAddress,
      cbbtc: mockCBTCAddress,
      tbtc: mockTBTCAddress,
    },
    core: {
      btc1usd: btc1usdAddress,
      vault: vaultAddress,
      priceOracle: priceOracleAddress,
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
    config: {
      admin: config.admin,
      devWallet: config.devWallet,
      endowmentWallet: config.endowmentWallet,
      emergencyCouncil: config.emergencyCouncil,
      initialBTCPrice: "65000",
    },
  };

  fs.writeFileSync(
    "deployment-local.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to: deployment-local.json");

  console.log("\n" + "=".repeat(80));
  console.log("✅ DEPLOYMENT COMPLETED SUCCESSFULLY!");
  console.log("=".repeat(80) + "\n");

  // ==================== SETUP PERIODIC PRICE UPDATES ====================
  console.log("🔄 Setting up periodic price updates (every 10 minutes)...");

  const updatePricePeriodically = async () => {
    try {
      const currentPrice = await priceOracle.getCurrentPrice();
      const variation = Math.random() * 0.02 - 0.01; // -1% to +1%
      const newPrice = (currentPrice * BigInt(Math.floor((1 + variation) * 10000))) / BigInt(10000);

      await priceOracle.setBTCPrice(newPrice);
      console.log(`📊 Price refreshed: $${ethers.formatUnits(newPrice, 8)} (${(variation * 100).toFixed(2)}%)`);
    } catch (error) {
      console.log("⚠️  Price refresh failed:", error.message);
    }
  };

  setInterval(updatePricePeriodically, 10 * 60 * 1000);
  console.log("✓ Periodic price updates scheduled\n");

  return deploymentInfo;
}

main()
  .then(() => {
    console.log("🎉 Ready for testing!");
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exitCode = 1;
  });
