const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔐 Generate Accept Ownership Calldata for Safe\n");
  
  const btc1usdAddress = process.env.NEXT_PUBLIC_BTC1USD_CONTRACT;
  const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS;
  
  if (!btc1usdAddress || !safeAddress) {
    console.error("❌ Missing environment variables");
    process.exit(1);
  }
  
  console.log("📍 Addresses:");
  console.log("BTC1USD:", btc1usdAddress);
  console.log("Safe:", safeAddress);
  console.log();
  
  // Create interface
  const btc1usdInterface = new ethers.Interface([
    "function acceptOwnership()",
    "function owner() view returns (address)",
    "function pendingOwner() view returns (address)"
  ]);
  
  // Generate calldata for acceptOwnership
  const calldata = btc1usdInterface.encodeFunctionData("acceptOwnership", []);
  
  console.log("📦 Transaction Details:");
  console.log("━".repeat(60));
  console.log();
  console.log("TO (Contract Address):");
  console.log(btc1usdAddress);
  console.log();
  console.log("VALUE:");
  console.log("0");
  console.log();
  console.log("DATA (Calldata):");
  console.log(calldata);
  console.log();
  console.log("━".repeat(60));
  console.log();
  
  // Check current state
  const provider = ethers.provider;
  const btc1usd = new ethers.Contract(btc1usdAddress, btc1usdInterface, provider);
  
  try {
    const currentOwner = await btc1usd.owner();
    const pendingOwner = await btc1usd.pendingOwner();
    
    console.log("📊 Current State:");
    console.log("Current Owner:", currentOwner);
    console.log("Pending Owner:", pendingOwner);
    console.log();
    
    if (pendingOwner.toLowerCase() === safeAddress.toLowerCase()) {
      console.log("✅ Safe is the pending owner - Ready to accept!");
      console.log();
      console.log("📋 INSTRUCTIONS:");
      console.log("━".repeat(60));
      console.log();
      console.log("1. Go to Safe UI:");
      console.log("   https://app.safe.global/base-sep:" + safeAddress);
      console.log();
      console.log("2. Click 'New Transaction' → 'Transaction Builder'");
      console.log();
      console.log("3. Enter the following:");
      console.log("   • To: " + btc1usdAddress);
      console.log("   • Value: 0");
      console.log("   • Data: " + calldata);
      console.log();
      console.log("4. Click 'Add transaction' → 'Create Batch'");
      console.log();
      console.log("5. Review and execute:");
      console.log("   • Sign with required number of signers");
      console.log("   • Execute the transaction");
      console.log();
      console.log("6. After execution, the Safe will be the owner!");
      console.log();
      console.log("━".repeat(60));
    } else if (pendingOwner === ethers.ZeroAddress) {
      console.log("❌ No pending owner set!");
      console.log("You need to call transferOwnership first:");
      console.log("  npx hardhat run scripts/transfer-ownership-to-safe.js --network base-sepolia");
    } else {
      console.log("⚠️  Pending owner is set to a different address:");
      console.log("   Expected:", safeAddress);
      console.log("   Actual:", pendingOwner);
    }
    
  } catch (error) {
    console.error("Error checking state:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
