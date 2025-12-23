const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes
      value = value.replace(/^["']|["']$/g, '');
      env[key] = value;
    }
  });
  return env;
}

async function main() {
  console.log('\n🔍 Verifying all contract addresses...\n');

  // Load deployment file
  const deployment = require('../deployment-base-sepolia.json');
  
  // Load .env files
  const envPath = path.join(__dirname, '..', '.env');
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  
  const env = parseEnvFile(envPath);
  const envLocal = parseEnvFile(envLocalPath);

  console.log('📋 Deployment File vs .env Files Comparison:\n');
  console.log('=' .repeat(100));

  const checks = [
    {
      name: 'ProxyAdmin',
      envKey: 'NEXT_PUBLIC_PROXY_ADMIN_CONTRACT',
      deploymentValue: deployment.proxyAdmin
    },
    {
      name: 'BTC1USD',
      envKey: 'NEXT_PUBLIC_BTC1USD_CONTRACT',
      deploymentValue: deployment.core.btc1usd
    },
    {
      name: 'Vault',
      envKey: 'NEXT_PUBLIC_VAULT_CONTRACT',
      deploymentValue: deployment.core.vault
    },
    {
      name: 'ChainlinkBTCOracle',
      envKey: 'NEXT_PUBLIC_PRICE_ORACLE_CONTRACT',
      deploymentValue: deployment.core.chainlinkBTCOracle
    },
    {
      name: 'WeeklyDistribution',
      envKey: 'NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT',
      deploymentValue: deployment.distribution.weeklyDistribution
    },
    {
      name: 'MerkleDistributor',
      envKey: 'NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT',
      deploymentValue: deployment.distribution.merkleDistributor
    },
    {
      name: 'EndowmentManager',
      envKey: 'NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT',
      deploymentValue: deployment.governance.endowmentManager
    },
    {
      name: 'ProtocolGovernance',
      envKey: 'NEXT_PUBLIC_PROTOCOL_GOVERNANCE_CONTRACT',
      deploymentValue: deployment.governance.protocolGovernance
    },
    {
      name: 'DAO',
      envKey: 'NEXT_PUBLIC_DAO_CONTRACT',
      deploymentValue: deployment.governance.dao
    },
    {
      name: 'DevWallet',
      envKey: 'NEXT_PUBLIC_DEV_WALLET_CONTRACT',
      deploymentValue: deployment.wallets.devWallet
    },
    {
      name: 'EndowmentWallet',
      envKey: 'NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT',
      deploymentValue: deployment.wallets.endowmentWallet
    },
    {
      name: 'MerkleFeeCollector',
      envKey: 'NEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT',
      deploymentValue: deployment.wallets.merklFeeCollector
    },
    {
      name: 'MockWBTC',
      envKey: 'NEXT_PUBLIC_WBTC_TOKEN',
      deploymentValue: deployment.mockTokens.wbtc
    },
    {
      name: 'MockCBTC',
      envKey: 'NEXT_PUBLIC_CBBTC_TOKEN',
      deploymentValue: deployment.mockTokens.cbbtc
    },
    {
      name: 'MockTBTC',
      envKey: 'NEXT_PUBLIC_TBTC_TOKEN',
      deploymentValue: deployment.mockTokens.tbtc
    },
    {
      name: 'Safe Address',
      envKey: 'NEXT_PUBLIC_SAFE_ADDRESS',
      deploymentValue: deployment.config.admin
    }
  ];

  let hasErrors = false;
  const errors = [];

  checks.forEach(check => {
    const envValue = env[check.envKey];
    const envLocalValue = envLocal[check.envKey];
    const deploymentValue = check.deploymentValue;

    const envMatch = envValue?.toLowerCase() === deploymentValue?.toLowerCase();
    const envLocalMatch = envLocalValue?.toLowerCase() === deploymentValue?.toLowerCase();

    const status = envMatch && envLocalMatch ? '✅' : '❌';
    
    console.log(`${status} ${check.name.padEnd(25)} ${check.envKey}`);
    console.log(`   Deployment:  ${deploymentValue || 'NOT SET'}`);
    console.log(`   .env:        ${envValue || 'NOT SET'} ${!envMatch ? '❌ MISMATCH' : ''}`);
    console.log(`   .env.local:  ${envLocalValue || 'NOT SET'} ${!envLocalMatch ? '❌ MISMATCH' : ''}`);
    console.log('');

    if (!envMatch || !envLocalMatch) {
      hasErrors = true;
      errors.push({
        name: check.name,
        envKey: check.envKey,
        correct: deploymentValue,
        envWrong: !envMatch ? envValue : null,
        envLocalWrong: !envLocalMatch ? envLocalValue : null
      });
    }
  });

  console.log('=' .repeat(100));

  if (hasErrors) {
    console.log('\n❌ ERRORS FOUND! The following addresses need to be fixed:\n');
    errors.forEach(error => {
      console.log(`📝 ${error.name}:`);
      console.log(`   Key: ${error.envKey}`);
      console.log(`   Should be: ${error.correct}`);
      if (error.envWrong) {
        console.log(`   .env has: ${error.envWrong} ❌`);
      }
      if (error.envLocalWrong) {
        console.log(`   .env.local has: ${error.envLocalWrong} ❌`);
      }
      console.log('');
    });

    console.log('\n💡 Fix commands:');
    console.log('   Run: node scripts/sync-env-addresses.js');
    console.log('   Or manually update the addresses in .env and .env.local files');
    
    process.exit(1);
  } else {
    console.log('\n✅ All addresses are correct and match deployment-base-sepolia.json!\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n❌ Verification failed:', error.message);
  process.exit(1);
});
