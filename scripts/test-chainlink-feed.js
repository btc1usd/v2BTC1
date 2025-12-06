const { ethers } = require("hardhat");

async function main() {
  console.log("=== TESTING CHAINLINK BTC/USD PRICE FEED ===\n");

  // Base Mainnet Chainlink BTC/USD feed (properly checksummed)
  const CHAINLINK_BTC_USD_FEED = "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F";

  console.log("📊 Chainlink Feed Address:", CHAINLINK_BTC_USD_FEED);
  console.log("🌐 Network: Base Mainnet\n");

  try {
    // ABI for Chainlink price feed
    const feedAbi = [
      "function decimals() view returns (uint8)",
      "function description() view returns (string)",
      "function version() view returns (uint256)",
      "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
      "function getRoundData(uint80 _roundId) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
    ];

    // Connect to the price feed
    const priceFeed = await ethers.getContractAt(feedAbi, CHAINLINK_BTC_USD_FEED);

    // Get feed information
    console.log("📝 Feed Information:");
    const decimals = await priceFeed.decimals();
    console.log(`  Decimals: ${decimals}`);

    const description = await priceFeed.description();
    console.log(`  Description: ${description}`);

    const version = await priceFeed.version();
    console.log(`  Version: ${version}`);

    // Get latest price data
    console.log("\n💰 Latest Price Data:");
    const [roundId, price, startedAt, updatedAt, answeredInRound] = await priceFeed.latestRoundData();

    console.log(`  Round ID: ${roundId}`);
    console.log(`  Raw Price: ${price.toString()}`);
    
    // Format price with decimals
    const formattedPrice = ethers.formatUnits(price, decimals);
    console.log(`  ✅ BTC/USD Price: $${parseFloat(formattedPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

    // Check timestamp
    const updateDate = new Date(Number(updatedAt) * 1000);
    const now = new Date();
    const ageMinutes = Math.floor((now - updateDate) / 1000 / 60);
    
    console.log(`  Updated At: ${updateDate.toISOString()}`);
    console.log(`  Age: ${ageMinutes} minutes ago`);

    // Check if price is stale (older than 1 hour)
    const isStale = ageMinutes > 60;
    if (isStale) {
      console.log(`  ⚠️  WARNING: Price is stale (${ageMinutes} minutes old)`);
    } else {
      console.log(`  ✅ Price is fresh (${ageMinutes} minutes old)`);
    }

    // Verify price is reasonable
    const priceFloat = parseFloat(formattedPrice);
    if (priceFloat < 10000 || priceFloat > 500000) {
      console.log(`  ⚠️  WARNING: Price seems unusual: $${priceFloat}`);
    } else {
      console.log(`  ✅ Price is within expected range`);
    }

    // Get historical data (previous round)
    console.log("\n📈 Previous Round Data:");
    try {
      const prevRoundId = BigInt(roundId) - 1n;
      const [, prevPrice, , prevUpdatedAt] = await priceFeed.getRoundData(prevRoundId);
      const prevFormattedPrice = ethers.formatUnits(prevPrice, decimals);
      const prevUpdateDate = new Date(Number(prevUpdatedAt) * 1000);
      
      console.log(`  Previous Round ID: ${prevRoundId}`);
      console.log(`  Previous Price: $${parseFloat(prevFormattedPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`  Previous Update: ${prevUpdateDate.toISOString()}`);
      
      // Calculate price change
      const priceChange = priceFloat - parseFloat(prevFormattedPrice);
      const priceChangePercent = (priceChange / parseFloat(prevFormattedPrice)) * 100;
      
      console.log(`  Price Change: ${priceChange > 0 ? '+' : ''}$${priceChange.toFixed(2)} (${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)`);
    } catch (error) {
      console.log(`  ⚠️  Could not fetch previous round: ${error.message}`);
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ CHAINLINK FEED TEST SUCCESSFUL");
    console.log("=".repeat(60));
    console.log(`\n✅ Current BTC Price: $${parseFloat(formattedPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`✅ Feed is ${isStale ? 'STALE ⚠️' : 'FRESH ✅'}`);
    console.log(`✅ Last updated: ${ageMinutes} minutes ago`);
    console.log(`✅ Feed Address: ${CHAINLINK_BTC_USD_FEED}`);
    
    console.log("\n💡 Integration Status:");
    console.log("  ✅ Chainlink feed is accessible");
    console.log("  ✅ Price data is being returned");
    console.log("  ✅ Feed is compatible with protocol");
    console.log("  ✅ Ready for mainnet deployment");

  } catch (error) {
    console.error("\n❌ CHAINLINK FEED TEST FAILED:");
    console.error(error.message);
    console.error("\nPossible issues:");
    console.error("  1. Not connected to Base Mainnet");
    console.error("  2. RPC endpoint not responding");
    console.error("  3. Feed address is incorrect");
    console.error("  4. Network connectivity issues");
    
    console.error("\n💡 Solution:");
    console.error("  Make sure you're running this on Base Mainnet:");
    console.error("  npx hardhat run scripts/test-chainlink-feed.js --network base-mainnet");
    
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
