/**
 * Transfer Ownership of Wallet Contracts
 * 
 * This script transfers ownership of DevWallet, EndowmentWallet, and MerkleFeeCollector
 * from the deployer to the configured admin address.
 * 
 * Run with: npx hardhat run scripts/transfer-wallet-ownership.js --network base-sepolia
 */

const hre = require("hardhat");

async function main() {
  console.log("🔄 Starting ownership transfer process...\n");

  // Get the deployer (current owner)
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deployer address (current owner):", deployer.address);

  // Load deployment config
  const deployment = require("../deployment-base-sepolia.json");
  
  const targetAdmin = deployment.config.admin;
  console.log("🎯 Target admin address:", targetAdmin);
  console.log("");

  // Contract addresses
  const contracts = [
    {
      name: "DevWallet",
      address: deployment.wallets.devWallet,
    },
    {
      name: "EndowmentWallet",
      address: deployment.wallets.endowmentWallet,
    },
    {
      name: "MerkleFeeCollector",
      address: deployment.wallets.merklFeeCollector,
    },
  ];

  // Ownable ABI for transferOwnership
  const OWNABLE_ABI = [
    "function owner() view returns (address)",
    "function transferOwnership(address newOwner) external",
  ];

  // Transfer ownership for each contract
  for (const contract of contracts) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 Processing: ${contract.name}`);
    console.log(`📍 Contract address: ${contract.address}`);

    try {
      // Get contract instance
      const contractInstance = new hre.ethers.Contract(
        contract.address,
        OWNABLE_ABI,
        deployer
      );

      // Check current owner
      const currentOwner = await contractInstance.owner();
      console.log(`👤 Current owner: ${currentOwner}`);

      // Check if already owned by target admin
      if (currentOwner.toLowerCase() === targetAdmin.toLowerCase()) {
        console.log(`✅ Already owned by target admin. Skipping.`);
        continue;
      }

      // Check if deployer is the current owner
      if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log(`⚠️  WARNING: Deployer is not the current owner!`);
        console.log(`   Current owner: ${currentOwner}`);
        console.log(`   Deployer: ${deployer.address}`);
        console.log(`   ❌ Cannot transfer ownership. Skipping.`);
        continue;
      }

      // Transfer ownership
      console.log(`🔄 Transferring ownership to: ${targetAdmin}`);
      const tx = await contractInstance.transferOwnership(targetAdmin);
      console.log(`📤 Transaction hash: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);
      
      await tx.wait();
      console.log(`✅ Ownership transferred successfully!`);

      // Verify new owner
      const newOwner = await contractInstance.owner();
      console.log(`👤 New owner: ${newOwner}`);

      if (newOwner.toLowerCase() === targetAdmin.toLowerCase()) {
        console.log(`✅ Ownership transfer verified!`);
      } else {
        console.log(`❌ Ownership transfer verification failed!`);
      }

    } catch (error) {
      console.error(`❌ Error processing ${contract.name}:`, error.message);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n✅ Ownership transfer process complete!`);
  console.log(`\n📋 Summary:`);
  console.log(`   • DevWallet: ${contracts[0].address}`);
  console.log(`   • EndowmentWallet: ${contracts[1].address}`);
  console.log(`   • MerkleFeeCollector: ${contracts[2].address}`);
  console.log(`   • New owner: ${targetAdmin}`);
  console.log(`\n🔍 Verify on Block Explorer:`);
  for (const contract of contracts) {
    console.log(`   ${contract.name}: https://sepolia.basescan.org/address/${contract.address}#readContract`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
