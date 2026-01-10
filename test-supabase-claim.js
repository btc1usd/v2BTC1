const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://azacrroidzymnkyopilq.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6YWNycm9pZHp5bWtueW9waWxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQzMTc1NiwiZXhwIjoyMDgwMDA3NzU2fQ.iPkAp4WlkSE18-4PMtgfKBgbZtrVpkzgzGtcJUHH5ug"
);

const testAddress = '0xa1fcf334f8ee86ecad93d4271ed25a50d60aa72b';

async function test() {
  console.log('Testing Supabase merkle_distributions_prod table...\n');
  
  const { data, error } = await supabase
    .from('merkle_distributions_prod')
    .select('id, merkle_root, claims, total_rewards')
    .order('id', { ascending: false })
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('❌ No data found in merkle_distributions_prod');
    return;
  }
  
  const dist = data[0];
  console.log('Distribution ID:', dist.id);
  console.log('Merkle Root:', dist.merkle_root);
  console.log('Total Rewards:', dist.total_rewards);
  console.log('\nOn-chain merkle root: 0x82b34bddf9f8e453513c9b9aefd62b8adf84db34b85edaaa5ff81220b07baa97');
  console.log('Roots match:', dist.merkle_root === '0x82b34bddf9f8e453513c9b9aefd62b8adf84db34b85edaaa5ff81220b07baa97');
  
  console.log('\n\nChecking if test address has claim...');
  console.log('Test address:', testAddress);
  
  if (dist.claims && dist.claims[testAddress]) {
    console.log('✅ Address HAS claim!');
    console.log('Claim data:', JSON.stringify(dist.claims[testAddress], null, 2));
  } else {
    console.log('❌ Address does NOT have claim in distribution');
    console.log('Total claims:', Object.keys(dist.claims || {}).length);
    console.log('Sample addresses:', Object.keys(dist.claims || {}).slice(0, 5));
  }
}

test().catch(console.error);
