const { ethers } = require("hardhat");

async function main() {
  console.log("=== CONTINUING BASE MAINNET DEPLOYMENT ===\n");

  const deployer = (await ethers.getSigners())[0];
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Already deployed addresses (from your output)
  const deployed = {
    proxyAdmin: "0x9DCe364665f1d99950e485cb5D19Ad79a704560B",
    devWallet: "0xf354e4577236edF17DA88CBc0A6Eb7A5a480C3aF",
    endowmentWallet: "0x11C90FF555381fc8F1f205Ccd9d3f2278213A275",
    merklFeeCollector: "0xAB91b3883BDd83A550adf4C837017369d91673d0",
    btc1usd: "0x0077084669695A0Ce1259E4247C107AC9a2b2A79",
    priceOracle: "0x6Ba5b31C02a88a361F31F9640a0386Bed9048FaF",
    vault: "0x19A3a620e8daC146bAef15a15EC058e5110b76c2",
    merkleDistributor: "0xe437FAeEA3ca1d1bf567c3c2B08AA83D6EcbF4eB",
  };

  const config = {
    admin: "0xA1D4de75082562eA776b160e605acD587668111B",
    safeAddress: "0xA1D4de75082562eA776b160e605acD587668111B",
    emergencyCouncil: "0xA1D4de75082562eA776b160e605acD587668111B",
    collateralTokens: {
      wbtc: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
      cbbtc: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      tbtc: "0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b",
    },
  };

  console.log("✅ Already deployed contracts:");
  console.log("  ProxyAdmin:", deployed.proxyAdmin);
  console.log("  BTC1USD:", deployed.btc1usd);
  console.log("  Vault:", deployed.vault);
  console.log("  MerkleDistributor:", deployed.merkleDistributor);
  console.log("\n🔄 Need to deploy:");
  console.log("  - WeeklyDistribution");
  console.log("  - Governance contracts (EndowmentManager, ProtocolGovernance, DAO)");
  console.log("  - Initialize connections");
  console.log("  - Add collateral");
  console.log("  - Transfer ownership\n");

  // Helper functions
  async function sendTransaction(name, txPromise, maxRetries = 5) {
    let retries = maxRetries;
    while (retries > 0) {
      try {
        const tx = await txPromise();
        await tx.wait();
        console.log(`  ✅ ${name}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
      } catch (error) {
        if (error.message.includes("nonce") && retries > 1) {
          console.log(`  ⚠️  ${name} - nonce issue, retrying... (${retries - 1} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          retries--;
        } else if ((error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                    error.message.includes('timeout') ||
                    error.message.includes('ETIMEDOUT') ||
                    error.message.includes('ECONNRESET')) && retries > 1) {
          console.log(`  ⚠️  ${name} - connection issue, retrying... (${retries - 1} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 30000));
          retries--;
        } else {
          console.log(`  ❌ ${name} failed:`, error.message.split('\n')[0]);
          return false;
        }
      }
    }
    return false;
  }

  async function deployContract(name, factory, ...args) {
    let retries = 5;
    while (retries > 0) {
      try {
        console.log(`  📦 Deploying ${name}...`);
        const contract = await factory.deploy(...args);
        console.log(`  ⏳ Waiting for ${name} confirmation...`);
        await contract.waitForDeployment();
        const address = await contract.getAddress();
        console.log(`  ✅ ${name} deployed to: ${address}`);
        return { contract, address };
      } catch (error) {
        if ((error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
             error.message.includes('timeout') ||
             error.message.includes('nonce')) && retries > 1) {
          console.log(`  ⚠️  Retry... (${retries - 1} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 30000));
          retries--;
        } else {
          throw error;
        }
      }
    }
  }

  // ==================== CONTINUE: DEPLOY WEEKLY DISTRIBUTION ====================
  console.log("\n💰 Deploying WeeklyDistribution...\n");

  const UpgradeableProxy = await ethers.getContractFactory("UpgradeableProxy");
  const WeeklyDistributionUpgradeable = await ethers.getContractFactory("WeeklyDistributionUpgradeable");

  const { address: weeklyDistImplAddress } = await deployContract(
    "WeeklyDistribution Implementation",
    WeeklyDistributionUpgradeable
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  const { address: weeklyDistProxyAddress } = await deployContract(
    "WeeklyDistribution Proxy",
    UpgradeableProxy,
    weeklyDistImplAddress,
    deployed.proxyAdmin
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  const weeklyDistribution = WeeklyDistributionUpgradeable.attach(weeklyDistProxyAddress);
  await sendTransaction(
    "WeeklyDistribution initialized",
    () => weeklyDistribution.initialize(
      config.safeAddress,
      deployed.btc1usd,
      deployed.vault,
      deployed.devWallet,
      deployed.endowmentWallet,
      deployed.merklFeeCollector,
      deployed.merkleDistributor
    )
  );
  const weeklyDistributionAddress = weeklyDistProxyAddress;

  console.log("\n✅ WeeklyDistribution deployed:", weeklyDistributionAddress);

  // ==================== SET VAULT AND WEEKLY DISTRIBUTION IN BTC1USD ====================
  console.log("\n🔗 Setting Vault and WeeklyDistribution in BTC1USD...\n");

  const BTC1USD = await ethers.getContractFactory("BTC1USD");
  const btc1usd = BTC1USD.attach(deployed.btc1usd);

  // Check current owner
  const currentOwner = await btc1usd.owner();
  console.log("  BTC1USD Owner:", currentOwner);
  console.log("  Deployer:", deployer.address);

  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("\n  ⚠️  BTC1USD is owned by Safe multisig, not deployer");
    console.log("  ⚠️  The following calls must be made through Safe:");
    console.log("      1. btc1usd.setVault(\"" + deployed.vault + "\")");
    console.log("      2. btc1usd.setWeeklyDistribution(\"" + weeklyDistributionAddress + "\")");
    console.log("\n  ℹ️  Skipping these calls - they must be executed via Safe UI\n");
  } else {
    await sendTransaction(
      "BTC1USD vault address set",
      () => btc1usd.setVault(deployed.vault)
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    await sendTransaction(
      "BTC1USD weeklyDistribution address set",
      () => btc1usd.setWeeklyDistribution(weeklyDistributionAddress)
    );

    console.log("  ✅ BTC1USD configured successfully");
  }

  // ==================== DEPLOY GOVERNANCE ====================
  console.log("\n🏛️  Deploying Governance...\n");

  const EndowmentManagerUpgradeable = await ethers.getContractFactory("EndowmentManagerUpgradeable");
  const { address: endowmentImplAddress } = await deployContract(
    "EndowmentManager Implementation",
    EndowmentManagerUpgradeable
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  const { address: endowmentProxyAddress } = await deployContract(
    "EndowmentManager Proxy",
    UpgradeableProxy,
    endowmentImplAddress,
    deployed.proxyAdmin
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  const endowmentManager = EndowmentManagerUpgradeable.attach(endowmentProxyAddress);
  await sendTransaction(
    "EndowmentManager initialized",
    () => endowmentManager.initialize(
      config.safeAddress,
      deployed.btc1usd,
      deployed.endowmentWallet
    )
  );
  const endowmentManagerAddress = endowmentProxyAddress;

  await new Promise(resolve => setTimeout(resolve, 5000));

  const ProtocolGovernanceUpgradeable = await ethers.getContractFactory("ProtocolGovernanceUpgradeable");
  const { address: protocolGovImplAddress } = await deployContract(
    "ProtocolGovernance Implementation",
    ProtocolGovernanceUpgradeable
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  const { address: protocolGovProxyAddress } = await deployContract(
    "ProtocolGovernance Proxy",
    UpgradeableProxy,
    protocolGovImplAddress,
    deployed.proxyAdmin
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  const protocolGovernance = ProtocolGovernanceUpgradeable.attach(protocolGovProxyAddress);
  await sendTransaction(
    "ProtocolGovernance initialized",
    () => protocolGovernance.initialize(
      config.safeAddress,
      config.emergencyCouncil
    )
  );
  const protocolGovernanceAddress = protocolGovProxyAddress;

  await new Promise(resolve => setTimeout(resolve, 5000));

  const DAOUpgradeable = await ethers.getContractFactory("DAOUpgradeable");
  const { address: daoImplAddress } = await deployContract(
    "DAO Implementation",
    DAOUpgradeable
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  const { address: daoProxyAddress } = await deployContract(
    "DAO Proxy",
    UpgradeableProxy,
    daoImplAddress,
    deployed.proxyAdmin
  );

  await new Promise(resolve => setTimeout(resolve, 5000));

  const dao = DAOUpgradeable.attach(daoProxyAddress);
  await sendTransaction(
    "DAO initialized",
    () => dao.initialize(
      deployed.btc1usd,
      protocolGovernanceAddress
    )
  );
  const daoAddress = daoProxyAddress;

  console.log("\n✅ All governance contracts deployed!");

  // ==================== INITIALIZE CONNECTIONS ====================
  console.log("\n🔗 Initializing connections...\n");

  const MerkleDistributorUpgradeable = await ethers.getContractFactory("MerkleDistributorUpgradeable");
  const merkleDistributor = MerkleDistributorUpgradeable.attach(deployed.merkleDistributor);

  await sendTransaction(
    "MerkleDistributor weeklyDistribution set",
    () => merkleDistributor.setWeeklyDistribution(weeklyDistributionAddress)
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  await sendTransaction(
    "ProtocolGovernance contracts initialized",
    () => protocolGovernance.initializeContracts(
      deployed.btc1usd,
      deployed.vault,
      weeklyDistributionAddress,
      endowmentManagerAddress,
      deployed.priceOracle
    )
  );

  // ==================== ADD COLLATERAL ====================
  console.log("\n🔐 Adding collateral tokens...\n");

  const Vault = await ethers.getContractFactory("Vault");
  const vault = Vault.attach(deployed.vault);

  await sendTransaction(
    "Added WBTC as collateral",
    () => vault.addCollateral(config.collateralTokens.wbtc)
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  await sendTransaction(
    "Added cbBTC as collateral",
    () => vault.addCollateral(config.collateralTokens.cbbtc)
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  await sendTransaction(
    "Added tBTC as collateral",
    () => vault.addCollateral(config.collateralTokens.tbtc)
  );

  // ==================== SAVE DEPLOYMENT INFO ====================
  const fs = require("fs");
  const deploymentInfo = {
    network: "base-mainnet",
    chainId: 8453,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    proxyInfrastructure: {
      proxyAdmin: deployed.proxyAdmin,
    },
    collateralTokens: config.collateralTokens,
    wallets: {
      devWallet: deployed.devWallet,
      endowmentWallet: deployed.endowmentWallet,
      merklFeeCollector: deployed.merklFeeCollector,
    },
    core: {
      btc1usd: deployed.btc1usd,
      vault: deployed.vault,
      chainlinkBTCOracle: deployed.priceOracle,
      chainlinkFeed: "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F",
    },
    distribution: {
      merkleDistributor: deployed.merkleDistributor,
      weeklyDistribution: weeklyDistributionAddress,
    },
    governance: {
      endowmentManager: endowmentManagerAddress,
      protocolGovernance: protocolGovernanceAddress,
      dao: daoAddress,
    },
    config: {
      admin: config.admin,
      devWallet: deployed.devWallet,
      endowmentWallet: deployed.endowmentWallet,
      merklFeeCollector: deployed.merklFeeCollector,
      emergencyCouncil: config.emergencyCouncil,
    },
  };

  fs.writeFileSync(
    "deployment-base-mainnet.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n" + "=".repeat(80));
  console.log("✅ DEPLOYMENT COMPLETED!");
  console.log("=".repeat(80));
  console.log("\n📋 Contract Addresses:");
  console.log("  BTC1USD:", deployed.btc1usd);
  console.log("  Vault:", deployed.vault);
  console.log("  WeeklyDistribution:", weeklyDistributionAddress);
  console.log("  MerkleDistributor:", deployed.merkleDistributor);
  console.log("  EndowmentManager:", endowmentManagerAddress);
  console.log("  ProtocolGovernance:", protocolGovernanceAddress);
  console.log("  DAO:", daoAddress);
  console.log("\n💾 Saved to: deployment-base-mainnet.json");
  console.log("\n⚠️  NEXT STEP: Transfer ownership to Safe multisig");
  console.log("  Safe Address:", config.safeAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exitCode = 1;
  });
