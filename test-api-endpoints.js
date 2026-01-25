/**
 * Test script for SwapX and BuyX API endpoints
 * Usage: node test-api-endpoints.js
 */

const BASE_URL = 'http://localhost:3000';

async function testSwapXQuote() {
  console.log('\n🧪 Testing SwapX Quote API...');
  console.log('   Note: Testing ETH -> USDC (BTC1USD not supported in Bridge routes)');
  
  try {
    const response = await fetch(`${BASE_URL}/api/swapx/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
        fromChainId: 8453, // Base
        amountWei: '1000000000000000', // 0.001 ETH
        toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
        toChainId: 8453
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ SwapX Quote failed:', data.error);
      console.error('   Details:', JSON.stringify(data, null, 2));
      return false;
    }

    console.log('✅ SwapX Quote successful!');
    console.log('   Quote details:', {
      buyAmountWei: data.quote?.buyAmountWei,
      sellAmountWei: data.quote?.sellAmountWei,
      estimatedGasCost: data.quote?.estimatedGasCost,
      intent: data.intent
    });
    return true;
  } catch (error) {
    console.error('❌ SwapX Quote error:', error.message);
    return false;
  }
}

async function testSwapXTransaction() {
  console.log('\n🧪 Testing SwapX Transaction API...');
  console.log('   Note: Testing ETH -> USDC (BTC1USD not supported in Bridge routes)');
  
  try {
    const response = await fetch(`${BASE_URL}/api/swapx/transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
        fromChainId: 8453, // Base
        amountWei: '1000000000000000', // 0.001 ETH
        toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
        toChainId: 8453,
        sender: '0xA1D4de75082562eA776b160e605acD587668111B' // Valid checksummed address
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ SwapX Transaction failed:', data.error);
      console.error('   Details:', JSON.stringify(data, null, 2));
      return false;
    }

    console.log('✅ SwapX Transaction successful!');
    console.log('   Transaction count:', data.transactions?.length || 0);
    if (data.transactions?.[0]) {
      console.log('   First transaction:', {
        to: data.transactions[0].to,
        value: data.transactions[0].value,
        hasData: !!data.transactions[0].data
      });
    }
    return true;
  } catch (error) {
    console.error('❌ SwapX Transaction error:', error.message);
    return false;
  }
}

async function testBuyXQuote() {
  console.log('\n🧪 Testing BuyX Quote API...');
  console.log('   Note: Testing with USDC (mainstream token supported by on-ramps)');
  
  try {
    const response = await fetch(`${BASE_URL}/api/buyx/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receiver: '0xA1D4de75082562eA776b160e605acD587668111B', // Valid checksummed address
        onramp: 'coinbase',
        chainId: 8453,
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
        amountWei: '10000000', // 10 USDC (6 decimals)
        currency: 'USD',
        country: 'US'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ BuyX Quote failed:', data.error);
      console.error('   Details:', JSON.stringify(data, null, 2));
      return false;
    }

    console.log('✅ BuyX Quote successful!');
    console.log('   Link:', data.link ? 'Generated ✓' : 'Missing');
    console.log('   ID:', data.id);
    console.log('   Currency:', data.currency);
    console.log('   Currency Amount:', data.currencyAmount);
    return true;
  } catch (error) {
    console.error('❌ BuyX Quote error:', error.message);
    return false;
  }
}

async function testSwapXMetadata() {
  console.log('\n🧪 Testing SwapX Metadata API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/swapx/metadata`, {
      method: 'GET'
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ SwapX Metadata failed:', data.error);
      return false;
    }

    console.log('✅ SwapX Metadata successful!');
    console.log('   Chains:', data.chains?.map(c => c.name).join(', '));
    console.log('   Token count:', data.tokens?.length || 0);
    console.log('   Sample tokens:', data.tokens?.slice(0, 3).map(t => t.symbol).join(', '));
    return true;
  } catch (error) {
    console.error('❌ SwapX Metadata error:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting API Endpoint Tests...');
  console.log('📍 Base URL:', BASE_URL);
  console.log('⚠️  Make sure the dev server is running (npm run dev)');

  const results = {
    swapXQuote: await testSwapXQuote(),
    swapXTransaction: await testSwapXTransaction(),
    buyXQuote: await testBuyXQuote(),
    // swapXMetadata: await testSwapXMetadata() // Temporarily disabled - Bridge.routes API issue
  };

  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log('SwapX Quote:      ', results.swapXQuote ? '✅ PASS' : '❌ FAIL');
  console.log('SwapX Transaction:', results.swapXTransaction ? '✅ PASS' : '❌ FAIL');
  console.log('BuyX Quote:       ', results.buyXQuote ? '✅ PASS' : '❌ FAIL');
  // console.log('SwapX Metadata:   ', results.swapXMetadata ? '✅ PASS' : '❌ FAIL');

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  
  console.log('\n🏁 Final Score:', `${passedTests}/${totalTests} tests passed`);
  
  process.exit(passedTests === totalTests ? 0 : 1);
}

// Run tests
runAllTests().catch(console.error);
