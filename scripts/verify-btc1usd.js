const { ethers } = require("hardhat");

async function main() {
  const btc1usdAddress = "0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5";
  const expectedSafeAddress = "0xA1D4de75082562eA776b160e605acD587668111B";

  console.log("=== VERIFYING BTC1USD CONFIGURATION ===\n");
  console.log("BTC1USD Address:", btc1usdAddress);
  console.log("Expected Safe:", expectedSafeAddress);
  console.log("");

  const BTC1USD = await ethers.getContractFactory("BTC1USD");
  const btc1usd = BTC1USD.attach(btc1usdAddress);

  // Check owner
  const owner = await btc1usd.owner();
  console.log("✓ Owner:", owner);
  
  // Check pending owner
  const pendingOwner = await btc1usd.pendingOwner();
  console.log("✓ Pending Owner:", pendingOwner);

  // Check vault
  const vault = await btc1usd.vault();
  console.log("✓ Vault:", vault);

  // Check weeklyDistribution
  const weeklyDist = await btc1usd.weeklyDistribution();
  console.log("✓ WeeklyDistribution:", weeklyDist);

  console.log("\n=== STATUS ===\n");

  // Verify owner
  if (owner.toLowerCase() === expectedSafeAddress.toLowerCase()) {
    console.log("✅ Owner is Safe (CORRECT)");
  } else {
    console.log("⚠️  Owner is NOT Safe");
    console.log("   Current:", owner);
    console.log("   Expected:", expectedSafeAddress);
  }

  // Verify vault
  if (vault === ethers.ZeroAddress) {
    console.log("❌ Vault is ZERO address (NOT SET)");
  } else {
    console.log("✅ Vault is configured:", vault);
  }

  // Verify weeklyDistribution
  if (weeklyDist === ethers.ZeroAddress) {
    console.log("❌ WeeklyDistribution is ZERO address (NOT SET)");
  } else {
    console.log("✅ WeeklyDistribution is configured:", weeklyDist);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exitCode = 1;
  });
