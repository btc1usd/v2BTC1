const fs = require('fs');
const path = require('path');

// Function to escape CSV field (handle quotes and commas)
function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If field contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Read both JSON files
console.log('📖 Reading JSON files...\n');

const json1 = JSON.parse(fs.readFileSync('merkle_distributions_rows.json', 'utf-8'));
const json2 = JSON.parse(fs.readFileSync('merkle_distributions_rows (1).json', 'utf-8'));

console.log(`✅ Distribution 1 (ID ${json1[0].id}): Loaded`);
console.log(`✅ Distribution 2 (ID ${json2[0].id}): Loaded`);

// Combine both distributions
const allDistributions = [...json1, ...json2];

console.log(`\n📊 Total distributions: ${allDistributions.length}\n`);

// CSV Header
const header = 'id,merkle_root,total_rewards,claims,metadata,created_at';
const rows = [header];

// Convert each distribution to CSV row
for (const dist of allDistributions) {
  const row = [
    dist.id,
    dist.merkle_root,
    dist.total_rewards,
    escapeCsvField(dist.claims),
    escapeCsvField(dist.metadata),
    dist.created_at
  ].join(',');
  
  rows.push(row);
  console.log(`✅ Processed distribution ${dist.id}`);
}

// Write to CSV file
const csvContent = rows.join('\n');
const outputFile = 'merkle_distributions_rows_complete.csv';

fs.writeFileSync(outputFile, csvContent, 'utf-8');

console.log(`\n✨ Successfully created: ${outputFile}`);
console.log(`📝 Total rows: ${rows.length} (including header)`);
console.log(`💾 File size: ${csvContent.length} bytes`);
