const fs = require('fs');

// Read the generated merkle JSON
const data = JSON.parse(fs.readFileSync('./merkle-output.json', 'utf8'));

// Metadata to match the original
const metadata = {
  note: "Protocol wallets are excluded. EOAs and smart contract wallets (bytecode <100 bytes) receive rewards - includes both direct BTC1USD holders and LP providers whose BTC1USD share in pools has been calculated and aggregated to their addresses.",
  generated: "2025-12-29T15:58:44.251Z",
  lastClaimAt: "2025-12-29T17:14:20.256Z",
  totalClaims: 25,
  claimedCount: 3,
  fullyClaimed: false,
  totalHolders: 25,
  activeHolders: 25,
  excludedCount: 4,
  excludedAddresses: [
    "0x7044d853050cd089B4A796fA8eADa581c205D106",
    "0x3C8B5837A184ef87543fDd7401ed575F5CEb170e",
    "0x108eFCe368DB385a7FDa8F3A8266d6CD16a3B282",
    "0x9Ba818c20198936D0CF3d9683c3095541ceC366A"
  ]
};

// Properly escape JSON for CSV (double quotes need to be doubled)
const claimsJson = JSON.stringify(data.claims).replace(/"/g, '""');
const metadataJson = JSON.stringify(metadata).replace(/"/g, '""');

// Create CSV line
const csvLine = `3,${data.merkleRoot},${data.totalRewards},"${claimsJson}","${metadataJson}",2025-12-29 15:58:44.328497+00`;

// Write CSV file with header
const csvContent = `id,merkle_root,total_rewards,claims,metadata,created_at\n${csvLine}`;

fs.writeFileSync('./merkle_distributions_row3_fixed.csv', csvContent);

console.log('✅ CSV created successfully: merkle_distributions_row3_fixed.csv');
console.log(`   File size: ${fs.statSync('./merkle_distributions_row3_fixed.csv').size} bytes`);
