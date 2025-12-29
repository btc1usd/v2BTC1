const fs = require('fs');
const path = require('path');

// Read the problematic CSV
const inputFile = path.join(__dirname, 'merkle_distributions_rows (1).csv');
const outputFile = path.join(__dirname, 'merkle_distributions_rows_fixed.csv');

console.log('Reading file...');
const content = fs.readFileSync(inputFile, 'utf-8');

// Split into lines
const lines = content.split('\n');
console.log(`Total lines: ${lines.length}`);

if (lines.length < 2) {
  console.error('❌ File has insufficient lines');
  process.exit(1);
}

// Header line
const header = lines[0];
console.log('Header:', header);

// Data line (line 2)
const dataLine = lines[1];
console.log('\n📊 Analyzing data line...');
console.log('Length:', dataLine.length);

// The issue is that the claims JSON is truncated
// Let's try to detect if it's properly formatted
const parts = dataLine.split('","{');

if (parts.length >= 2) {
  console.log('\n✅ Found JSON boundaries');
  console.log('Parts found:', parts.length);
  
  // Check if the claims JSON is complete
  const claimsStart = dataLine.indexOf('"{"');
  const metadataStart = dataLine.lastIndexOf('","{');
  
  if (claimsStart !== -1 && metadataStart !== -1) {
    console.log('\nClaims JSON starts at:', claimsStart);
    console.log('Metadata JSON starts at:', metadataStart);
    
    // Extract the claims section
    const beforeClaims = dataLine.substring(0, claimsStart + 1);
    const claimsSection = dataLine.substring(claimsStart + 1, metadataStart + 1);
    const afterMetadata = dataLine.substring(metadataStart + 2);
    
    console.log('\n🔍 Claims section preview:');
    console.log('First 200 chars:', claimsSection.substring(0, 200));
    console.log('Last 200 chars:', claimsSection.substring(claimsSection.length - 200));
    
    // Check if claims JSON is valid
    try {
      // Remove the leading and trailing quotes for parsing
      const claimsJson = claimsSection.substring(1, claimsSection.length - 1).replace(/""/g, '"');
      JSON.parse(claimsJson);
      console.log('\n✅ Claims JSON is valid!');
    } catch (e) {
      console.log('\n❌ Claims JSON is INVALID:',e.message);
      console.log('\nThe file appears to be truncated or corrupted.');
      console.log('The claims field ends with "..." which indicates incomplete data.');
      console.log('\n💡 Solution: You need to re-export this data from the original source.');
      process.exit(1);
    }
  }
} else {
  console.log('❌ Could not parse CSV structure properly');
}
