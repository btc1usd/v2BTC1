const { ethers } = require("hardhat");

async function main() {
  console.log("\n🚀 Deploying new WeeklyDistributionUpgradeable implementation...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Deploy new WeeklyDistributionUpgradeable implementation
  const WeeklyDistributionUpgradeable = await ethers.getContractFactory("WeeklyDistributionUpgradeable");
  console.log("Deploying WeeklyDistributionUpgradeable implementation...");
  const weeklyDistImpl = await WeeklyDistributionUpgradeable.deploy();
  await weeklyDistImpl.waitForDeployment();
  const weeklyDistImplAddress = await weeklyDistImpl.getAddress();
  
  console.log("\n✅ New WeeklyDistributionUpgradeable Implementation deployed to:", weeklyDistImplAddress);
  console.log("   Explorer:", `https://sepolia.basescan.org/address/${weeklyDistImplAddress}`);

  // Load existing deployment
  const fs = require('fs');
  const deploymentPath = './deployment-base-sepolia.json';
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

  console.log("\n📋 Current Deployment Info:");
  console.log("   WeeklyDistribution Proxy:", deployment.distribution.weeklyDistribution);
  console.log("   Old Implementation:", deployment.implementations.weeklyDistribution || "Not tracked in deployment file");
  console.log("   ProxyAdmin:", deployment.proxyAdmin);

  console.log("\n🔧 Safe Transaction Parameters for Upgrade:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("To:", deployment.proxyAdmin);
  console.log("Value:", "0");
  console.log("Function:", "upgrade(address proxy, address implementation)");
  console.log("\nParameters:");
  console.log("  proxy (address):", deployment.distribution.weeklyDistribution);
  console.log("  implementation (address):", weeklyDistImplAddress);
  console.log("\nCalldata (for manual entry):");
  
  // Generate calldata
  const proxyAdminABI = [
    "function upgrade(address proxy, address implementation) external"
  ];
  const iface = new ethers.Interface(proxyAdminABI);
  const calldata = iface.encodeFunctionData("upgrade", [
    deployment.distribution.weeklyDistribution,
    weeklyDistImplAddress
  ]);
  console.log(calldata);
  
  console.log("\n📝 Safe Transaction Builder Format:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Contract Address:", deployment.proxyAdmin);
  console.log("Contract Method: upgrade");
  console.log("proxy:", deployment.distribution.weeklyDistribution);
  console.log("implementation:", weeklyDistImplAddress);
  
  console.log("\n🔒 Security Improvements in New Implementation:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   ✅ executeDistribution() now requires onlyOwner (CRITICAL FIX)");
  console.log("   ✅ ReentrancyGuard protection added (nonReentrant modifier)");
  console.log("   ✅ Pausable mechanism added (emergency pause/unpause)");
  console.log("   ✅ Zero address validation on setter functions");
  console.log("   ✅ setMerklDistributor() validates non-zero address");
  console.log("   ✅ setDevWallet() validates non-zero address");
  
  console.log("\n⚠️  BREAKING CHANGE:");
  console.log("   - executeDistribution() previously had NO access control (anyone could call)");
  console.log("   - Now requires onlyOwner modifier (only Safe multisig can execute)");
  console.log("   - This is a security fix - ensure your UI is updated accordingly");
  
  console.log("\n📝 New Functions Available After Upgrade:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   pause() - Emergency pause (onlyOwner)");
  console.log("   unpause() - Resume operations (onlyOwner)");
  
  console.log("\n💾 Updating deployment file...");
  // Update deployment file with new implementation address
  if (!deployment.implementations.weeklyDistribution) {
    deployment.implementations.weeklyDistribution = weeklyDistImplAddress;
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("   ✅ deployment-base-sepolia.json updated");
  } else {
    const oldImpl = deployment.implementations.weeklyDistribution;
    deployment.implementations.weeklyDistribution = weeklyDistImplAddress;
    deployment.implementations.weeklyDistribution_old = oldImpl;
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("   ✅ deployment-base-sepolia.json updated (old implementation backed up)");
  }

  console.log("\n🎯 Next Steps:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Go to Safe UI:", `https://app.safe.global/home?safe=sep:${deployment.config.admin}`);
  console.log("2. Create a new transaction");
  console.log("3. Use Transaction Builder with the parameters above");
  console.log("4. Execute the upgrade via Safe multisig");
  console.log("5. Verify the upgrade succeeded:");
  console.log("   - Check proxy still points to correct address");
  console.log("   - Test that executeDistribution() requires owner");
  console.log("   - Test pause/unpause functionality");
  console.log("\n✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
