const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fetchDistribution() {
  console.log('🔍 Fetching distribution ID 2 from Supabase...\n');
  
  try {
    const { data, error } = await supabase
      .from('merkle_distributions')
      .select('*')
      .eq('id', 2)
      .single();
    
    if (error) {
      console.error('❌ Error fetching from Supabase:', error);
      return;
    }
    
    if (!data) {
      console.error('❌ No distribution found with ID 2');
      return;
    }
    
    console.log('✅ Successfully fetched distribution 2');
    console.log('📊 Merkle Root:', data.merkle_root);
    console.log('💰 Total Rewards:', data.total_rewards);
    
    // Validate claims JSON
    try {
      const claimsObj = typeof data.claims === 'string' 
        ? JSON.parse(data.claims) 
        : data.claims;
      
      const addresses = Object.keys(claimsObj);
      console.log('✅ Claims JSON is valid!');
      console.log('📝 Total addresses:', addresses.length);
      
      // Save to JSON file
      const fs = require('fs');
      const outputData = [data];
      fs.writeFileSync(
        'merkle_distributions_rows_2_complete.json', 
        JSON.stringify(outputData, null, 2),
        'utf-8'
      );
      
      console.log('\n✨ Saved complete data to: merkle_distributions_rows_2_complete.json');
      
      // Now convert to CSV
      const escapeCsvField = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };
      
      const header = 'id,merkle_root,total_rewards,claims,metadata,created_at';
      const row = [
        data.id,
        data.merkle_root,
        data.total_rewards,
        escapeCsvField(typeof data.claims === 'string' ? data.claims : JSON.stringify(data.claims)),
        escapeCsvField(typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata)),
        data.created_at
      ].join(',');
      
      const csvContent = header + '\n' + row;
      fs.writeFileSync('merkle_distributions_rows_2_complete.csv', csvContent, 'utf-8');
      
      console.log('✨ Saved complete CSV to: merkle_distributions_rows_2_complete.csv');
      console.log('\n✅ You can now import this CSV to Supabase!');
      
    } catch (e) {
      console.error('❌ Claims JSON is invalid:', e.message);
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

fetchDistribution();
