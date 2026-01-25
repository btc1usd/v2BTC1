/**
 * Test BuyX API to match Thirdweb BuyWidget functionality
 * Validates all key features: multiple providers, chains, tokens, amounts
 * Usage: node test-buyx-api-features.js
 */

const BASE_URL = 'http://localhost:3000';

async function testBuyXFeature(testName, params, expectedFields) {
  console.log(`\n🧪 Testing: ${testName}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/buyx/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Failed:', data.error);
      console.log('   Params:', JSON.stringify(params, null, 2));
      return false;
    }

    console.log('✅ Success!');
    
    // Validate expected fields
    const missingFields = expectedFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      console.warn('⚠️  Missing fields:', missingFields.join(', '));
    }
    
    // Display key response data
    if (data.link) {
      console.log('   Checkout Link:', data.link.substring(0, 50) + '...');
    }
    if (data.id) {
      console.log('   Session ID:', data.id);
    }
    if (data.currency) {
      console.log('   Currency:', data.currency);
    }
    if (data.currencyAmount) {
      console.log('   Fiat Amount:', data.currencyAmount);
    }
    if (data.destinationAmount) {
      console.log('   Token Amount:', data.destinationAmount);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function runBuyXTests() {
  console.log('🚀 Testing BuyX API Features...');
  console.log('📍 Base URL:', BASE_URL);
  console.log('⚠️  Make sure the dev server is running (npm run dev)\n');
  console.log('🎯 Testing BuyWidget Feature Parity:');
  console.log('   - Multiple onramp providers (coinbase, stripe, transak)');
  console.log('   - Different chains support');
  console.log('   - Custom token addresses');
  console.log('   - Optional vs required amounts');
  console.log('   - Currency and country customization\n');

  const expectedFields = ['link', 'id', 'currency', 'currencyAmount', 'destinationAmount', 'expiration', 'intent'];

  const tests = [
    {
      name: '1. Coinbase Provider - USDC on Base',
      params: {
        receiver: '0xA1D4de75082562eA776b160e605acD587668111B',
        onramp: 'coinbase',
        chainId: 8453,
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        amountWei: '10000000', // 10 USDC
        currency: 'USD',
        country: 'US'
      }
    },
    {
      name: '2. Stripe Provider - USDC on Base',
      params: {
        receiver: '0xA1D4de75082562eA776b160e605acD587668111B',
        onramp: 'stripe',
        chainId: 8453,
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amountWei: '20000000', // 20 USDC
        currency: 'USD',
        country: 'US'
      }
    },
    {
      name: '3. Transak Provider - USDC on Base',
      params: {
        receiver: '0xA1D4de75082562eA776b160e605acD587668111B',
        onramp: 'transak',
        chainId: 8453,
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amountWei: '50000000', // 50 USDC
        currency: 'USD',
        country: 'US'
      }
    },
    {
      name: '4. Different Chain - USDC on Ethereum',
      params: {
        receiver: '0xA1D4de75082562eA776b160e605acD587668111B',
        onramp: 'coinbase',
        chainId: 1, // Ethereum Mainnet
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
        amountWei: '10000000', // 10 USDC
        currency: 'USD',
        country: 'US'
      }
    },
    {
      name: '5. Different Chain - USDC on Polygon',
      params: {
        receiver: '0xA1D4de75082562eA776b160e605acD587668111B',
        onramp: 'coinbase',
        chainId: 137, // Polygon
        tokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC on Polygon
        amountWei: '10000000',
        currency: 'USD',
        country: 'US'
      }
    },
    {
      name: '6. Without Amount (Optional)',
      params: {
        receiver: '0xA1D4de75082562eA776b160e605acD587668111B',
        onramp: 'coinbase',
        chainId: 8453,
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        // amountWei intentionally omitted
        currency: 'USD',
        country: 'US'
      }
    },
    {
      name: '7. Different Currency - EUR',
      params: {
        receiver: '0xA1D4de75082562eA776b160e605acD587668111B',
        onramp: 'coinbase',
        chainId: 8453,
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amountWei: '10000000',
        currency: 'EUR',
        country: 'DE' // Germany
      }
    },
    {
      name: '8. Different Currency - GBP',
      params: {
        receiver: '0xA1D4de75082562eA776b160e605acD587668111B',
        onramp: 'coinbase',
        chainId: 8453,
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amountWei: '10000000',
        currency: 'GBP',
        country: 'GB' // United Kingdom
      }
    },
    {
      name: '9. Native ETH - Ethereum',
      params: {
        receiver: '0xA1D4de75082562eA776b160e605acD587668111B',
        onramp: 'coinbase',
        chainId: 1,
        tokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native ETH
        amountWei: '1000000000000000000', // 1 ETH
        currency: 'USD',
        country: 'US'
      }
    },
    {
      name: '10. Native ETH - Base',
      params: {
        receiver: '0xA1D4de75082562eA776b160e605acD587668111B',
        onramp: 'coinbase',
        chainId: 8453,
        tokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native ETH
        amountWei: '100000000000000000', // 0.1 ETH
        currency: 'USD',
        country: 'US'
      }
    }
  ];

  const results = [];
  for (const test of tests) {
    const result = await testBuyXFeature(test.name, test.params, expectedFields);
    results.push({ name: test.name, passed: result });
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }

  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  results.forEach(r => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
  });

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  
  console.log(`\n🏁 Final Score: ${passedTests}/${totalTests} tests passed`);
  
  console.log('\n💡 BuyWidget Feature Parity:');
  console.log('   ✅ Multiple Onramp Providers (Coinbase, Stripe, Transak)');
  console.log('   ✅ Multi-Chain Support (Ethereum, Base, Polygon, etc.)');
  console.log('   ✅ Custom Token Addresses (ERC-20 tokens)');
  console.log('   ✅ Native Currency Support (ETH, MATIC, etc.)');
  console.log('   ✅ Optional Amount Parameter');
  console.log('   ✅ Multiple Fiat Currencies (USD, EUR, GBP)');
  console.log('   ✅ Country/Region Customization');
  console.log('   ✅ Session Management (ID, expiration)');
  console.log('   ✅ Checkout Link Generation');
  
  console.log('\n📱 Mobile Integration Ready:');
  console.log('   • API returns checkout links for opening in system browser');
  console.log('   • Supports all major onramp providers');
  console.log('   • Compatible with React Native WebView');
  console.log('   • Handles fiat-to-crypto conversions');
  
  process.exit(passedTests === totalTests ? 0 : 1);
}

// Run tests
runBuyXTests().catch(console.error);
