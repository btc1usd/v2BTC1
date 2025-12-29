const { ethers } = require("hardhat");

async function main() {
  console.log("=== VERIFYING DAO DEPLOYMENT ===\n");

  // Load deployment info
  const fs = require("fs");
  const deployment = JSON.parse(
    fs.readFileSync("./deployment-base-sepolia.json", "utf8")
  );

  const daoProxyAddress = deployment.governance.dao;
  const proxyAdminAddress = deployment.proxyAdmin;

  console.log("DAO Proxy Address:", daoProxyAddress);
  console.log("ProxyAdmin Address:", proxyAdminAddress);

  const provider = ethers.provider;

  // Check if contract exists
  const code = await provider.getCode(daoProxyAddress);
  if (code === "0x") {
    console.log("\n❌ ERROR: No contract deployed at DAO proxy address!");
    return;
  }
  console.log("\n✅ Contract exists at DAO proxy address");

  // Try to get implementation address from ProxyAdmin
  try {
    const proxyAdmin = await ethers.getContractAt(
      "UpgradeableProxy",
      proxyAdminAddress
    );
    
    // Try to read implementation via ProxyAdmin ABI
    const ProxyAdminABI = [
      "function getProxyImplementation(address proxy) view returns (address)",
    ];
    const admin = new ethers.Contract(
      proxyAdminAddress,
      ProxyAdminABI,
      provider
    );

    const implementation = await admin.getProxyImplementation(daoProxyAddress);
    console.log("✅ DAO Implementation Address:", implementation);

    // Check if implementation exists
    const implCode = await provider.getCode(implementation);
    if (implCode === "0x") {
      console.log("❌ ERROR: No contract at implementation address!");
      return;
    }
    console.log("✅ Implementation contract exists");
  } catch (error) {
    console.log("⚠️  Could not verify implementation via ProxyAdmin:", error.message);
  }

  // Try to call functions on DAO
  console.log("\n=== Testing DAO Functions ===");

  const DAOABI = [
    "function proposalCount() view returns (uint256)",
    "function isInitialized() view returns (bool)",
    "function btc1usd() view returns (address)",
    "function protocolGovernance() view returns (address)",
  ];

  const dao = new ethers.Contract(daoProxyAddress, DAOABI, provider);

  try {
    const isInit = await dao.isInitialized();
    console.log("✅ DAO isInitialized:", isInit);

    if (!isInit) {
      console.log("\n❌ PROBLEM: DAO proxy is NOT initialized!");
      console.log("   You need to call initialize() on the proxy");
      return;
    }
  } catch (error) {
    console.log("❌ Error checking initialization:", error.message);
  }

  try {
    const btc1usdAddr = await dao.btc1usd();
    console.log("✅ DAO btc1usd address:", btc1usdAddr);
  } catch (error) {
    console.log("❌ Error reading btc1usd:", error.message);
  }

  try {
    const govAddr = await dao.protocolGovernance();
    console.log("✅ DAO protocolGovernance address:", govAddr);
  } catch (error) {
    console.log("❌ Error reading protocolGovernance:", error.message);
  }

  try {
    const count = await dao.proposalCount();
    console.log("✅ DAO proposalCount:", count.toString());
  } catch (error) {
    console.log("❌ Error reading proposalCount:", error.message);
    console.log("   This is the error you're seeing in the API!");
  }

  console.log("\n=== Verification Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
