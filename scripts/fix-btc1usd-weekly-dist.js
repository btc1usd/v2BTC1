const { ethers } = require("hardhat");

async function main() {
  console.log("=== SETTING WEEKLY DISTRIBUTION IN BTC1USD ===\n");

  const deployer = (await ethers.getSigners())[0];
  console.log("Deployer:", deployer.address);

  const btc1usdAddress = "0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5";
  const weeklyDistAddress = "0x1FEf2533641cA69B9E30fA734944BB219b2152B6";

  console.log("BTC1USD:", btc1usdAddress);
  console.log("WeeklyDistribution:", weeklyDistAddress);
  console.log("");

  const BTC1USD = await ethers.getContractFactory("BTC1USD");
  const btc1usd = BTC1USD.attach(btc1usdAddress);

  // Check current state
  const currentWeeklyDist = await btc1usd.weeklyDistribution();
  console.log("Current WeeklyDistribution:", currentWeeklyDist);

  if (currentWeeklyDist.toLowerCase() === weeklyDistAddress.toLowerCase()) {
    console.log("✅ WeeklyDistribution is already set correctly!");
    return;
  }

  if (currentWeeklyDist !== ethers.ZeroAddress) {
    console.log("❌ WeeklyDistribution is already set to a different address!");
    console.log("   Cannot change without 2-day timelock process.");
    return;
  }

  console.log("\n🔄 Setting WeeklyDistribution...");
  
  try {
    const tx = await btc1usd.setWeeklyDistribution(weeklyDistAddress);
    console.log("⏳ Waiting for transaction confirmation...");
    await tx.wait();
    console.log("✅ WeeklyDistribution set successfully!");
    
    // Verify
    const newWeeklyDist = await btc1usd.weeklyDistribution();
    console.log("\n✓ New WeeklyDistribution:", newWeeklyDist);
    
    if (newWeeklyDist.toLowerCase() === weeklyDistAddress.toLowerCase()) {
      console.log("✅ VERIFIED: WeeklyDistribution is now correct!");
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
