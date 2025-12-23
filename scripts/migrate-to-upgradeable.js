const hre = require("hardhat");
const fs = require("fs");

/**
 * MIGRATION SCRIPT: Transition from Non-Upgradeable to Upgradeable Architecture
 * 
 * STRATEGY:
 * 1. Deploy new upgradeable system (BTC1USD + Vault with proxies)
 * 2. Snapshot balances from old BTC1USD
 * 3. Pause old contracts
 * 4. Admin manually mints equivalent balances in new contract
 * 5. Update all integrations to new addresses
 * 
 * CRITICAL REQUIREMENTS:
 * - Must be run by admin wallet
 * - Requires coordination with users
 * - Front-end must be updated simultaneously
 * - Consider announcing migration window
 */

async function main() {
  console.log("🔄 MIGRATION: Non-Upgradeable → Upgradeable Architecture\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Load old deployment
  const oldDeploy = JSON.parse(fs.readFileSync("./deployment-base-mainnet.json", "utf8"));
  
  console.log("📊 OLD DEPLOYMENT:");
  console.log("   BTC1USD:", oldDeploy.core.btc1usd);
  console.log("   Vault:", oldDeploy.core.vault);
  console.log("");

  // ===== PHASE 1: SNAPSHOT OLD STATE =====
  console.log("=" .repeat(70));
  console.log("PHASE 1: SNAPSHOT CURRENT STATE");
  console.log("=" .repeat(70));
  console.log("");

  const OldBTC1USD = await hre.ethers.getContractAt("BTC1USD", oldDeploy.core.btc1usd);
  const OldVault = await hre.ethers.getContractAt("Vault", oldDeploy.core.vault);

  const totalSupply = await OldBTC1USD.totalSupply();
  const vaultCollateralValue = await OldVault.getTotalCollateralValue();
  const collateralRatio = await OldVault.getCurrentCollateralRatio();

  console.log("📈 Current State:");
  console.log("   Total Supply:", hre.ethers.formatUnits(totalSupply, 8), "BTC1USD");
  console.log("   Collateral Value:", hre.ethers.formatUnits(vaultCollateralValue, 8), "USD");
  console.log("   Collateral Ratio:", hre.ethers.formatUnits(collateralRatio, 8));
  console.log("");

  // Get holder balances (simplified - you may need to use events/indexer for full list)
  console.log("⚠️  NOTE: You need to enumerate all token holders for full migration");
  console.log("   Options:");
  console.log("   A) Use BaseScan API to get all holders");
  console.log("   B) Index Transfer events from block 0");
  console.log("   C) Use subgraph/indexer service");
  console.log("");

  // Sample snapshot for critical addresses
  const criticalAddresses = [
    { name: "Dev Wallet", address: oldDeploy.config.devWallet },
    { name: "Endowment Wallet", address: oldDeploy.config.endowmentWallet },
    { name: "Merkle Fee Collector", address: oldDeploy.wallets.merklFeeCollector }
  ];

  console.log("💰 Critical Address Balances:");
  const snapshot = [];
  for (const addr of criticalAddresses) {
    try {
      const balance = await OldBTC1USD.balanceOf(addr.address);
      const balanceFormatted = hre.ethers.formatUnits(balance, 8);
      console.log(`   ${addr.name}: ${balanceFormatted} BTC1USD`);
      snapshot.push({ ...addr, balance: balance.toString() });
    } catch (e) {
      console.log(`   ${addr.name}: ERROR reading balance`);
    }
  }
  console.log("");

  // ===== PHASE 2: DEPLOY UPGRADEABLE SYSTEM =====
  console.log("=" .repeat(70));
  console.log("PHASE 2: DEPLOY UPGRADEABLE SYSTEM");
  console.log("=" .repeat(70));
  console.log("");

  console.log("🚀 Deploying implementations...");

  const BTC1USDUpgradeable = await hre.ethers.getContractFactory("BTC1USDUpgradeable");
  const btc1usdImpl = await BTC1USDUpgradeable.deploy();
  await btc1usdImpl.waitForDeployment();
  const btc1usdImplAddress = await btc1usdImpl.getAddress();
  console.log("   ✅ BTC1USD Implementation:", btc1usdImplAddress);

  const VaultUpgradeable = await hre.ethers.getContractFactory("VaultUpgradeable");
  const vaultImpl = await VaultUpgradeable.deploy();
  await vaultImpl.waitForDeployment();
  const vaultImplAddress = await vaultImpl.getAddress();
  console.log("   ✅ Vault Implementation:", vaultImplAddress);

  const ProxyAdmin = await hre.ethers.getContractFactory("ProxyAdmin");
  const proxyAdmin = await ProxyAdmin.deploy(oldDeploy.governance.dao);
  await proxyAdmin.waitForDeployment();
  const proxyAdminAddress = await proxyAdmin.getAddress();
  console.log("   ✅ ProxyAdmin:", proxyAdminAddress);
  console.log("");

  console.log("🔄 Deploying proxies...");
  const UpgradeableProxy = await hre.ethers.getContractFactory("UpgradeableProxy");
  
  const btc1usdProxy = await UpgradeableProxy.deploy(btc1usdImplAddress, proxyAdminAddress);
  await btc1usdProxy.waitForDeployment();
  const btc1usdProxyAddress = await btc1usdProxy.getAddress();
  console.log("   ✅ BTC1USD Proxy:", btc1usdProxyAddress);

  const vaultProxy = await UpgradeableProxy.deploy(vaultImplAddress, proxyAdminAddress);
  await vaultProxy.waitForDeployment();
  const vaultProxyAddress = await vaultProxy.getAddress();
  console.log("   ✅ Vault Proxy:", vaultProxyAddress);
  console.log("");

  console.log("⚙️  Initializing contracts...");
  const btc1usd = BTC1USDUpgradeable.attach(btc1usdProxyAddress);
  await (await btc1usd.initialize(oldDeploy.config.admin)).wait();
  console.log("   ✅ BTC1USD initialized");

  const vault = VaultUpgradeable.attach(vaultProxyAddress);
  await (await vault.initialize(
    btc1usdProxyAddress,
    oldDeploy.core.chainlinkBTCOracle,
    oldDeploy.config.admin,
    oldDeploy.config.devWallet,
    oldDeploy.config.endowmentWallet
  )).wait();
  console.log("   ✅ Vault initialized");
  console.log("");

  // ===== PHASE 3: CONFIGURATION =====
  console.log("=" .repeat(70));
  console.log("PHASE 3: CONFIGURE NEW SYSTEM");
  console.log("=" .repeat(70));
  console.log("");

  console.log("⚠️  MANUAL ADMIN STEPS REQUIRED:");
  console.log("");
  console.log("The following must be called by admin:", oldDeploy.config.admin);
  console.log("");
  
  console.log("1. Link BTC1USD to Vault:");
  console.log(`   btc1usd.setVault("${vaultProxyAddress}")`);
  console.log(`   Contract: ${btc1usdProxyAddress}`);
  console.log("");

  console.log("2. Add collateral tokens to Vault:");
  console.log(`   vault.addCollateral("${oldDeploy.collateralTokens.wbtc}")`);
  console.log(`   vault.addCollateral("${oldDeploy.collateralTokens.cbbtc}")`);
  console.log(`   vault.addCollateral("${oldDeploy.collateralTokens.tbtc}")`);
  console.log(`   Contract: ${vaultProxyAddress}`);
  console.log("");

  console.log("3. Transfer collateral from old Vault to new Vault:");
  console.log("   ⚠️  CRITICAL: This requires moving actual collateral assets");
  console.log("   Contact: Requires coordination with old vault admin");
  console.log("");

  console.log("4. Pause old contracts:");
  console.log(`   oldBTC1USD.pause()`);
  console.log(`   oldVault.emergencyPause()`);
  console.log("");

  // ===== PHASE 4: MIGRATION PLAN =====
  console.log("=" .repeat(70));
  console.log("PHASE 4: TOKEN MIGRATION OPTIONS");
  console.log("=" .repeat(70));
  console.log("");

  console.log("Choose ONE migration strategy:\n");

  console.log("OPTION A: Airdrop (Recommended for small holder count)");
  console.log("   1. Export all holder balances from old contract");
  console.log("   2. Admin mints equivalent amounts to holders in new contract");
  console.log("   3. Announce transition, old tokens become worthless");
  console.log("   Pros: Clean break, simple for users");
  console.log("   Cons: Gas cost for admin, requires holder enumeration");
  console.log("");

  console.log("OPTION B: 1:1 Swap Contract");
  console.log("   1. Deploy swap contract (holds admin mint rights)");
  console.log("   2. Users burn old BTC1USD, receive new BTC1USD");
  console.log("   3. Time-limited swap window");
  console.log("   Pros: Users control migration, verifiable");
  console.log("   Cons: Requires user action, some may not migrate");
  console.log("");

  console.log("OPTION C: Gradual Migration");
  console.log("   1. New vault accepts new deposits only");
  console.log("   2. Old vault allows redemptions only");
  console.log("   3. Over time, liquidity moves to new system");
  console.log("   Pros: No forced migration, user-paced");
  console.log("   Cons: Fragmented liquidity, complex");
  console.log("");

  // ===== SAVE MIGRATION DATA =====
  const migrationData = {
    timestamp: new Date().toISOString(),
    oldContracts: {
      btc1usd: oldDeploy.core.btc1usd,
      vault: oldDeploy.core.vault
    },
    newContracts: {
      btc1usd: btc1usdProxyAddress,
      vault: vaultProxyAddress,
      btc1usdImpl: btc1usdImplAddress,
      vaultImpl: vaultImplAddress,
      proxyAdmin: proxyAdminAddress
    },
    snapshot: {
      totalSupply: totalSupply.toString(),
      collateralValue: vaultCollateralValue.toString(),
      collateralRatio: collateralRatio.toString(),
      criticalBalances: snapshot
    },
    explorerUrls: {
      btc1usdProxy: `https://basescan.org/address/${btc1usdProxyAddress}`,
      vaultProxy: `https://basescan.org/address/${vaultProxyAddress}`,
      btc1usdImpl: `https://basescan.org/address/${btc1usdImplAddress}`,
      vaultImpl: `https://basescan.org/address/${vaultImplAddress}`,
      proxyAdmin: `https://basescan.org/address/${proxyAdminAddress}`
    }
  };

  const migrationFile = `./migration-to-upgradeable-${Date.now()}.json`;
  fs.writeFileSync(migrationFile, JSON.stringify(migrationData, null, 2));
  console.log("💾 Migration data saved to:", migrationFile);
  console.log("");

  // ===== SUMMARY =====
  console.log("=" .repeat(70));
  console.log("📝 MIGRATION SUMMARY");
  console.log("=" .repeat(70));
  console.log("");
  console.log("OLD CONTRACTS (to be deprecated):");
  console.log("   BTC1USD:", oldDeploy.core.btc1usd);
  console.log("   Vault:", oldDeploy.core.vault);
  console.log("");
  console.log("NEW CONTRACTS (upgradeable):");
  console.log("   BTC1USD Proxy:", btc1usdProxyAddress);
  console.log("   Vault Proxy:", vaultProxyAddress);
  console.log("");
  console.log("GOVERNANCE:");
  console.log("   ProxyAdmin:", proxyAdminAddress);
  console.log("   Controlled by:", oldDeploy.governance.dao);
  console.log("");
  console.log("=" .repeat(70));
  console.log("🚨 CRITICAL NEXT STEPS:");
  console.log("=" .repeat(70));
  console.log("");
  console.log("1. ✅ Complete admin configuration (see PHASE 3 above)");
  console.log("2. ⏳ Choose migration strategy (see PHASE 4 above)");
  console.log("3. 📢 Announce migration to community");
  console.log("4. 🔄 Execute migration plan");
  console.log("5. 🌐 Update frontend to new addresses");
  console.log("6. ✔️  Verify all contracts on BaseScan");
  console.log("7. 🔒 Transfer ProxyAdmin to DAO governance");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
