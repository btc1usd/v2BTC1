const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * Deploy New Vault Implementation with 1% Endowment Fee
 * 
 * This script deploys a new Vault implementation to Base Sepolia.
 * The new implementation changes ENDOWMENT_FEE_MINT from 0.1% to 1%.
 * 
 * IMPORTANT: This only deploys the implementation!
 * To complete the upgrade, the Safe multisig must:
 * 1. Call proxyAdmin.upgrade(vaultProxy, newVaultImpl)
 * 
 * Network: Base Sepolia
 * Upgradeable: Yes (via ProxyAdmin)
 */

async function main() {
  console.log("=== DEPLOYING NEW VAULT IMPLEMENTATION (1% ENDOWMENT FEE) ===\n");

  // Check if private key is configured
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY environment variable is required.\n" +
      "Please add your Base Sepolia private key to .env.local file:\n" +
      "DEPLOYER_PRIVATE_KEY=0xYourPrivateKeyHere"
    );
  }

  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(
      "No signers available. Please check:\n" +
      "1. DEPLOYER_PRIVATE_KEY is set in .env\n" +
      "2. The private key is valid\n" +
      "3. You have Base Sepolia ETH in your wallet"
    );
  }

  const deployer = signers[0];
  console.log("Deploying with account:", deployer.address);

  // Check balance
  let balance;
  try {
    balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");
  } catch (error) {
    console.log("⚠️  Warning: Could not fetch account balance from RPC");
    console.log("  Error:", error.message);
    console.log("  Proceeding with deployment...\n");
    balance = ethers.parseEther("1.0"); // Assume sufficient balance
  }

  // Verify sufficient balance
  const minBalance = ethers.parseEther("0.01"); // Minimum 0.01 ETH for deployment
  if (balance < minBalance) {
    throw new Error("Insufficient balance. Need at least 0.01 ETH for deployment.");
  }

  // Load existing deployment info
  console.log("\n📋 Loading existing deployment info...");
  let existingDeployment;
  try {
    const deploymentData = fs.readFileSync("deployment-base-sepolia.json", "utf8");
    existingDeployment = JSON.parse(deploymentData);
    console.log("  ✅ Loaded deployment-base-sepolia.json");
  } catch (error) {
    throw new Error(
      "Could not load deployment-base-sepolia.json.\n" +
      "Please ensure you have deployed the protocol first using deploy-complete-base-sepolia.js"
    );
  }

  console.log("\n📊 Current Deployment:");
  console.log("  Network:           ", existingDeployment.network);
  console.log("  Vault Proxy:       ", existingDeployment.core.vault);
  console.log("  Current Impl:      ", existingDeployment.implementations.vault);
  console.log("  ProxyAdmin:        ", existingDeployment.proxyAdmin);
  console.log("  Admin (Safe):      ", existingDeployment.config.admin);

  // Helper function to deploy with retry logic
  async function deployContract(name, factory, ...args) {
    let retries = 5;
    while (retries > 0) {
      try {
        console.log(`\n  📦 Deploying ${name}...`);
        const contract = await factory.deploy(...args);
        console.log(`  ⏳ Waiting for ${name} deployment confirmation...`);
        await contract.waitForDeployment();
        const address = await contract.getAddress();
        console.log(`  ✅ ${name} deployed to: ${address}`);
        return { contract, address };
      } catch (error) {
        if (error.message.includes("nonce") && retries > 1) {
          console.log(`  ⚠️  Nonce issue, retrying... (${retries - 1} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          retries--;
        } else if (
          (error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
           error.message.includes('timeout') ||
           error.message.includes('ETIMEDOUT') ||
           error.message.includes('ECONNRESET') ||
           error.message.includes('Forwarder error') ||
           error.message.includes('Too Many Requests')) && retries > 1
        ) {
          console.log(`  ⚠️  Connection issue or rate limit, retrying... (${retries - 1} attempts left)`);
          console.log(`  ℹ️  Waiting 30 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 30000));
          retries--;
        } else if (
          (error.message.includes('rate limit') ||
           error.message.includes('429')) && retries > 1
        ) {
          console.log(`  ⚠️  Rate limited, waiting 60 seconds... (${retries - 1} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 60000));
          retries--;
        } else {
          throw error;
        }
      }
    }
  }

  // ==================== DEPLOY NEW VAULT IMPLEMENTATION ====================
  console.log("\n🏗️  STEP 1: Deploying new Vault implementation...\n");
  console.log("  📝 Changes in new implementation:");
  console.log("     - ENDOWMENT_FEE_MINT: 0.1% → 1.0% (0.001e8 → 0.01e8)");
  console.log("     - This increases endowment allocation from 0.1% to 1% on mints\n");

  const VaultUpgradeable = await ethers.getContractFactory("Vault");
  const { address: newVaultImplAddress } = await deployContract(
    "Vault Implementation (v2 - 1% Endowment Fee)",
    VaultUpgradeable
  );

  console.log("\n  ⏳ Waiting for final confirmations...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  // ==================== VERIFY NEW IMPLEMENTATION ====================
  console.log("\n✅ STEP 2: Verifying new implementation...\n");

  try {
    // Create instance of new implementation (not connected to proxy)
    const newVaultImpl = await ethers.getContractAt("Vault", newVaultImplAddress);
    
    // Read constants from new implementation
    const devFeeMint = await newVaultImpl.DEV_FEE_MINT();
    const devFeeRedeem = await newVaultImpl.DEV_FEE_REDEEM();
    const endowmentFeeMint = await newVaultImpl.ENDOWMENT_FEE_MINT();
    const minCollateralRatio = await newVaultImpl.MIN_COLLATERAL_RATIO();

    console.log("  📊 New Implementation Constants:");
    console.log(`     DEV_FEE_MINT:         ${ethers.formatUnits(devFeeMint, 8)} (${Number(devFeeMint) / 1e8 * 100}%)`);
    console.log(`     DEV_FEE_REDEEM:       ${ethers.formatUnits(devFeeRedeem, 8)} (${Number(devFeeRedeem) / 1e8 * 100}%)`);
    console.log(`     ENDOWMENT_FEE_MINT:   ${ethers.formatUnits(endowmentFeeMint, 8)} (${Number(endowmentFeeMint) / 1e8 * 100}%) ✨`);
    console.log(`     MIN_COLLATERAL_RATIO: ${ethers.formatUnits(minCollateralRatio, 8)}`);

    // Verify the fee is correct (1% = 0.01e8 = 1000000)
    if (endowmentFeeMint.toString() === "1000000") {
      console.log("\n  ✅ Endowment fee correctly set to 1% (0.01e8)");
    } else {
      console.log("\n  ⚠️  Warning: Endowment fee does not match expected value!");
      console.log(`     Expected: 1000000 (1%)`);
      console.log(`     Got: ${endowmentFeeMint.toString()}`);
    }
  } catch (error) {
    console.log("  ⚠️  Could not verify implementation:", error.message);
  }

  // ==================== GENERATE UPGRADE CALLDATA ====================
  console.log("\n🔧 STEP 3: Generating upgrade calldata for Safe...\n");

  const proxyAdminAddress = existingDeployment.proxyAdmin;
  const vaultProxyAddress = existingDeployment.core.vault;

  // Generate the upgrade calldata
  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  const proxyAdmin = await ethers.getContractAt("ProxyAdmin", proxyAdminAddress);
  
  // The function signature is: upgrade(address proxy, address implementation)
  const upgradeCalldata = proxyAdmin.interface.encodeFunctionData("upgrade", [
    vaultProxyAddress,
    newVaultImplAddress
  ]);

  console.log("  📝 Upgrade Transaction Details:");
  console.log(`     To Address:    ${proxyAdminAddress}`);
  console.log(`     Value:         0 ETH`);
  console.log(`     Function:      upgrade(address,address)`);
  console.log(`     Calldata:      ${upgradeCalldata}`);
  console.log("");
  console.log("  📋 Function Arguments:");
  console.log(`     proxy:              ${vaultProxyAddress}`);
  console.log(`     newImplementation:  ${newVaultImplAddress}`);

  // ==================== SAVE UPGRADE INFO ====================
  console.log("\n💾 STEP 4: Saving upgrade information...\n");

  const upgradeInfo = {
    network: "base-sepolia",
    chainId: 84532,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    upgrade: {
      contract: "Vault",
      proxyAddress: vaultProxyAddress,
      oldImplementation: existingDeployment.implementations.vault,
      newImplementation: newVaultImplAddress,
      proxyAdmin: proxyAdminAddress,
      safeMultisig: existingDeployment.config.admin,
      changes: [
        "ENDOWMENT_FEE_MINT: 0.001e8 (0.1%) → 0.01e8 (1.0%)"
      ],
      upgradeCalldata: upgradeCalldata,
      upgradeTransaction: {
        to: proxyAdminAddress,
        value: "0",
        data: upgradeCalldata,
        description: "Upgrade Vault to v2 (1% Endowment Fee)"
      }
    },
    explorerUrls: {
      newImplementation: `https://sepolia.basescan.org/address/${newVaultImplAddress}`,
      vaultProxy: `https://sepolia.basescan.org/address/${vaultProxyAddress}`,
      proxyAdmin: `https://sepolia.basescan.org/address/${proxyAdminAddress}`
    }
  };

  fs.writeFileSync(
    "vault-upgrade-base-sepolia.json",
    JSON.stringify(upgradeInfo, null, 2)
  );
  console.log("  ✅ Upgrade info saved to: vault-upgrade-base-sepolia.json");

  // Update the main deployment file with new implementation address
  existingDeployment.implementations.vault = newVaultImplAddress;
  existingDeployment.implementations.vaultV2_timestamp = upgradeInfo.timestamp;
  existingDeployment.implementations.vaultV2_changes = upgradeInfo.upgrade.changes;
  
  fs.writeFileSync(
    "deployment-base-sepolia.json",
    JSON.stringify(existingDeployment, null, 2)
  );
  console.log("  ✅ Updated deployment-base-sepolia.json with new implementation address");

  // ==================== DEPLOYMENT SUMMARY ====================
  console.log("\n" + "=".repeat(80));
  console.log("📋 VAULT UPGRADE SUMMARY - BASE SEPOLIA");
  console.log("=".repeat(80));

  console.log("\n🎯 New Implementation Deployed:");
  console.log("  Address:           ", newVaultImplAddress);
  console.log("  Endowment Fee:     ", "1% (increased from 0.1%)");
  console.log("  Explorer:          ", `https://sepolia.basescan.org/address/${newVaultImplAddress}`);

  console.log("\n🔐 Upgrade Execution (Required):");
  console.log("  ProxyAdmin:        ", proxyAdminAddress);
  console.log("  Vault Proxy:       ", vaultProxyAddress);
  console.log("  Safe Multisig:     ", existingDeployment.config.admin);

  console.log("\n" + "=".repeat(80));
  console.log("✅ NEW IMPLEMENTATION DEPLOYED SUCCESSFULLY!");
  console.log("=".repeat(80));

  console.log("\n📝 NEXT STEPS - UPGRADE INSTRUCTIONS:");
  console.log("\n1️⃣  VERIFY THE NEW IMPLEMENTATION (Optional but Recommended)");
  console.log("   Run on BaseScan: https://sepolia.basescan.org/address/" + newVaultImplAddress);
  console.log("   Contract: Vault.sol");
  console.log("");

  console.log("2️⃣  EXECUTE UPGRADE VIA SAFE MULTISIG");
  console.log("   ⚠️  IMPORTANT: Only the Safe multisig can execute this upgrade!");
  console.log("");
  console.log("   Option A: Using Safe UI");
  console.log("   ────────────────────────");
  console.log("   a. Go to Safe: https://app.safe.global/home?safe=base-sep:" + existingDeployment.config.admin.substring(2));
  console.log("   b. Click 'New Transaction' → 'Contract Interaction'");
  console.log("   c. Enter ProxyAdmin address:");
  console.log("      " + proxyAdminAddress);
  console.log("   d. Select function: upgrade(address proxy, address implementation)");
  console.log("   e. Enter parameters:");
  console.log("      proxy:         " + vaultProxyAddress);
  console.log("      implementation: " + newVaultImplAddress);
  console.log("   f. Review and submit transaction");
  console.log("   g. Collect required signatures");
  console.log("   h. Execute the transaction");
  console.log("");

  console.log("   Option B: Using Transaction Builder");
  console.log("   ───────────────────────────────────");
  console.log("   a. Use the calldata provided below");
  console.log("   b. Send transaction to ProxyAdmin: " + proxyAdminAddress);
  console.log("   c. Calldata: " + upgradeCalldata);
  console.log("");

  console.log("3️⃣  VERIFY UPGRADE WAS SUCCESSFUL");
  console.log("   After the Safe transaction is executed:");
  console.log("   a. Check ProxyAdmin.getProxyImplementation(vaultProxy)");
  console.log("   b. Should return: " + newVaultImplAddress);
  console.log("   c. Verify ENDOWMENT_FEE_MINT is now 1% (0.01e8 = 1000000)");
  console.log("");

  console.log("4️⃣  TEST THE UPGRADED VAULT");
  console.log("   a. Test mint operation (should charge 1% endowment fee)");
  console.log("   b. Verify endowment wallet receives correct amount");
  console.log("   c. Monitor for any unexpected behavior");
  console.log("");

  console.log("📄 FILES CREATED:");
  console.log("   - vault-upgrade-base-sepolia.json (upgrade details & calldata)");
  console.log("   - deployment-base-sepolia.json (updated with new implementation)");
  console.log("");

  console.log("🔍 USEFUL LINKS:");
  console.log("   New Implementation: https://sepolia.basescan.org/address/" + newVaultImplAddress);
  console.log("   Vault Proxy:        https://sepolia.basescan.org/address/" + vaultProxyAddress);
  console.log("   ProxyAdmin:         https://sepolia.basescan.org/address/" + proxyAdminAddress);
  console.log("   Safe Multisig:      https://app.safe.global/home?safe=base-sep:" + existingDeployment.config.admin.substring(2));
  console.log("");

  return upgradeInfo;
}

main()
  .then(() => {
    console.log("🎉 Implementation deployed! Waiting for Safe to execute upgrade.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exitCode = 1;
  });
