const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔍 Verifying Ownership Transfers to Safe\n");
  
  const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS;
  const btc1usdAddress = process.env.NEXT_PUBLIC_BTC1USD_CONTRACT;
  const vaultAddress = process.env.NEXT_PUBLIC_VAULT_CONTRACT;
  const oracleAddress = process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT;
  const merkleDistributorAddress = process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT;
  const weeklyDistributionAddress = process.env.NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT;
  const endowmentManagerAddress = process.env.NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT;
  const protocolGovernanceAddress = process.env.NEXT_PUBLIC_PROTOCOL_GOVERNANCE_CONTRACT;
  const daoAddress = process.env.NEXT_PUBLIC_DAO_CONTRACT;
  const devWalletAddress = process.env.NEXT_PUBLIC_DEV_WALLET_CONTRACT;
  const endowmentWalletAddress = process.env.NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT;
  const merkleFeeCollectorAddress = process.env.NEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT;
  const proxyAdminAddress = process.env.NEXT_PUBLIC_PROXY_ADMIN_CONTRACT;
  
  if (!safeAddress) {
    console.error("❌ NEXT_PUBLIC_SAFE_ADDRESS not set in .env");
    process.exit(1);
  }
  
  console.log("📍 Safe Address:", safeAddress);
  console.log();
  
  const provider = ethers.provider;
  const ownerABI = ["function owner() view returns (address)"];
  const ownable2StepABI = [
    "function owner() view returns (address)",
    "function pendingOwner() view returns (address)"
  ];
  
  const contracts = [
    { name: "BTC1USD", address: btc1usdAddress, usesOwnable2Step: true },
    { name: "Vault", address: vaultAddress, usesOwnable2Step: false },
    { name: "ChainlinkBTCOracle", address: oracleAddress, usesOwnable2Step: false },
    { name: "MerkleDistributor", address: merkleDistributorAddress, usesOwnable2Step: false },
    { name: "WeeklyDistribution", address: weeklyDistributionAddress, usesOwnable2Step: false },
    { name: "EndowmentManager", address: endowmentManagerAddress, usesOwnable2Step: false },
    { name: "ProtocolGovernance", address: protocolGovernanceAddress, usesOwnable2Step: false },
    { name: "DAO", address: daoAddress, usesOwnable2Step: false },
    { name: "DevWallet", address: devWalletAddress, usesOwnable2Step: false },
    { name: "EndowmentWallet", address: endowmentWalletAddress, usesOwnable2Step: false },
    { name: "MerkleFeeCollector", address: merkleFeeCollectorAddress, usesOwnable2Step: false },
    { name: "ProxyAdmin", address: proxyAdminAddress, usesOwnable2Step: false },
  ];
  
  let allCorrect = true;
  let needsAcceptance = [];
  
  for (const contractInfo of contracts) {
    if (!contractInfo.address) {
      console.log(`⚠️  ${contractInfo.name}: Address not configured`);
      continue;
    }
    
    try {
      const contract = new ethers.Contract(
        contractInfo.address,
        contractInfo.usesOwnable2Step ? ownable2StepABI : ownerABI,
        provider
      );
      
      const currentOwner = await contract.owner();
      
      if (contractInfo.usesOwnable2Step) {
        const pendingOwner = await contract.pendingOwner();
        
        if (currentOwner.toLowerCase() === safeAddress.toLowerCase()) {
          console.log(`✅ ${contractInfo.name}: Owner is Safe`);
          console.log(`   Current: ${currentOwner}`);
        } else if (pendingOwner.toLowerCase() === safeAddress.toLowerCase()) {
          console.log(`⚠️  ${contractInfo.name}: Pending ownership transfer`);
          console.log(`   Current: ${currentOwner}`);
          console.log(`   Pending: ${pendingOwner}`);
          console.log(`   ⚠️  Safe must call acceptOwnership()!`);
          needsAcceptance.push({
            name: contractInfo.name,
            address: contractInfo.address,
            currentOwner,
            pendingOwner
          });
          allCorrect = false;
        } else {
          console.log(`❌ ${contractInfo.name}: Owner is NOT Safe`);
          console.log(`   Current: ${currentOwner}`);
          console.log(`   Pending: ${pendingOwner}`);
          console.log(`   Expected: ${safeAddress}`);
          allCorrect = false;
        }
      } else {
        if (currentOwner.toLowerCase() === safeAddress.toLowerCase()) {
          console.log(`✅ ${contractInfo.name}: Owner is Safe`);
          console.log(`   ${currentOwner}`);
        } else {
          console.log(`❌ ${contractInfo.name}: Owner is NOT Safe`);
          console.log(`   Current: ${currentOwner}`);
          console.log(`   Expected: ${safeAddress}`);
          allCorrect = false;
        }
      }
      console.log();
    } catch (error) {
      console.log(`❌ ${contractInfo.name}: Error checking ownership`);
      console.log(`   ${error.message}`);
      console.log();
      allCorrect = false;
    }
  }
  
  console.log("=".repeat(80));
  
  if (needsAcceptance.length > 0) {
    console.log("\n⚠️  ACTION REQUIRED: Safe must accept ownership for these contracts:\n");
    
    for (const contract of needsAcceptance) {
      console.log(`📋 ${contract.name}:`);
      console.log(`   Contract: ${contract.address}`);
      console.log(`   Function: acceptOwnership()`);
      console.log(`   Calldata: 0x79ba5097`);
      console.log();
    }
    
    console.log("📝 Instructions:");
    console.log("1. Go to Safe UI: https://app.safe.global/base-sep:" + safeAddress);
    console.log("2. Click 'New Transaction' → 'Transaction Builder'");
    console.log("3. For each contract above:");
    console.log("   • To: <contract address>");
    console.log("   • Value: 0");
    console.log("   • Data: 0x79ba5097");
    console.log("4. Add all to batch, review, and execute");
    console.log();
  }
  
  if (allCorrect) {
    console.log("\n✅ SUCCESS: All contracts properly owned by Safe!");
  } else {
    console.log("\n❌ INCOMPLETE: Some contracts need attention (see details above)");
  }
  
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
