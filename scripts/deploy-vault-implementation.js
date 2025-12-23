const { ethers } = require("hardhat");

async function main() {
  console.log("\n🚀 Deploying new VaultUpgradeableWithPermit implementation...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Deploy new VaultUpgradeableWithPermit implementation
  const VaultUpgradeable = await ethers.getContractFactory("VaultUpgradeableWithPermit");
  console.log("Deploying VaultUpgradeableWithPermit implementation...");
  const vaultImpl = await VaultUpgradeable.deploy();
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
  console.log("   Old Implementation:", deployment.implementations.vault);
  console.log("   ProxyAdmin:", deployment.proxyAdmin);

  console.log("\n🔧 Safe Transaction Parameters for Upgrade:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
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
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Contract Address:", deployment.proxyAdmin);
  console.log("Contract Method: upgrade");
  console.log("proxy:", deployment.core.vault);
  console.log("implementation:", vaultImplAddress);
  console.log("\n✅ After execution, the Vault proxy will use the new implementation with:");
  console.log("   - mintWithPermit2() for gasless minting");
  console.log("   - redeemWithPermit() for gasless redeeming");
  console.log("   - getTotalCollateralValue() view function");
  console.log("   - getCurrentCollateralRatio() view function");
  console.log("   - isHealthy() view function");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
