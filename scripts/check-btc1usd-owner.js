const { ethers } = require("hardhat");

async function main(btc1usdAddressParam) {
  console.log("=== CHECKING BTC1USD OWNERSHIP ===\n");

  // Use provided address or default
  const btc1usdAddress = btc1usdAddressParam || "0x0077084669695A0Ce1259E4247C107AC9a2b2A79";
  const expectedSafeAddress = "0xA1D4de75082562eA776b160e605acD587668111B";

  console.log("BTC1USD Address:", btc1usdAddress);
  console.log("Expected Safe Address:", expectedSafeAddress);
  console.log("");

  try {
    const BTC1USD = await ethers.getContractFactory("BTC1USD");
    const btc1usd = BTC1USD.attach(btc1usdAddress);

    // Check current owner
    const currentOwner = await btc1usd.owner();
    console.log("Current Owner:", currentOwner);

    // Check pending owner (if any)
    try {
      const pendingOwner = await btc1usd.pendingOwner();
      console.log("Pending Owner:", pendingOwner);
    } catch (e) {
      console.log("Pending Owner: none (or method not available)");
    }

    // Verify if Safe is the owner
    if (currentOwner.toLowerCase() === expectedSafeAddress.toLowerCase()) {
      console.log("\n✅ SUCCESS! Safe is now the owner of BTC1USD");
      console.log("✅ Ownership transfer completed successfully!");
    } else {
      console.log("\n⚠️  WARNING! Owner is NOT the Safe address");
      console.log("   Current:", currentOwner);
      console.log("   Expected:", expectedSafeAddress);
      
      if (currentOwner === ethers.ZeroAddress) {
        console.log("\n❌ Owner is zero address - this is incorrect!");
      }
    }

    // Check vault and weeklyDistribution are set
    const vault = await btc1usd.vault();
    const weeklyDist = await btc1usd.weeklyDistribution();
    
    console.log("\n📋 BTC1USD Configuration:");
    console.log("  Vault:", vault);
    console.log("  WeeklyDistribution:", weeklyDist);

    if (vault === ethers.ZeroAddress) {
      console.log("  ⚠️  Vault is still zero address!");
    } else {
      console.log("  ✅ Vault is configured");
    }

    if (weeklyDist === ethers.ZeroAddress) {
      console.log("  ⚠️  WeeklyDistribution is still zero address!");
    } else {
      console.log("  ✅ WeeklyDistribution is configured");
    }

  } catch (error) {
    console.error("\n❌ Error checking ownership:", error.message);
    throw error;
  }
}

// Get address from command line if provided
const btc1usdAddress = process.argv[2];

main(btc1usdAddress)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
