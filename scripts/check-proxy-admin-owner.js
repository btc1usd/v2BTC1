const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔍 Checking ProxyAdmin ownership...\n");

  const deployment = require("../deployment-base-sepolia.json");
  
  const proxyAdminAddress = deployment.proxyAdmin;
  const safeAddress = deployment.config.admin;
  
  console.log("ProxyAdmin Address:", proxyAdminAddress);
  console.log("Expected Owner (Safe):", safeAddress);
  
  // Get ProxyAdmin contract
  const proxyAdminABI = [
    "function owner() view returns (address)",
    "function getProxyImplementation(address proxy) view returns (address)"
  ];
  
  const proxyAdmin = await ethers.getContractAt(proxyAdminABI, proxyAdminAddress);
  
  // Check current owner
  const currentOwner = await proxyAdmin.owner();
  console.log("Current Owner:", currentOwner);
  
  if (currentOwner.toLowerCase() === safeAddress.toLowerCase()) {
    console.log("✅ ProxyAdmin is owned by Safe multisig");
  } else {
    console.log("❌ ProxyAdmin is NOT owned by Safe!");
    console.log("   Owner mismatch - Safe cannot execute upgrade");
  }
  
  // Check current implementation
  const weeklyDistProxy = deployment.distribution.weeklyDistribution;
  console.log("\nWeeklyDistribution Proxy:", weeklyDistProxy);
  
  try {
    const currentImpl = await proxyAdmin.getProxyImplementation(weeklyDistProxy);
    console.log("Current Implementation:", currentImpl);
    console.log("New Implementation:", deployment.implementations.weeklyDistribution);
  } catch (error) {
    console.log("⚠️  Could not fetch current implementation:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
