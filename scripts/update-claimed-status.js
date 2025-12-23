const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuration
const DISTRIBUTION_ID = 1; // The distribution we just generated

// Claimed addresses with timestamps
const CLAIMED_ADDRESSES = [
  {
    address: '0xa1fcf334F8ee86eCaD93D4271Ed25a50d60aa72B',
    claimedAt: '2025-12-14T03:55:13.000Z'
  },
  {
    address: '0x5B631b3b8E1A6e16Eb5faB45E946C57a4232abF4',
    claimedAt: '2025-12-16T02:15:19.000Z'
  }
];

async function updateClaimedStatus() {
  try {
    console.log('\n📝 Updating Claimed Status in Supabase');
    console.log('='.repeat(60));
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase credentials not found in .env.local');
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Fetch the distribution
    console.log(`\n🔍 Fetching distribution ID ${DISTRIBUTION_ID}...`);
    const { data: distribution, error: fetchError } = await supabase
      .from('merkle_distributions')
      .select('*')
      .eq('id', DISTRIBUTION_ID)
      .single();
    
    if (fetchError) {
      throw new Error(`Failed to fetch distribution: ${fetchError.message}`);
    }
    
    if (!distribution) {
      throw new Error(`Distribution ID ${DISTRIBUTION_ID} not found`);
    }
    
    console.log(`✅ Found distribution with ${Object.keys(distribution.claims || {}).length} total claims`);
    
    // Update claims with claimed status
    const updatedClaims = { ...distribution.claims };
    let updatedCount = 0;
    
    for (const { address, claimedAt } of CLAIMED_ADDRESSES) {
      const normalizedAddress = address.toLowerCase();
      
      if (updatedClaims[normalizedAddress]) {
        console.log(`\n📌 Marking ${address} as claimed`);
        console.log(`   Claim time: ${claimedAt}`);
        
        updatedClaims[normalizedAddress] = {
          ...updatedClaims[normalizedAddress],
          claimed: true,
          claimedAt: claimedAt
        };
        
        updatedCount++;
        console.log(`   ✅ Updated`);
      } else {
        console.log(`\n⚠️  Address ${address} not found in distribution claims`);
      }
    }
    
    if (updatedCount === 0) {
      console.log('\n⚠️  No addresses were updated');
      return;
    }
    
    // Save updated distribution
    console.log(`\n💾 Saving ${updatedCount} updated claims to Supabase...`);
    const { data: updated, error: updateError } = await supabase
      .from('merkle_distributions')
      .update({
        claims: updatedClaims
      })
      .eq('id', DISTRIBUTION_ID)
      .select();
    
    if (updateError) {
      throw new Error(`Failed to update distribution: ${updateError.message}`);
    }
    
    console.log('✅ Distribution updated successfully!');
    console.log(`   Distribution ID: ${DISTRIBUTION_ID}`);
    console.log(`   Addresses marked as claimed: ${updatedCount}`);
    
    // Show summary
    console.log('\n📊 Claim Summary:');
    console.log('-'.repeat(60));
    let totalClaimed = 0;
    let totalUnclaimed = 0;
    
    for (const [addr, claim] of Object.entries(updatedClaims)) {
      if (claim.claimed) {
        totalClaimed++;
        console.log(`✓ ${addr} - CLAIMED at ${claim.claimedAt}`);
      } else {
        totalUnclaimed++;
      }
    }
    
    console.log('-'.repeat(60));
    console.log(`Total Claims: ${Object.keys(updatedClaims).length}`);
    console.log(`Claimed: ${totalClaimed}`);
    console.log(`Unclaimed: ${totalUnclaimed}`);
    
    console.log('\n✅ Script completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updateClaimedStatus();
