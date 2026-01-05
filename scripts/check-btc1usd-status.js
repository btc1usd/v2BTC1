const { ethers } = require("hardhat");

async function main() {
  console.log("=== CHECKING BTC1USD STATUS ===\n");

  const btc1usdAddress = "0x0077084669695A0Ce1259E4247C107AC9a2b2A79";
  const BTC1USD = await ethers.getContractFactory("BTC1USD");
  const btc1usd = BTC1USD.attach(btc1usdAddress);

  const vault = await btc1usd.vault();
  const weeklyDist = await btc1usd.weeklyDistribution();
  const owner = await btc1usd.owner();

  console.log("BTC1USD Address:", btc1usdAddress);
  console.log("\nCurrent Configuration:");
  console.log("  Vault:", vault);
  console.log("  WeeklyDistribution:", weeklyDist);
  console.log("  Owner:", owner);
  console.log("\nExpected:");
  console.log("  Vault: 0x19A3a620e8daC146bAef15a15EC058e5110b76c2");
  console.log("  WeeklyDistribution: 0x935bc7ce1B615Ad77a5Ce1159A9435e8Ef02C29b");

  if (vault === "0x0000000000000000000000000000000000000000") {
    console.log("\n❌ Vault is still zero address - needs to be set");
  } else if (vault.toLowerCase() === "0x19A3a620e8daC146bAef15a15EC058e5110b76c2".toLowerCase()) {
    console.log("\n✅ Vault is correctly set!");
  } else {
    console.log("\n⚠️  Vault is set to a different address!");
  }

  if (weeklyDist === "0x0000000000000000000000000000000000000000") {
    console.log("❌ WeeklyDistribution is still zero address - needs to be set");
  } else if (weeklyDist.toLowerCase() === "0x935bc7ce1B615Ad77a5Ce1159A9435e8Ef02C29b".toLowerCase()) {
    console.log("✅ WeeklyDistribution is correctly set!");
  } else {
    console.log("⚠️  WeeklyDistribution is set to a different address!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exitCode = 1;
  });
