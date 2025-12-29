require('dotenv').config({ path: '.env.local' });

console.log('🔍 Testing Alchemy API connection...\n');
console.log('API Key:', process.env.ALCHEMY_API_KEY ? '✅ Set' : '❌ Missing');

async function testAlchemy() {
  try {
    const res = await fetch(
      `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: []
        })
      }
    );
    
    const data = await res.json();
    
    if (data.error) {
      console.error('❌ Alchemy API Error:', data.error);
    } else {
      const blockNum = parseInt(data.result, 16);
      console.log('✅ Alchemy API working!');
      console.log('📊 Current block:', blockNum);
    }
  } catch (err) {
    console.error('❌ Connection error:', err.message);
  }
}

testAlchemy();
