const { supabase, isSupabaseConfigured } = require('./lib/supabase');

async function testSupabase() {
  console.log('Supabase configured:', isSupabaseConfigured());
  
  if (supabase) {
    console.log('Testing connection...');
    try {
      const { data, error } = await supabase.from('merkle_distributions').select('id').limit(1);
      console.log('Test result:', { data, error });
      
      if (error) {
        console.log('Error details:', error);
      } else {
        console.log('Successfully connected to Supabase and queried merkle_distributions table');
        if (data) {
          console.log(`Found ${data.length} distribution records`);
        }
      }
    } catch (err) {
      console.log('Connection error:', err.message);
    }
  } else {
    console.log('Supabase client is not initialized');
  }
}

testSupabase().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch((err) => {
  console.log('Test error:', err);
  process.exit(1);
});