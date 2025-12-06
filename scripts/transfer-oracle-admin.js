const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔄 TRANSFERRING ORACLE ADMIN CONTROL\n");
  console.log("=".repeat(60));

  // Get deployer (current admin)
  const [deployer] = await ethers.getSigners();
  console.log("📍 Connected wallet:", deployer.address);

  // Configuration
  const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || "YOUR_ORACLE_ADDRESS_HERE";
  const NEW_ADMIN = "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835";

  if (ORACLE_ADDRESS === "YOUR_ORACLE_ADDRESS_HERE") {
    console.error("\n❌ ERROR: Please set ORACLE_ADDRESS");
    console.error("\nOptions:");
    console.error("1. Set in .env: ORACLE_ADDRESS=0xYourOracleAddress");
    console.error("2. Run with env var: ORACLE_ADDRESS=0xYourAddress npx hardhat run ...");
    console.error("3. Edit this script and replace YOUR_ORACLE_ADDRESS_HERE");
    process.exit(1);
  }

  console.log("🔮 Oracle address:", ORACLE_ADDRESS);
  console.log("👤 New admin:", NEW_ADMIN);
  console.log("\n" + "=".repeat(60));

  // Connect to oracle
  console.log("\n🔗 Connecting to ChainlinkBTCOracle...");
  const oracle = await ethers.getContractAt("ChainlinkBTCOracle", ORACLE_ADDRESS);

  // Check current admin
  console.log("\n🔍 Checking current admin...");
  const currentAdmin = await oracle.admin();
  console.log("Current admin:", currentAdmin);

  // Verify caller is current admin
  if (currentAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("\n❌ ERROR: You are not the current admin!");
    console.error("Current admin:", currentAdmin);
    console.error("Your address:", deployer.address);
    console.error("\nYou must connect with the current admin wallet to transfer ownership.");
    process.exit(1);
  }

  console.log("✅ Verified: You are the current admin");

  // Check if already transferred
  if (currentAdmin.toLowerCase() === NEW_ADMIN.toLowerCase()) {
    console.log("\n✅ Admin is already set to:", NEW_ADMIN);
    console.log("No transfer needed!");
    process.exit(0);
  }

  // Confirm transfer
  console.log("\n⚠️  CONFIRMATION REQUIRED");
  console.log("=".repeat(60));
  console.log("Transfer admin control:");
  console.log("  FROM:", currentAdmin);
  console.log("  TO:", NEW_ADMIN);
  console.log("\n⚠️  WARNING: After this transfer, you (deployer) will lose admin control!");
  console.log("=".repeat(60));

  // Wait a moment for user to review
  console.log("\nProceeding with transfer in 5 seconds...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Transfer admin
  console.log("\n🔄 Transferring admin...");
  try {
    const tx = await oracle.transferAdmin(NEW_ADMIN);
    console.log("📝 Transaction hash:", tx.hash);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    console.log("⛽ Gas used:", receipt.gasUsed.toString());

  } catch (error) {
    console.error("\n❌ Transfer failed!");
    console.error("Error:", error.message);
    
    if (error.message.includes("admin")) {
      console.error("\n💡 This might be because:");
      console.error("- You're not connected as the current admin");
      console.error("- The oracle contract doesn't recognize you as admin");
    }
    
    console.error("\n🔧 Troubleshooting:");
    console.error("1. Check your DEPLOYER_PRIVATE_KEY matches the deployer wallet");
    console.error("2. Verify the oracle address is correct");
    console.error("3. Make sure you're on the right network (base-mainnet)");
    
    process.exit(1);
  }

  // Verify new admin
  console.log("\n🔍 Verifying new admin...");
  const newAdmin = await oracle.admin();
  console.log("New admin:", newAdmin);

  if (newAdmin.toLowerCase() === NEW_ADMIN.toLowerCase()) {
    console.log("✅ Admin successfully transferred!");
  } else {
    console.error("❌ Admin mismatch!");
    console.error("Expected:", NEW_ADMIN);
    console.error("Actual:", newAdmin);
    process.exit(1);
  }

  // Test oracle functions
  console.log("\n🧪 Testing oracle functions...");
  try {
    const feedAddress = await oracle.getPriceFeedAddress();
    console.log("✅ Chainlink feed:", feedAddress);

    const currentPrice = await oracle.getCurrentPrice();
    const priceFormatted = Number(currentPrice) / 1e8;
    console.log("✅ Current BTC price: $" + priceFormatted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    const lastUpdate = await oracle.getLastUpdate();
    const updateDate = new Date(Number(lastUpdate) * 1000);
    const ageMinutes = Math.floor((Date.now() / 1000 - Number(lastUpdate)) / 60);
    console.log("✅ Last update:", updateDate.toISOString(), `(${ageMinutes} minutes ago)`);

    const isStale = await oracle.isStale();
    console.log("✅ Is stale:", isStale ? "⚠️ YES (price is old)" : "✅ NO (price is fresh)");

  } catch (error) {
    console.error("⚠️ Oracle test warning:", error.message);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ ADMIN TRANSFER COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Summary:");
  console.log("Oracle Address:", ORACLE_ADDRESS);
  console.log("Previous Admin:", currentAdmin);
  console.log("New Admin:", NEW_ADMIN);
  console.log("\n💡 Important Notes:");
  console.log("1. ✅ Admin control transferred to: " + NEW_ADMIN);
  console.log("2. ⚠️  Deployer wallet no longer has admin access");
  console.log("3. ✅ Oracle is ready to use in your protocol");
  console.log("4. 🔗 Verify on BaseScan:");
  console.log(`   https://basescan.org/address/${ORACLE_ADDRESS}`);
  console.log("\n🎯 Next Steps:");
  console.log("- Use oracle address in Vault deployment");
  console.log("- Update protocol configuration with oracle address");
  console.log("- Document the oracle address for future reference");
  console.log("\n" + "=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exitCode = 1;
  });
