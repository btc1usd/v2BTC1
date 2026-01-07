const fs = require('fs');
const path = require('path');

async function main() {
  const hre = require('hardhat');
  
  console.log('Generating Standard JSON Input for BTC1USD...\n');
  
  // Get build info
  const buildInfo = await hre.artifacts.getBuildInfo('contracts/BTC1USD.sol:BTC1USD');
  
  if (!buildInfo) {
    throw new Error('Build info not found. Run: npx hardhat compile --force');
  }
  
  const input = buildInfo.input;
  const solcVersion = buildInfo.solcVersion;
  
  console.log('Compiler Version:', solcVersion);
  console.log('Source Files:', Object.keys(input.sources).length);
  
  // Create the standard JSON
  const standardJson = {
    language: 'Solidity',
    sources: input.sources,
    settings: input.settings
  };
  
  // Write to file
  const outputPath = path.join(__dirname, '..', 'BTC1USD-standard-json.json');
  fs.writeFileSync(outputPath, JSON.stringify(standardJson, null, 2));
  
  console.log('\n✅ Standard JSON saved to:', outputPath);
  console.log('\nTo verify on BaseScan:');
  console.log('1. Go to: https://basescan.org/address/0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5#code');
  console.log('2. Click "Verify and Publish"');
  console.log('3. Select: "Solidity (Standard-Json-Input)"');
  console.log('4. Compiler:', solcVersion);
  console.log('5. Upload the generated JSON file');
  console.log('6. Constructor args (ABI-encoded):');
  console.log('   0000000000000000000000006205102ab6961e2bb9f402ea984cae1223994eb70000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
