const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔄 Transferring BTC1USD Ownership to Safe\n");
  
  const btc1usdAddress = process.env.NEXT_PUBLIC_BTC1USD_CONTRACT;
  const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS;
  
  if (!btc1usdAddress || !safeAddress) {
    console.error("❌ Missing environment variables");
    console.error("NEXT_PUBLIC_BTC1USD_CONTRACT:", btc1usdAddress || "NOT SET");
    console.error("NEXT_PUBLIC_SAFE_ADDRESS:", safeAddress || "NOT SET");
    process.exit(1);
  }
  
  console.log("📍 Addresses:");
  console.log("BTC1USD:", btc1usdAddress);
  console.log("Safe:", safeAddress);
  console.log();
  
  // Get signer (must be current owner)
  const [signer] = await ethers.getSigners();
  console.log("🔑 Signer:", signer.address);
  console.log();
  
  // Create contract instance
  const btc1usdABI = [
    "function owner() view returns (address)",
    "function transferOwnership(address newOwner)"
  ];
  
  const btc1usd = new ethers.Contract(btc1usdAddress, btc1usdABI, signer);
  
  try {
    // Check current owner
    const currentOwner = await btc1usd.owner();
    console.log("📊 Current State:");
    console.log("Current Owner:", currentOwner);
    console.log("Signer matches owner:", currentOwner.toLowerCase() === signer.address.toLowerCase());
    console.log();
    
    if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
      console.error("❌ ERROR: You are not the current owner!");
      console.error("Current owner is:", currentOwner);
      console.error("You are:", signer.address);
      console.error("\nYou need to connect with the owner wallet to transfer ownership.");
      process.exit(1);
    }
    
    if (currentOwner.toLowerCase() === safeAddress.toLowerCase()) {
      console.log("✅ Safe is already the owner! No transfer needed.");
      process.exit(0);
    }
    
    // Transfer ownership
    console.log("🚀 Transferring ownership to Safe...");
    console.log("From:", currentOwner);
    console.log("To:", safeAddress);
    console.log();
    
    const tx = await btc1usd.transferOwnership(safeAddress);
    console.log("📝 Transaction sent:", tx.hash);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!");
    console.log("Block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log();
    
    // Verify new owner
    const newOwner = await btc1usd.owner();
    console.log("🔍 Verification:");
    console.log("New Owner:", newOwner);
    console.log("Matches Safe:", newOwner.toLowerCase() === safeAddress.toLowerCase() ? "✅ YES" : "❌ NO");
    console.log();
    
    if (newOwner.toLowerCase() === safeAddress.toLowerCase()) {
      console.log("🎉 SUCCESS! Ownership transferred to Safe.");
      console.log();
      console.log("📋 Next Steps:");
      console.log("1. Now you can use the BTC1USD Timelock UI");
      console.log("2. Click 'Initiate Vault Change' - it will generate calldata");
      console.log("3. Copy the contract address and calldata");
      console.log("4. Go to Safe UI: https://app.safe.global/base-sep:" + safeAddress);
      console.log("5. Create new transaction with the calldata");
      console.log("6. Sign and execute with Safe signers");
    } else {
      console.log("❌ Transfer may have failed. Please check manually.");
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.message.includes("Ownable: caller is not the owner")) {
      console.error("\nYou need to use the current owner wallet to transfer ownership.");
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
