/**
 * Lock Critical Parameters on BTC1USD
 * This makes vault and weeklyDistribution addresses immutable
 * Admin retains all other controls (distribute, upgrade, pause, admin transfer)
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n🔒 LOCKING CRITICAL PARAMETERS ON BTC1USD');
  console.log('==========================================\n');

  // Load deployment
  const deploymentPath = path.join(__dirname, '..', 'deployment-base-sepolia.json');
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  const btc1usdAddress = deployment.core?.btc1usd || deployment.nonUpgradeable?.btc1usd;
  
  if (!btc1usdAddress) {
    console.error('❌ BTC1USD address not found in deployment file');
    process.exit(1);
  }
  
  console.log(`BTC1USD Address: ${btc1usdAddress}\n`);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Executing as: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(signer.address))} ETH\n`);
  
  // Get BTC1USD contract
  const BTC1USD = await ethers.getContractAt('BTC1USD', btc1usdAddress);
  
  // Check current state
  console.log('📊 CURRENT STATE:');
  const admin = await BTC1USD.admin();
  const vault = await BTC1USD.vault();
  const weeklyDistribution = await BTC1USD.weeklyDistribution();
  const criticalParamsLocked = await BTC1USD.criticalParamsLocked();
  
  console.log(`   Admin:                  ${admin}`);
  console.log(`   Vault:                  ${vault}`);
  console.log(`   Weekly Distribution:    ${weeklyDistribution}`);
  console.log(`   Already Locked:         ${criticalParamsLocked ? '🔒 YES' : '❌ NO'}\n`);
  
  // Verify caller is admin
  if (signer.address.toLowerCase() !== admin.toLowerCase()) {
    console.error(`❌ ERROR: You are not the admin!`);
    console.error(`   Admin:       ${admin}`);
    console.error(`   Your address: ${signer.address}`);
    process.exit(1);
  }
  
  // Check if already locked
  if (criticalParamsLocked) {
    console.log('✅ Critical parameters are already locked!');
    console.log('   Nothing to do.\n');
    return;
  }
  
  // Confirm addresses are set correctly
  console.log('⚠️  WARNING: This action is IRREVERSIBLE!');
  console.log('\n📋 WHAT WILL BE LOCKED:');
  console.log(`   ✓ Vault address:              ${vault}`);
  console.log(`   ✓ Weekly Distribution address: ${weeklyDistribution}\n`);
  
  console.log('✅ WHAT ADMIN RETAINS:');
  console.log('   ✓ Execute reward distributions');
  console.log('   ✓ Upgrade implementations (via ProxyAdmin)');
  console.log('   ✓ Transfer admin role');
  console.log('   ✓ Pause/unpause token\n');
  
  // Validate addresses
  if (vault === ethers.ZeroAddress) {
    console.error('❌ ERROR: Vault address is zero! Set vault first.');
    process.exit(1);
  }
  
  if (weeklyDistribution === ethers.ZeroAddress) {
    console.error('⚠️  WARNING: Weekly distribution address is zero!');
    console.log('   Distributions will not work until set.');
    console.log('   Do you want to continue? (Ctrl+C to cancel)\n');
  }
  
  // Execute lock
  console.log('🔐 Locking critical parameters...\n');
  
  try {
    const tx = await BTC1USD.lockCriticalParams();
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log(`   Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);
    
    // Verify lock
    const locked = await BTC1USD.criticalParamsLocked();
    
    if (locked) {
      console.log('🎉 SUCCESS! Critical parameters are now locked.\n');
      console.log('📊 FINAL STATE:');
      console.log(`   Vault:               ${await BTC1USD.vault()} (IMMUTABLE)`);
      console.log(`   Weekly Distribution: ${await BTC1USD.weeklyDistribution()} (IMMUTABLE)`);
      console.log(`   Locked:              🔒 YES\n`);
      
      console.log('✅ SECURITY ACHIEVED:');
      console.log('   ✓ Mint permissions are now immutable');
      console.log('   ✓ Only vault and weeklyDistribution can mint tokens');
      console.log('   ✓ Admin cannot change these addresses ever again\n');
      
      console.log('✅ ADMIN RETAINS:');
      console.log('   ✓ All operational controls');
      console.log('   ✓ Reward distribution execution');
      console.log('   ✓ Proxy upgrade capabilities\n');
      
      console.log('🔍 View transaction on BaseScan:');
      console.log(`   https://sepolia.basescan.org/tx/${tx.hash}\n`);
    } else {
      console.error('❌ ERROR: Lock failed - criticalParamsLocked is still false');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ TRANSACTION FAILED:');
    if (error.reason) {
      console.error(`   Reason: ${error.reason}`);
    }
    console.error(`   Error: ${error.message}\n`);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
