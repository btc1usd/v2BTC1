/**
 * Cross-chain swap test for mobile app
 * Tests swapping from different chains to different tokens
 * Usage: node test-cross-chain-swap.js
 */

const BASE_URL = 'http://localhost:3000';

async function testCrossChainSwap(testName, params) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`   ${params.fromChain} → ${params.toChain}`);
  console.log(`   ${params.fromToken} → ${params.toToken}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/swapx/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromTokenAddress: params.fromTokenAddress,
        fromChainId: params.fromChainId,
        amountWei: params.amountWei,
        toTokenAddress: params.toTokenAddress,
        toChainId: params.toChainId
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Failed:', data.error);
      return false;
    }

    console.log('✅ Success!');
    console.log('   Route found:', !!data.quote);
    if (data.quote) {
      console.log('   Buy amount:', data.quote.buyAmountWei || data.quote.destinationAmount);
      console.log('   Estimated time:', data.quote.estimatedExecutionTimeMs ? `${data.quote.estimatedExecutionTimeMs / 1000}s` : 'N/A');
    }
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function runCrossChainTests() {
  console.log('🚀 Starting Cross-Chain Swap Tests...');
  console.log('📍 Base URL:', BASE_URL);
  console.log('⚠️  Make sure the dev server is running (npm run dev)\n');

  const tests = [
    {
      name: 'Same-chain: ETH → USDC on Base',
      params: {
        fromChain: 'Base',
        toChain: 'Base',
        fromToken: 'ETH',
        toToken: 'USDC',
        fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        fromChainId: 8453,
        amountWei: '1000000000000000', // 0.001 ETH
        toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        toChainId: 8453
      }
    },
    {
      name: 'Cross-chain: ETH on Ethereum → USDC on Base',
      params: {
        fromChain: 'Ethereum',
        toChain: 'Base',
        fromToken: 'ETH',
        toToken: 'USDC',
        fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        fromChainId: 1, // Ethereum Mainnet
        amountWei: '1000000000000000', // 0.001 ETH
        toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        toChainId: 8453 // Base
      }
    },
    {
      name: 'Cross-chain: USDC on Polygon → USDC on Base',
      params: {
        fromChain: 'Polygon',
        toChain: 'Base',
        fromToken: 'USDC',
        toToken: 'USDC',
        fromTokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC on Polygon
        fromChainId: 137, // Polygon
        amountWei: '10000000', // 10 USDC (6 decimals)
        toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
        toChainId: 8453 // Base
      }
    },
    {
      name: 'Cross-chain: ETH on Optimism → USDC on Base',
      params: {
        fromChain: 'Optimism',
        toChain: 'Base',
        fromToken: 'ETH',
        toToken: 'USDC',
        fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        fromChainId: 10, // Optimism
        amountWei: '1000000000000000', // 0.001 ETH
        toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        toChainId: 8453 // Base
      }
    },
    {
      name: 'Cross-chain: ETH on Arbitrum → USDC on Base',
      params: {
        fromChain: 'Arbitrum',
        toChain: 'Base',
        fromToken: 'ETH',
        toToken: 'USDC',
        fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        fromChainId: 42161, // Arbitrum One
        amountWei: '1000000000000000', // 0.001 ETH
        toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        toChainId: 8453 // Base
      }
    }
  ];

  const results = [];
  for (const test of tests) {
    const result = await testCrossChainSwap(test.name, test.params);
    results.push({ name: test.name, passed: result });
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }

  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  results.forEach(r => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
  });

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  
  console.log(`\n🏁 Final Score: ${passedTests}/${totalTests} tests passed`);
  console.log('\n💡 Key Capabilities:');
  console.log('   • Same-chain token swaps (e.g., ETH → USDC on Base)');
  console.log('   • Cross-chain swaps (e.g., ETH on Ethereum → USDC on Base)');
  console.log('   • Multi-chain support (Ethereum, Base, Polygon, Optimism, Arbitrum, etc.)');
  console.log('   • Any ERC-20 token to any ERC-20 token');
  console.log('   • Fully compatible with React Native mobile apps');
  
  process.exit(passedTests === totalTests ? 0 : 1);
}

// Run tests
runCrossChainTests().catch(console.error);
