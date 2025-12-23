const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔍 Verifying upgrade transaction...\n");

  const deployment = require("../deployment-base-sepolia.json");
  
  const proxyAdminAddress = deployment.proxyAdmin;
  const weeklyDistProxy = deployment.distribution.weeklyDistribution;
  const newImplAddress = deployment.implementations.weeklyDistribution;
  
  console.log("Proxy:", weeklyDistProxy);
  console.log("New Implementation:", newImplAddress);
  console.log("ProxyAdmin:", proxyAdminAddress);
  
  // Check if new implementation has code
  const code = await ethers.provider.getCode(newImplAddress);
  if (code === "0x") {
    console.log("❌ ERROR: New implementation has no code! Not a contract.");
    return;
  }
  console.log("✅ New implementation has code (contract exists)");
  
  // Get ProxyAdmin contract
  const proxyAdminABI = [
    "function owner() view returns (address)",
    "function getProxyAdmin(address proxy) view returns (address)",
    "function getProxyImplementation(address proxy) view returns (address)",
    "function upgrade(address proxy, address implementation) external"
  ];
  
  const proxyAdmin = await ethers.getContractAt(proxyAdminABI, proxyAdminAddress);
  
  // Check current admin of proxy
  try {
    const proxyAdminCheck = await proxyAdmin.getProxyAdmin(weeklyDistProxy);
    console.log("Proxy's Admin:", proxyAdminCheck);
    if (proxyAdminCheck.toLowerCase() !== proxyAdminAddress.toLowerCase()) {
      console.log("❌ ERROR: ProxyAdmin doesn't manage this proxy!");
    } else {
      console.log("✅ ProxyAdmin manages this proxy");
    }
  } catch (error) {
    console.log("⚠️  Could not check proxy admin:", error.message);
  }
  
  // Try to simulate the upgrade call
  console.log("\n🧪 Simulating upgrade transaction...");
  const [signer] = await ethers.getSigners();
  
  try {
    // Simulate from the Safe address
    const upgradeCalldata = proxyAdmin.interface.encodeFunctionData("upgrade", [
      weeklyDistProxy,
      newImplAddress
    ]);
    
    console.log("Calldata:", upgradeCalldata);
    
    // Try static call to see if it would work
    await ethers.provider.call({
      to: proxyAdminAddress,
      from: deployment.config.admin, // Simulate as Safe
      data: upgradeCalldata
    });
    
    console.log("✅ Upgrade simulation succeeded!");
    console.log("\n✅ Transaction should work when executed via Safe");
    
  } catch (error) {
    console.log("❌ Upgrade simulation failed!");
    console.log("Error:", error.message);
    
    // Check if it's an ownership issue
    if (error.message.includes("Ownable")) {
      console.log("\n💡 This might be an ownership issue.");
      console.log("   The Safe needs to be the owner of ProxyAdmin.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
