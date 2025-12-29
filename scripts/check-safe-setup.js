const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔍 Checking Safe Configuration\n");
  
  // Check environment variables
  const btc1usdAddress = process.env.NEXT_PUBLIC_BTC1USD_CONTRACT;
  const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS;
  const uiController = process.env.NEXT_PUBLIC_UI_CONTROLLER;
  const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET;
  
  console.log("📍 Environment Variables:");
  console.log("BTC1USD:", btc1usdAddress || "❌ NOT SET");
  console.log("Safe Address:", safeAddress || "❌ NOT SET");
  console.log("UI Controller:", uiController || "❌ NOT SET");
  console.log("Admin Wallet:", adminWallet || "❌ NOT SET");
  console.log();
  
  if (!btc1usdAddress) {
    console.error("❌ NEXT_PUBLIC_BTC1USD_CONTRACT not found in .env");
    process.exit(1);
  }
  
  // Get provider
  const provider = ethers.provider;
  
  // Check BTC1USD owner
  const btc1usdABI = ["function owner() view returns (address)"];
  const btc1usd = new ethers.Contract(btc1usdAddress, btc1usdABI, provider);
  
  try {
    const owner = await btc1usd.owner();
    console.log("🔑 BTC1USD Contract Owner:", owner);
    console.log();
    
    // Check if Safe is configured
    if (!safeAddress) {
      console.log("⚠️  WARNING: NEXT_PUBLIC_SAFE_ADDRESS not configured!");
      console.log();
      console.log("Current situation:");
      console.log("- BTC1USD owner:", owner);
      console.log("- UI Controller:", uiController || "Not set");
      console.log("- Admin Wallet:", adminWallet || "Not set");
      console.log();
      
      if (owner.toLowerCase() === uiController?.toLowerCase() || 
          owner.toLowerCase() === adminWallet?.toLowerCase()) {
        console.log("✅ Owner matches UI Controller/Admin - Direct execution possible");
        console.log();
        console.log("📋 OPTIONS:");
        console.log();
        console.log("OPTION 1: Execute directly (if you control the owner wallet)");
        console.log("- Connect with wallet:", owner);
        console.log("- Call initiateVaultChange() directly on BTC1USD contract");
        console.log("- No Safe required");
        console.log();
        console.log("OPTION 2: Set up Safe multisig (recommended for production)");
        console.log("1. Go to https://app.safe.global");
        console.log("2. Create new Safe on Base Sepolia");
        console.log("3. Add to .env: NEXT_PUBLIC_SAFE_ADDRESS=<safe-address>");
        console.log("4. Transfer BTC1USD ownership to Safe");
        console.log("   - Call: btc1usd.transferOwnership(safeAddress)");
        console.log();
      } else {
        console.log("❌ Owner doesn't match UI Controller or Admin Wallet");
        console.log("You need to either:");
        console.log("1. Connect with the owner wallet:", owner);
        console.log("2. Or transfer ownership to your wallet/Safe");
      }
    } else {
      // Safe is configured, check if it exists
      console.log("📦 Checking Safe at:", safeAddress);
      const safeCode = await provider.getCode(safeAddress);
      
      if (safeCode === '0x' || safeCode === '0x0') {
        console.log("❌ ERROR: No contract found at Safe address!");
        console.log("The address in NEXT_PUBLIC_SAFE_ADDRESS doesn't have a contract.");
        console.log("Please verify the address or create a new Safe.");
      } else {
        console.log("✅ Safe contract exists");
        console.log();
        
        // Check if Safe is the owner
        if (owner.toLowerCase() === safeAddress.toLowerCase()) {
          console.log("✅ Safe is the BTC1USD owner - Ready for Safe transactions");
          console.log();
          console.log("📋 To execute initiateVaultChange:");
          console.log("1. Generate transaction in UI");
          console.log("2. Copy contract address and calldata");
          console.log("3. Go to Safe UI: https://app.safe.global/base-sep:" + safeAddress);
          console.log("4. Create new transaction:");
          console.log("   - To:", btc1usdAddress);
          console.log("   - Value: 0");
          console.log("   - Data: <calldata from UI>");
          console.log("5. Sign and execute");
        } else {
          console.log("⚠️  WARNING: Safe exists but is NOT the owner");
          console.log("- Safe address:", safeAddress);
          console.log("- BTC1USD owner:", owner);
          console.log();
          console.log("You need to transfer ownership:");
          console.log("1. Connect with current owner:", owner);
          console.log("2. Call: btc1usd.transferOwnership('" + safeAddress + "')");
        }
      }
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
