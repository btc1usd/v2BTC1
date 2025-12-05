/**
 * Transfer Admin of Mock Collateral Tokens
 * 
 * This script transfers admin of MockWBTC, MockCBTC, and MockTBTC
 * from the deployer to the configured admin address.
 * 
 * Run with: npx hardhat run scripts/transfer-mock-token-admin.js --network base-sepolia
 */

const hre = require("hardhat");

async function main() {
  console.log("🔄 Starting mock token admin transfer process...\n");

  // Get the deployer (current admin)
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deployer address (current admin):", deployer.address);

  // Load deployment config
  const deployment = require("../deployment-base-sepolia.json");
  
  const targetAdmin = deployment.config.admin;
  console.log("🎯 Target admin address:", targetAdmin);
  console.log("");

  // Contract addresses
  const mockTokens = [
    {
      name: "MockWBTC",
      address: deployment.tokens.mockWBTC,
    },
    {
      name: "MockCBTC",
      address: deployment.tokens.mockCBTC,
    },
    {
      name: "MockTBTC",
      address: deployment.tokens.mockTBTC,
    },
  ];

  // ABI for setAdmin function
  const MOCK_TOKEN_ABI = [
    "function admin() view returns (address)",
    "function setAdmin(address _admin) external",
  ];

  // Transfer admin for each mock token
  for (const token of mockTokens) {
    console.log(`\n📍 Processing ${token.name} at ${token.address}...`);

    const tokenContract = new hre.ethers.Contract(
      token.address,
      MOCK_TOKEN_ABI,
      deployer
    );

    try {
      // Check current admin
      const currentAdmin = await tokenContract.admin();
      console.log(`   Current admin: ${currentAdmin}`);

      if (currentAdmin.toLowerCase() === targetAdmin.toLowerCase()) {
        console.log(`   ✅ Admin already set to target address. Skipping.`);
        continue;
      }

      console.log(`   🔄 Transferring admin to ${targetAdmin}...`);

      // Transfer admin
      const tx = await tokenContract.setAdmin(targetAdmin);
      console.log(`   ⏳ Transaction submitted: ${tx.hash}`);
      
      await tx.wait();
      console.log(`   ✅ Transaction confirmed!`);

      // Verify the transfer
      const newAdmin = await tokenContract.admin();
      if (newAdmin.toLowerCase() === targetAdmin.toLowerCase()) {
        console.log(`   ✅ ${token.name} admin successfully transferred to ${newAdmin}`);
      } else {
        console.log(`   ❌ ${token.name} admin verification failed!`);
        console.log(`      Expected: ${targetAdmin}`);
        console.log(`      Got: ${newAdmin}`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to transfer ${token.name} admin:`, error.message);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ MOCK TOKEN ADMIN TRANSFER COMPLETED");
  console.log("=".repeat(80));
  console.log("\n📋 Summary:");
  console.log(`   Target Admin: ${targetAdmin}`);
  console.log(`   Tokens Processed: ${mockTokens.length}`);
  console.log("\n💡 Next Steps:");
  console.log("   1. Verify admin can mint tokens in the UI");
  console.log("   2. Connect with admin wallet to test minting");
  console.log("   3. Check 'Collateral Minting (Admin Only)' section");
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
