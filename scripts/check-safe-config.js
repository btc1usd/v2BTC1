const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔍 Checking Safe configuration...\n");

  const deployment = require("../deployment-base-sepolia.json");
  const safeAddress = deployment.config.admin;
  
  console.log("Safe Address:", safeAddress);
  console.log("Explorer:", `https://sepolia.basescan.org/address/${safeAddress}`);
  
  // Check if it's a contract (Safe multisig)
  const code = await ethers.provider.getCode(safeAddress);
  if (code === "0x") {
    console.log("❌ Safe address has no code - might be an EOA!");
    return;
  }
  console.log("✅ Safe is a contract (multisig wallet)");
  
  // Try to get Safe info using Gnosis Safe ABI
  const safeABI = [
    "function getOwners() view returns (address[])",
    "function getThreshold() view returns (uint256)",
    "function nonce() view returns (uint256)"
  ];
  
  try {
    const safe = await ethers.getContractAt(safeABI, safeAddress);
    
    const owners = await safe.getOwners();
    console.log("\n👥 Safe Owners:");
    owners.forEach((owner, i) => {
      console.log(`   ${i + 1}. ${owner}`);
    });
    
    const threshold = await safe.getThreshold();
    console.log(`\n🔢 Threshold: ${threshold} of ${owners.length} signatures required`);
    
    const nonce = await safe.nonce();
    console.log(`📝 Current Nonce: ${nonce}`);
    
    // Check if UI Controller is a signer
    const uiController = "0x0c8852280df8eF9fCb2a24e9d76f1ee4779773E9";
    const isOwner = owners.some(owner => owner.toLowerCase() === uiController.toLowerCase());
    
    console.log(`\n🔑 UI Controller (${uiController}):`);
    if (isOwner) {
      console.log("   ✅ IS a Safe owner - can propose transactions");
    } else {
      console.log("   ❌ NOT a Safe owner - cannot propose transactions");
      console.log("   💡 You need to connect with one of the Safe owners listed above");
    }
    
  } catch (error) {
    console.log("⚠️  Could not fetch Safe info:", error.message);
    console.log("   This might be an older Safe version with different ABI");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
