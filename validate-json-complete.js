const fs = require('fs');

console.log('🔍 Validating JSON files for completeness...\n');

// Check distribution 2 JSON
const json2 = JSON.parse(fs.readFileSync('merkle_distributions_rows (1).json', 'utf-8'));
const dist2 = json2[0];

console.log('Distribution 2 (ID:', dist2.id, ')');
console.log('Claims field type:', typeof dist2.claims);
console.log('Claims field length:', dist2.claims.length);
console.log('Claims last 100 chars:', dist2.claims.slice(-100));
console.log('\n🔍 Checking if claims ends with valid JSON...');

try {
  const claimsObj = JSON.parse(dist2.claims);
  const addresses = Object.keys(claimsObj);
  console.log('✅ Claims JSON is VALID!');
  console.log('📊 Total addresses:', addresses.length);
  console.log('📝 Last address:', addresses[addresses.length - 1]);
  
  // Check last address data
  const lastAddr = addresses[addresses.length - 1];
  const lastData = claimsObj[lastAddr];
  console.log('\n📋 Last address claim data:');
  console.log(JSON.stringify(lastData, null, 2));
  
} catch (e) {
  console.log('❌ Claims JSON is INVALID!');
  console.log('Error:', e.message);
  console.log('\n⚠️  The claims field is truncated/incomplete!');
}
