/**
 * Test the new Tokens API for fetching tokens by chainId
 * Usage: node test-tokens-api.js
 */

const BASE_URL = 'http://localhost:3000';

async function testTokensAPI() {
  console.log('🚀 Testing Tokens API...');
  console.log('📍 Base URL:', BASE_URL);
  console.log('⚠️  Make sure the dev server is running (npm run dev)\n');

  // Test GET endpoint
  console.log('🧪 Testing GET endpoint with query params...');
  try {
    const response = await fetch(`${BASE_URL}/api/tokens?chainId=1&limit=5&includePrices=false`);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ GET request failed:', data.error);
      console.error('   Details:', data.details);
      return false;
    }
    
    console.log('✅ GET request successful!');
    console.log('   Chain ID:', data.chainId);
    console.log('   Token count:', data.tokens.length);
    console.log('   Pagination:', data.pagination);
    console.log('   Timestamp:', data.timestamp);
    
    if (data.tokens.length > 0) {
      console.log('   Sample token:', {
        symbol: data.tokens[0].symbol,
        name: data.tokens[0].name,
        address: data.tokens[0].address,
        decimals: data.tokens[0].decimals
      });
    }
  } catch (error) {
    console.error('❌ GET request error:', error.message);
    return false;
  }

  console.log('\n🧪 Testing GET endpoint with Base chain (8453)...');
  try {
    const response = await fetch(`${BASE_URL}/api/tokens?chainId=8453&limit=5&includePrices=true`);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Base chain GET request failed:', data.error);
      console.error('   Details:', data.details);
      return false;
    }
    
    console.log('✅ Base chain GET request successful!');
    console.log('   Chain ID:', data.chainId);
    console.log('   Token count:', data.tokens.length);
    
    if (data.tokens.length > 0) {
      console.log('   Sample token:', {
        symbol: data.tokens[0].symbol,
        name: data.tokens[0].name,
        address: data.tokens[0].address,
        decimals: data.tokens[0].decimals,
        price: data.tokens[0].price
      });
    }
  } catch (error) {
    console.error('❌ Base chain GET request error:', error.message);
    return false;
  }

  console.log('\n🧪 Testing POST endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chainId: 1,
        limit: 3,
        includePrices: false
      })
    });
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ POST request failed:', data.error);
      console.error('   Details:', data.details);
      return false;
    }
    
    console.log('✅ POST request successful!');
    console.log('   Chain ID:', data.chainId);
    console.log('   Token count:', data.tokens.length);
    
    if (data.tokens.length > 0) {
      console.log('   Sample token:', {
        symbol: data.tokens[0].symbol,
        name: data.tokens[0].name,
        address: data.tokens[0].address,
        decimals: data.tokens[0].decimals
      });
    }
  } catch (error) {
    console.error('❌ POST request error:', error.message);
    return false;
  }

  console.log('\n🧪 Testing error handling...');
  try {
    const response = await fetch(`${BASE_URL}/api/tokens?chainId=invalid`);
    const data = await response.json();
    
    if (response.ok) {
      console.error('❌ Expected error for invalid chainId but got success');
      return false;
    }
    
    console.log('✅ Error handling working correctly!');
    console.log('   Error message:', data.error);
  } catch (error) {
    console.error('❌ Error handling test error:', error.message);
    return false;
  }

  console.log('\n🧪 Testing with Polygon chain (137)...');
  try {
    const response = await fetch(`${BASE_URL}/api/tokens?chainId=137&limit=5`);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Polygon chain request failed:', data.error);
      console.error('   Details:', data.details);
      return false;
    }
    
    console.log('✅ Polygon chain request successful!');
    console.log('   Chain ID:', data.chainId);
    console.log('   Token count:', data.tokens.length);
    
    if (data.tokens.length > 0) {
      console.log('   Sample token:', {
        symbol: data.tokens[0].symbol,
        name: data.tokens[0].name,
        address: data.tokens[0].address
      });
    }
  } catch (error) {
    console.error('❌ Polygon chain request error:', error.message);
    return false;
  }

  console.log('\n✅ All tests passed!');
  console.log('\n💡 API Features:');
  console.log('   • GET endpoint with query parameters');
  console.log('   • POST endpoint with request body');
  console.log('   • Pagination support (limit, offset)');
  console.log('   • Price inclusion toggle');
  console.log('   • Error handling for invalid parameters');
  console.log('   • Multiple chain support (Ethereum, Base, Polygon, etc.)');
  console.log('   • Mobile-friendly response format');
  
  console.log('\n📱 Mobile Integration Ready:');
  console.log('   • Fetch tokens for any supported chain');
  console.log('   • Lightweight responses (optional prices)');
  console.log('   • Standard JSON format');
  console.log('   • Compatible with React Native fetch');
  
  return true;
}

// Run tests
testTokensAPI().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test failed with exception:', error);
  process.exit(1);
});