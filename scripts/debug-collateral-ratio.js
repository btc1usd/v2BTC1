const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔍 Debugging Collateral Ratio Calculation\n");
  
  const vaultAddress = process.env.NEXT_PUBLIC_VAULT_CONTRACT;
  const btc1usdAddress = process.env.NEXT_PUBLIC_BTC1USD_CONTRACT;
  const oracleAddress = process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT;
  
  if (!vaultAddress || !btc1usdAddress || !oracleAddress) {
    console.error("❌ Missing contract addresses in .env");
    process.exit(1);
  }
  
  console.log("📍 Addresses:");
  console.log("Vault:", vaultAddress);
  console.log("BTC1USD:", btc1usdAddress);
  console.log("Oracle:", oracleAddress);
  console.log();
  
  const provider = ethers.provider;
  
  // Create contract instances
  const vaultABI = [
    "function getCurrentCollateralRatio() view returns (uint256)",
    "function getTotalCollateralValue() view returns (uint256)",
    "function getCollateralList() view returns (address[])",
    "function collateralBalances(address) view returns (uint256)",
    "function supportedCollateral(address) view returns (bool)"
  ];
  
  const btc1usdABI = [
    "function totalSupply() view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];
  
  const oracleABI = [
    "function getPrice(address) view returns (uint256)",
    "function getBTCPrice() view returns (uint256)",
    "function isStale() view returns (bool)"
  ];
  
  const erc20ABI = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function balanceOf(address) view returns (uint256)"
  ];
  
  const vault = new ethers.Contract(vaultAddress, vaultABI, provider);
  const btc1usd = new ethers.Contract(btc1usdAddress, btc1usdABI, provider);
  const oracle = new ethers.Contract(oracleAddress, oracleABI, provider);
  
  try {
    // Get BTC1USD total supply
    const totalSupply = await btc1usd.totalSupply();
    const btc1Decimals = await btc1usd.decimals();
    console.log("📊 BTC1USD Total Supply:");
    console.log(`   ${ethers.formatUnits(totalSupply, btc1Decimals)} BTC1USD`);
    console.log(`   Raw: ${totalSupply.toString()}`);
    console.log();
    
    // Get total collateral value
    const totalCollateralValue = await vault.getTotalCollateralValue();
    console.log("💰 Total Collateral Value:");
    console.log(`   $${ethers.formatUnits(totalCollateralValue, 8)}`);
    console.log(`   Raw: ${totalCollateralValue.toString()}`);
    console.log();
    
    // Get current collateral ratio
    const currentCR = await vault.getCurrentCollateralRatio();
    console.log("📈 Current Collateral Ratio:");
    console.log(`   ${ethers.formatUnits(currentCR, 8)}x (${(Number(ethers.formatUnits(currentCR, 8)) * 100).toFixed(2)}%)`);
    console.log(`   Raw: ${currentCR.toString()}`);
    console.log();
    
    // Manual calculation verification
    if (totalSupply > 0n) {
      const manualCR = (totalCollateralValue * 100000000n) / totalSupply;
      console.log("🔢 Manual Calculation Verification:");
      console.log(`   Formula: (totalCollateralValue * 1e8) / totalSupply`);
      console.log(`   = (${totalCollateralValue} * 100000000) / ${totalSupply}`);
      console.log(`   = ${manualCR}`);
      console.log(`   = ${ethers.formatUnits(manualCR, 8)}x`);
      console.log(`   Matches contract: ${manualCR === currentCR ? "✅ YES" : "❌ NO"}`);
      console.log();
    }
    
    // Get collateral token details
    const collateralList = await vault.getCollateralList();
    console.log(`🪙 Collateral Tokens (${collateralList.length}):`);
    console.log();
    
    let calculatedTotalValue = 0n;
    
    for (let i = 0; i < collateralList.length; i++) {
      const tokenAddress = collateralList[i];
      const token = new ethers.Contract(tokenAddress, erc20ABI, provider);
      
      try {
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const balance = await vault.collateralBalances(tokenAddress);
        const actualBalance = await token.balanceOf(vaultAddress);
        const price = await oracle.getPrice(tokenAddress);
        const isSupported = await vault.supportedCollateral(tokenAddress);
        
        console.log(`   ${i + 1}. ${symbol} (${tokenAddress})`);
        console.log(`      Decimals: ${decimals}`);
        console.log(`      Supported: ${isSupported ? "✅" : "❌"}`);
        console.log(`      Accounting Balance: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
        console.log(`      Actual Balance: ${ethers.formatUnits(actualBalance, decimals)} ${symbol}`);
        console.log(`      Price: $${ethers.formatUnits(price, 8)}`);
        
        if (balance > 0n && price > 0n) {
          // Calculate value: balance * price / (10 ** decimals)
          const value = (balance * price) / (10n ** BigInt(decimals));
          calculatedTotalValue += value;
          console.log(`      Value: $${ethers.formatUnits(value, 8)}`);
          console.log(`      Calculation: (${balance} * ${price}) / 10^${decimals} = ${value}`);
        } else {
          console.log(`      Value: $0 (balance or price is zero)`);
        }
        console.log();
      } catch (error) {
        console.log(`   ❌ Error reading token ${i + 1}: ${error.message}`);
        console.log();
      }
    }
    
    console.log("🧮 Verification Summary:");
    console.log(`   Contract Total Value: $${ethers.formatUnits(totalCollateralValue, 8)}`);
    console.log(`   Calculated Total Value: $${ethers.formatUnits(calculatedTotalValue, 8)}`);
    console.log(`   Match: ${calculatedTotalValue === totalCollateralValue ? "✅ YES" : "❌ NO (ISSUE DETECTED!)"}`);
    console.log();
    
    // Check oracle freshness
    const isStale = await oracle.isStale();
    console.log("🕐 Oracle Status:");
    console.log(`   Stale: ${isStale ? "⚠️  YES (PRICES MAY BE OLD)" : "✅ NO (FRESH)"}`);
    
    const btcPrice = await oracle.getBTCPrice();
    console.log(`   BTC Price: $${ethers.formatUnits(btcPrice, 8)}`);
    console.log();
    
    // Diagnostic checks
    console.log("🔍 Diagnostic Checks:");
    
    if (totalSupply === 0n) {
      console.log("   ⚠️  No BTC1USD has been minted yet");
    } else if (currentCR === 0n) {
      console.log("   ❌ ISSUE: Collateral ratio is 0 but supply exists!");
      console.log("      This indicates totalCollateralValue is 0");
    } else if (currentCR < 120000000n) {
      console.log(`   ⚠️  WARNING: Collateral ratio (${ethers.formatUnits(currentCR, 8)}x) is below minimum (1.20x)`);
    } else {
      console.log(`   ✅ Collateral ratio is healthy (${ethers.formatUnits(currentCR, 8)}x >= 1.20x)`);
    }
    
    if (calculatedTotalValue !== totalCollateralValue) {
      console.log("   ❌ ISSUE: Manual calculation doesn't match contract!");
      console.log("      Possible causes:");
      console.log("      - Collateral token balance mismatch");
      console.log("      - Oracle price returning 0 for some tokens");
      console.log("      - Decimal conversion issues");
    }
    
    if (isStale) {
      console.log("   ⚠️  Oracle is stale - prices may not be current");
    }
    
    console.log();
    console.log("💡 Why Collateral Ratio Might Not Change:");
    console.log("   1. If total supply and total value increase proportionally, CR stays same");
    console.log("   2. If minting at current CR, the ratio should stay approximately constant");
    console.log("   3. Oracle prices might not be updating (check if stale)");
    console.log("   4. Collateral balances might not be properly tracked");
    console.log();
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
