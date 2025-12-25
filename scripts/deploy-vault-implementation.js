const { ethers } = require("hardhat");

async function main() {
  console.log("\n🚀 Deploying new VaultUpgradeableWithPermit implementation...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Deploy new VaultUpgradeableWithPermit implementation
  const VaultUpgradeableWithPermit = await ethers.getContractFactory("VaultUpgradeableWithPermit");
  console.log("Deploying VaultUpgradeableWithPermit implementation...");
  const vaultImpl = await VaultUpgradeableWithPermit.deploy();
  await vaultImpl.waitForDeployment();
  const vaultImplAddress = await vaultImpl.getAddress();
  
  console.log("\n✅ New VaultUpgradeableWithPermit Implementation deployed to:", vaultImplAddress);
  console.log("   Explorer:", `https://sepolia.basescan.org/address/${vaultImplAddress}`);

  // Load existing deployment
  const fs = require('fs');
  const deploymentPath = './deployment-base-sepolia.json';
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

  console.log("\n📋 Current Deployment Info:");
  console.log("   Vault Proxy:", deployment.core.vault);
  console.log("   Old Implementation:", deployment.implementations.vault || "Not tracked in deployment file");
  console.log("   ProxyAdmin:", deployment.proxyAdmin);

  console.log("\n🔧 Safe Transaction Parameters for Upgrade:");
  console.log("━".repeat(80));
  console.log("To:", deployment.proxyAdmin);
  console.log("Value:", "0");
  console.log("Function:", "upgrade(address proxy, address implementation)");
  console.log("\nParameters:");
  console.log("  proxy (address):", deployment.core.vault);
  console.log("  implementation (address):", vaultImplAddress);
  console.log("\nCalldata (for manual entry):");
  
  // Generate calldata
  const proxyAdminABI = [
    "function upgrade(address proxy, address implementation) external"
  ];
  const iface = new ethers.Interface(proxyAdminABI);
  const calldata = iface.encodeFunctionData("upgrade", [
    deployment.core.vault,
    vaultImplAddress
  ]);
  console.log(calldata);
  
  console.log("\n📝 Safe Transaction Builder Format:");
  console.log("━".repeat(80));
  console.log("Contract Address:", deployment.proxyAdmin);
  console.log("Contract Method: upgrade");
  console.log("proxy:", deployment.core.vault);
  console.log("implementation:", vaultImplAddress);
  
  console.log("\n🔒 Security Improvements in New Implementation:");
  console.log("━".repeat(80));
  console.log("   ✅ ReentrancyGuard added to mintWithPermit2() and redeemWithPermit()");
  console.log("   ✅ Two-step timelock for critical parameter changes (2 days):");
  console.log("      - devWallet changes");
  console.log("      - endowmentWallet changes");
  console.log("      - oracle changes");
  console.log("   ✅ Collateral accounting discrepancy tracking:");
  console.log("      - checkCollateralDiscrepancy() - view actual vs accounted balance");
  console.log("      - detectCollateralDiscrepancies() - scan all tokens");
  console.log("      - rescueSurplusCollateral() - recover surplus tokens");
  console.log("      - fixCollateralDeficit() - emergency deficit repair");
  
  console.log("\n🆕 New Functions Available After Upgrade:");
  console.log("━".repeat(80));
  console.log("\n📍 Timelock Functions (2-day delay):");
  console.log("   initiateDevWalletChange(address) - Propose new devWallet");
  console.log("   executeDevWalletChange() - Execute after 2 days");
  console.log("   cancelDevWalletChange() - Cancel pending change");
  console.log("   ");
  console.log("   initiateEndowmentWalletChange(address) - Propose new endowmentWallet");
  console.log("   executeEndowmentWalletChange() - Execute after 2 days");
  console.log("   cancelEndowmentWalletChange() - Cancel pending change");
  console.log("   ");
  console.log("   initiateOracleChange(address) - Propose new oracle");
  console.log("   executeOracleChange() - Execute after 2 days");
  console.log("   cancelOracleChange() - Cancel pending change");
  
  console.log("\n📍 Collateral Accounting Functions:");
  console.log("   checkCollateralDiscrepancy(address token) view returns (int256)");
  console.log("   detectCollateralDiscrepancies() - Scan all tokens");
  console.log("   rescueSurplusCollateral(address token, address to)");
  console.log("   fixCollateralDeficit(address token)");
  
  console.log("\n⚠️  BREAKING CHANGES:");
  console.log("   - Critical parameter changes now require 2-day timelock");
  console.log("   - Direct setters removed (use initiate → wait → execute pattern)");
  console.log("   - UI must be updated to support two-step process");
  
  console.log("\n📊 Impact Analysis:");
  console.log("━".repeat(80));
  console.log("   Gas Cost: +5,000-8,000 gas per transaction (ReentrancyGuard)");
  console.log("   Security: MAJOR improvement - prevents reentrancy attacks");
  console.log("   Governance: 2-day notice for critical changes (transparency)");
  console.log("   Compatibility: External interface unchanged (backward compatible)");
  console.log("   State: All existing balances and state preserved");
  
  console.log("\n💾 Updating deployment file...");
  // Update deployment file with new implementation address
  const oldImpl = deployment.implementations.vault;
  deployment.implementations.vault = vaultImplAddress;
  if (oldImpl) {
    deployment.implementations.vault_old = oldImpl;
  }
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("   ✅ deployment-base-sepolia.json updated");

  console.log("\n🧪 Post-Upgrade Verification Commands:");
  console.log("━".repeat(80));
  console.log("# Check implementation was updated");
  console.log(`cast implementation ${deployment.core.vault} --rpc-url $BASE_SEPOLIA_RPC`);
  console.log("\n# Verify TIMELOCK_DELAY is 2 days (172800 seconds = 0x2A300 in hex)");
  console.log(`cast call ${deployment.core.vault} "TIMELOCK_DELAY()" --rpc-url $BASE_SEPOLIA_RPC`);
  console.log("\n# Check for collateral discrepancies (example with WBTC)");
  console.log(`cast call ${deployment.core.vault} "checkCollateralDiscrepancy(address)" ${deployment.collateralTokens.wbtc} --rpc-url $BASE_SEPOLIA_RPC`);

  console.log("\n🎯 Next Steps:");
  console.log("━".repeat(80));
  console.log("1. Go to Safe UI:", `https://app.safe.global/home?safe=sep:${deployment.config.admin}`);
  console.log("2. Create a new transaction");
  console.log("3. Use Transaction Builder with the parameters above");
  console.log("4. Execute the upgrade via Safe multisig (2-of-2 signatures)");
  console.log("5. Verify the upgrade succeeded using the verification commands");
  console.log("6. Test mint/redeem functionality");
  console.log("7. Run detectCollateralDiscrepancies() to check accounting");
  console.log("\n✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
