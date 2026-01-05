const { ethers } = require("hardhat");

async function main() {
  console.log("=== TRANSFERRING BTC1USD OWNERSHIP TO SAFE ===\n");

  const deployer = (await ethers.getSigners())[0];
  const btc1usdAddress = "0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5";
  const safeAddress = "0xA1D4de75082562eA776b160e605acD587668111B";

  console.log("Deployer:", deployer.address);
  console.log("BTC1USD:", btc1usdAddress);
  console.log("Safe:", safeAddress);
  console.log("");

  const BTC1USD = await ethers.getContractFactory("BTC1USD");
  const btc1usd = BTC1USD.attach(btc1usdAddress);

  // Check current owner
  const currentOwner = await btc1usd.owner();
  console.log("Current Owner:", currentOwner);

  if (currentOwner.toLowerCase() === safeAddress.toLowerCase()) {
    console.log("✅ Safe is already the owner!");
    return;
  }

  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("❌ You are not the current owner!");
    console.log("   Current owner:", currentOwner);
    console.log("   Your address:", deployer.address);
    return;
  }

  // Check pending owner
  const pendingOwner = await btc1usd.pendingOwner();
  console.log("Pending Owner:", pendingOwner);

  if (pendingOwner.toLowerCase() === safeAddress.toLowerCase()) {
    console.log("\n⚠️  Transfer already initiated!");
    console.log("⚠️  Safe needs to call acceptOwnership() to complete the transfer.");
    console.log("\n📋 Safe Transaction Data:");
    console.log("   To:", btc1usdAddress);
    console.log("   Function: acceptOwnership()");
    console.log("   Data: 0x79ba5097");
    return;
  }

  // Initiate transfer
  console.log("\n🔄 Initiating ownership transfer...");
  
  try {
    const tx = await btc1usd.transferOwnership(safeAddress);
    console.log("⏳ Waiting for transaction confirmation...");
    await tx.wait();
    console.log("✅ Ownership transfer initiated!");
    
    // Verify pending owner
    const newPendingOwner = await btc1usd.pendingOwner();
    console.log("\n✓ Pending Owner:", newPendingOwner);
    
    if (newPendingOwner.toLowerCase() === safeAddress.toLowerCase()) {
      console.log("✅ SUCCESS! Transfer initiated correctly.");
      console.log("\n📋 NEXT STEP: Safe must accept ownership");
      console.log("   Go to: https://app.safe.global/home?safe=base:" + safeAddress);
      console.log("   Transaction Builder:");
      console.log("   To: " + btc1usdAddress);
      console.log("   Function: acceptOwnership()");
      console.log("   Data: 0x79ba5097");
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
