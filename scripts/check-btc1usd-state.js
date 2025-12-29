const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔍 Checking BTC1USD Contract State\n");
  
  // Get contract address from environment
  const btc1usdAddress = process.env.NEXT_PUBLIC_BTC1USD_CONTRACT;
  const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS;
  const vaultAddress = process.env.NEXT_PUBLIC_VAULT_CONTRACT;
  
  if (!btc1usdAddress) {
    console.error("❌ NEXT_PUBLIC_BTC1USD_CONTRACT not found in .env");
    process.exit(1);
  }
  
  console.log("📍 Contract Addresses:");
  console.log("BTC1USD:", btc1usdAddress);
  console.log("Safe:", safeAddress || "Not set");
  console.log("Vault:", vaultAddress || "Not set");
  console.log();
  
  // Get provider from hardhat
  const provider = ethers.provider;
  
  // Create contract instance
  const btc1usdABI = [
    "function vault() view returns (address)",
    "function weeklyDistribution() view returns (address)",
    "function criticalParamsLocked() view returns (bool)",
    "function pendingVaultChange() view returns (tuple(address newAddress, uint256 executeAfter))",
    "function pendingWeeklyDistributionChange() view returns (tuple(address newAddress, uint256 executeAfter))",
    "function owner() view returns (address)"
  ];
  
  const btc1usd = new ethers.Contract(btc1usdAddress, btc1usdABI, provider);
  
  try {
    // Fetch all state variables
    console.log("📊 Current State:");
    
    const owner = await btc1usd.owner();
    console.log("\n🔑 Owner:", owner);
    console.log("Safe matches owner:", owner.toLowerCase() === safeAddress?.toLowerCase());
    
    const vault = await btc1usd.vault();
    console.log("\n🏦 Vault:", vault);
    console.log("Matches env:", vault.toLowerCase() === vaultAddress?.toLowerCase());
    
    const weeklyDist = await btc1usd.weeklyDistribution();
    console.log("\n📅 Weekly Distribution:", weeklyDist);
    
    const locked = await btc1usd.criticalParamsLocked();
    console.log("\n🔒 Critical Params Locked:", locked);
    
    if (locked) {
      console.log("\n⚠️  WARNING: Critical parameters are LOCKED!");
      console.log("This means initiateVaultChange will FAIL with 'onlyOwnerUnlocked' modifier.");
      console.log("When locked, you CANNOT change vault or weeklyDistribution addresses.");
    } else {
      console.log("\n✅ Parameters are unlocked - changes can be initiated");
    }
    
    const pendingVault = await btc1usd.pendingVaultChange();
    console.log("\n⏳ Pending Vault Change:");
    if (pendingVault.newAddress === ethers.ZeroAddress) {
      console.log("  None");
    } else {
      console.log("  New Address:", pendingVault.newAddress);
      console.log("  Execute After:", new Date(Number(pendingVault.executeAfter) * 1000).toISOString());
      const now = Math.floor(Date.now() / 1000);
      if (now >= Number(pendingVault.executeAfter)) {
        console.log("  ✅ Ready to execute");
      } else {
        const remaining = Number(pendingVault.executeAfter) - now;
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        console.log(`  ⏰ Time remaining: ${hours}h ${minutes}m`);
      }
    }
    
    const pendingWeeklyDist = await btc1usd.pendingWeeklyDistributionChange();
    console.log("\n⏳ Pending Weekly Distribution Change:");
    if (pendingWeeklyDist.newAddress === ethers.ZeroAddress) {
      console.log("  None");
    } else {
      console.log("  New Address:", pendingWeeklyDist.newAddress);
      console.log("  Execute After:", new Date(Number(pendingWeeklyDist.executeAfter) * 1000).toISOString());
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Requirements for initiateVaultChange to work:");
    console.log("1. criticalParamsLocked must be FALSE:", !locked ? "✅ PASS" : "❌ FAIL");
    console.log("2. No pending vault change:", pendingVault.newAddress === ethers.ZeroAddress ? "✅ PASS" : "❌ FAIL");
    console.log("3. Transaction sent from owner address (Safe)");
    console.log("4. New vault address != current vault address");
    
    console.log("\n");
    
  } catch (error) {
    console.error("\n❌ Error checking BTC1USD state:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
