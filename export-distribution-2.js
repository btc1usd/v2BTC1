const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function exportDistribution() {
  console.log('🔍 Fetching distribution ID 2 from Supabase...\n');
  
  try {
    const { data, error } = await supabase
      .from('merkle_distributions')
      .select('*')
      .eq('id', 2)
      .single();
    
    if (error) throw error;
    if (!data) {
      console.error('❌ No distribution found with ID 2');
      return;
    }
    
    console.log('✅ Successfully fetched distribution 2');
    console.log('📊 Merkle Root:', data.merkle_root);
    console.log('💰 Total Rewards:', data.total_rewards);
    
    // Parse claims to verify
    const claims = typeof data.claims === 'string' ? JSON.parse(data.claims) : data.claims;
    console.log('📝 Total addresses:', Object.keys(claims).length);
    
    // Save as JSON
    fs.writeFileSync(
      'merkle_distribution_2_fixed.json',
      JSON.stringify([data], null, 2),
      'utf-8'
    );
    console.log('✅ Saved to: merkle_distribution_2_fixed.json');
    
    // Convert to CSV with proper escaping
    const escapeCsv = (val) => {
      if (!val) return '';
      const str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    
    const claimsStr = typeof data.claims === 'string' ? data.claims : JSON.stringify(data.claims);
    const metadataStr = typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata);
    
    const csvHeader = 'id,merkle_root,total_rewards,claims,metadata,created_at';
    const csvRow = [
      data.id,
      data.merkle_root,
      data.total_rewards,
      escapeCsv(claimsStr),
      escapeCsv(metadataStr),
      data.created_at
    ].join(',');
    
    fs.writeFileSync(
      'merkle_distribution_2_fixed.csv',
      csvHeader + '\n' + csvRow,
      'utf-8'
    );
    console.log('✅ Saved to: merkle_distribution_2_fixed.csv');
    console.log('\n✨ You can now import the CSV to Supabase!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

exportDistribution();
