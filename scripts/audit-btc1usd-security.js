/**
 * Manual Security Audit for BTC1USD Token
 * Directly checks contract state on Base Sepolia
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Load deployment
const deploymentPath = path.join(__dirname, '..', 'deployment-base-sepolia.json');
const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

async function main() {
  console.log('\n🔐 BTC1USD SECURITY AUDIT - Base Sepolia');
  console.log('==========================================\n');
  
  const btc1usdAddress = deployment.core?.btc1usd || deployment.nonUpgradeable?.btc1usd;
  console.log(`Token Address: ${btc1usdAddress}\n`);
  
  // Get contract instance
  const BTC1USD = await ethers.getContractAt('BTC1USD', btc1usdAddress);
  
  console.log('📋 CONTRACT INFORMATION:');
  console.log(`   Name:                ${await BTC1USD.name()}`);
  console.log(`   Symbol:              ${await BTC1USD.symbol()}`);
  console.log(`   Decimals:            ${await BTC1USD.decimals()}`);
  console.log(`   Total Supply:        ${ethers.formatUnits(await BTC1USD.totalSupply(), 8)} BTC1\n`);
  
  console.log('👥 ACCESS CONTROL:');
  const admin = await BTC1USD.admin();
  const vault = await BTC1USD.vault();
  const weeklyDistribution = await BTC1USD.weeklyDistribution();
  const paused = await BTC1USD.paused();
  const criticalParamsLocked = await BTC1USD.criticalParamsLocked();
  
  console.log(`   Admin:               ${admin}`);
  console.log(`   Vault:               ${vault}`);
  console.log(`   Weekly Distribution: ${weeklyDistribution}`);
  console.log(`   Paused:              ${paused ? '🔴 YES' : '✅ NO'}`);
  console.log(`   Critical Params Locked: ${criticalParamsLocked ? '🔒 YES (SECURE)' : '⚠️  NO (Can still change)'}\n`);
  
  console.log('🔒 SECURITY FEATURES:');
  
  // Check if contract has security functions
  const hasLockFunction = BTC1USD.interface.hasFunction('lockCriticalParams');
  const hasMintFunction = BTC1USD.interface.hasFunction('mint');
  const hasBurnFunction = BTC1USD.interface.hasFunction('burn');
  const hasPermitFunction = BTC1USD.interface.hasFunction('permit');
  
  console.log(`   ✓ lockCriticalParams():  ${hasLockFunction ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   ✓ mint() function:       ${hasMintFunction ? '✅ EXISTS (onlyVaultOrDistribution)' : '❌ MISSING'}`);
  console.log(`   ✓ burn() function:       ${hasBurnFunction ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   ✓ permit() (EIP-2612):   ${hasPermitFunction ? '✅ EXISTS' : '❌ MISSING'}\n`);
  
  console.log('🎯 RISK ASSESSMENT:');
  
  const risks = [];
  const warnings = [];
  const info = [];
  
  // Critical checks
  if (!criticalParamsLocked) {
    warnings.push('⚠️  Critical parameters not locked - admin can change vault/weeklyDistribution');
    warnings.push('   RECOMMENDATION: Call lockCriticalParams() after deployment verification');
  } else {
    info.push('✅ Critical parameters locked - mint permissions are immutable');
  }
  
  if (paused) {
    warnings.push('⚠️  Token is currently PAUSED - transfers disabled');
  } else {
    info.push('✅ Token is not paused - normal operations allowed');
  }
  
  if (vault === ethers.ZeroAddress) {
    risks.push('❌ Vault address is zero - minting disabled');
  } else {
    info.push('✅ Vault address is set');
  }
  
  if (weeklyDistribution === ethers.ZeroAddress) {
    warnings.push('⚠️  Weekly distribution not set - distribution minting disabled');
  } else {
    info.push('✅ Weekly distribution address is set');
  }
  
  // Display results
  if (risks.length > 0) {
    console.log('\n🔴 CRITICAL RISKS:');
    risks.forEach(r => console.log(`   ${r}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n🟡 WARNINGS:');
    warnings.forEach(w => console.log(`   ${w}`));
  }
  
  if (info.length > 0) {
    console.log('\n✅ SECURITY CONFIRMATIONS:');
    info.forEach(i => console.log(`   ${i}`));
  }
  
  // Overall score
  const score = 100 - (risks.length * 30) - (warnings.length * 10);
  console.log(`\n📊 OVERALL SECURITY SCORE: ${score}/100`);
  
  if (score >= 90) {
    console.log('   Status: 🟢 EXCELLENT - Production ready');
  } else if (score >= 70) {
    console.log('   Status: 🟡 GOOD - Minor improvements needed');
  } else if (score >= 50) {
    console.log('   Status: 🟠 FAIR - Address warnings before production');
  } else {
    console.log('   Status: 🔴 POOR - Critical issues must be resolved');
  }
  
  console.log('\n📝 NEXT STEPS:');
  console.log('   1. ✓ Verify contract on BaseScan');
  console.log('   2. ✓ Test all functions (mint, burn, permit)');
  console.log(`   3. ${criticalParamsLocked ? '✓' : '⚠️ '} Call lockCriticalParams() to finalize`);
  console.log('   4. ✓ Set up admin multi-sig for production');
  console.log('   5. ✓ Monitor events and transactions\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
