const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔮 DEPLOYING CHAINLINK BTC ORACLE (STANDALONE)\n");
  console.log("=".repeat(60));

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying from address:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Deployer balance:", ethers.formatEther(balance), "ETH");

  // Get admin address from environment or deployment script config
  const finalAdminAddress = process.env.ADMIN_ADDRESS || "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835";
  console.log("👤 Deployer address:", deployer.address);
  console.log("👤 Final admin will be:", finalAdminAddress);

  if (finalAdminAddress === deployer.address) {
    console.log("⚠️  WARNING: Admin will remain as deployer (not recommended for production)");
  } else {
    console.log("✅ Admin will be transferred after deployment");
  }

  console.log("\n" + "=".repeat(60));

  // Deploy ChainlinkBTCOracle with deployer as temporary admin
  console.log("\n📦 Deploying ChainlinkBTCOracle...");
  console.log("   Initial admin: deployer (temporary)");
  console.log("   Final admin:", finalAdminAddress);
  
  const ChainlinkBTCOracle = await ethers.getContractFactory("ChainlinkBTCOracle");
  
  // Deploy with deployer as initial admin
  const oracle = await ChainlinkBTCOracle.deploy(deployer.address);
  console.log("⏳ Waiting for deployment confirmation...");
  
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  
  console.log("✅ ChainlinkBTCOracle deployed to:", oracleAddress);

  // Wait for a few confirmations
  console.log("\n⏳ Waiting for block confirmations...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Transfer admin to final admin address if different from deployer
  if (finalAdminAddress !== deployer.address) {
    console.log("\n🔄 Transferring admin control...");
    console.log("   From:", deployer.address);
    console.log("   To:", finalAdminAddress);
    
    try {
      const transferTx = await oracle.transferAdmin(finalAdminAddress);
      console.log("⏳ Waiting for admin transfer transaction...");
      await transferTx.wait();
      console.log("✅ Admin transferred successfully!");
    } catch (error) {
      console.error("❌ Failed to transfer admin:", error.message);
      console.error("⚠️  You will need to manually transfer admin using:");
      console.error(`   await oracle.transferAdmin("${finalAdminAddress}")`);
    }
  } else {
    console.log("\n⚠️  Skipping admin transfer (admin is deployer)");
  }

  // Verify deployment by fetching data
  console.log("\n🔍 Verifying deployment...");
  
  try {
    const feedAddress = await oracle.getPriceFeedAddress();
    console.log("✅ Chainlink feed address:", feedAddress);

    const decimals = await oracle.getPriceFeedDecimals();
    console.log("✅ Feed decimals:", decimals.toString());

    const currentPrice = await oracle.getCurrentPrice();
    const priceFormatted = Number(currentPrice) / 1e8;
    console.log("✅ Current BTC price: $" + priceFormatted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    const lastUpdate = await oracle.getLastUpdate();
    const updateDate = new Date(Number(lastUpdate) * 1000);
    console.log("✅ Last update:", updateDate.toISOString());

    const isStale = await oracle.isStale();
    console.log("✅ Is stale:", isStale ? "⚠️ YES (price is old)" : "✅ NO (price is fresh)");

    const adminAddr = await oracle.admin();
    console.log("✅ Admin address:", adminAddr);
    
    if (adminAddr.toLowerCase() === finalAdminAddress.toLowerCase()) {
      console.log("✅ Admin correctly set to:", finalAdminAddress);
    } else {
      console.log("⚠️  WARNING: Admin mismatch!");
      console.log("   Expected:", finalAdminAddress);
      console.log("   Actual:", adminAddr);
    }

  } catch (error) {
    console.error("⚠️ Verification warning:", error.message);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT SUCCESSFUL!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("ChainlinkBTCOracle:", oracleAddress);
  console.log("\n📝 Deployment Information:");
  console.log("- Network: Base Mainnet");
  console.log("- Chainlink Feed: 0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F");
  console.log("- Deployer:", deployer.address);
  console.log("- Current Admin:", await oracle.admin());
  console.log("\n💡 Next Steps:");
  console.log("1. ✅ Save the oracle address:", oracleAddress);
  console.log("2. ✅ Use this address when deploying/configuring Vault");
  console.log("3. ✅ Verify contract on BaseScan:");
  console.log(`   https://basescan.org/address/${oracleAddress}`);
  
  if ((await oracle.admin()).toLowerCase() !== finalAdminAddress.toLowerCase()) {
    console.log("\n⚠️  IMPORTANT: Admin transfer failed or skipped");
    console.log("   Manually transfer admin using:");
    console.log(`   await oracle.transferAdmin("${finalAdminAddress}")`);
  } else {
    console.log("\n✅ Admin control successfully configured!");
  }
  
  console.log("\n🎯 Oracle is ready to use in your protocol!");
  console.log("=".repeat(60) + "\n");
  
  // Save deployment info
  console.log("📄 Deployment Summary:");
  console.log(JSON.stringify({
    network: "base-mainnet",
    chainlinkBTCOracle: oracleAddress,
    chainlinkFeed: "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F",
    admin: await oracle.admin(),
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  }, null, 2));
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exitCode = 1;
  });
