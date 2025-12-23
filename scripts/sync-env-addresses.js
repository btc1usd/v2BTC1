const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n🔄 Syncing .env files with deployment-base-sepolia.json...\n');

  // Load deployment file
  const deployment = require('../deployment-base-sepolia.json');
  
  const updates = {
    'NEXT_PUBLIC_PROXY_ADMIN_CONTRACT': deployment.proxyAdmin,
    'NEXT_PUBLIC_BTC1USD_CONTRACT': deployment.core.btc1usd,
    'NEXT_PUBLIC_VAULT_CONTRACT': deployment.core.vault,
    'NEXT_PUBLIC_PRICE_ORACLE_CONTRACT': deployment.core.chainlinkBTCOracle,
    'NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT': deployment.distribution.weeklyDistribution,
    'NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT': deployment.distribution.merkleDistributor,
    'NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT': deployment.governance.endowmentManager,
    'NEXT_PUBLIC_PROTOCOL_GOVERNANCE_CONTRACT': deployment.governance.protocolGovernance,
    'NEXT_PUBLIC_DAO_CONTRACT': deployment.governance.dao,
    'NEXT_PUBLIC_DEV_WALLET_CONTRACT': deployment.wallets.devWallet,
    'NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT': deployment.wallets.endowmentWallet,
    'NEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT': deployment.wallets.merklFeeCollector,
    'NEXT_PUBLIC_WBTC_TOKEN': deployment.mockTokens.wbtc,
    'NEXT_PUBLIC_CBBTC_TOKEN': deployment.mockTokens.cbbtc,
    'NEXT_PUBLIC_TBTC_TOKEN': deployment.mockTokens.tbtc,
    'NEXT_PUBLIC_SAFE_ADDRESS': deployment.config.admin,
  };

  function updateEnvFile(filePath) {
    console.log(`📝 Updating ${path.basename(filePath)}...`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    let updatedCount = 0;

    Object.entries(updates).forEach(([key, value]) => {
      // Match with or without quotes
      const regex = new RegExp(`^${key}=["']?[^"'\\n]*["']?$`, 'm');
      const newLine = `${key}="${value}"`;
      
      if (regex.test(content)) {
        content = content.replace(regex, newLine);
        updatedCount++;
        console.log(`   ✅ ${key}`);
      } else {
        console.log(`   ⚠️  ${key} - NOT FOUND in file`);
      }
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`   ✅ Updated ${updatedCount} addresses\n`);
  }

  // Update both .env files
  const envPath = path.join(__dirname, '..', '.env');
  const envLocalPath = path.join(__dirname, '..', '.env.local');

  updateEnvFile(envPath);
  updateEnvFile(envLocalPath);

  console.log('✅ All addresses synced successfully!\n');
  console.log('📝 Summary of updates:');
  Object.entries(updates).forEach(([key, value]) => {
    console.log(`   ${key} = ${value}`);
  });
  console.log('\n💡 Next step: Restart your dev server if running');
}

main().catch(error => {
  console.error('\n❌ Sync failed:', error.message);
  process.exit(1);
});
