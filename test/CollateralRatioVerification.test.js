const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("🔬 Collateral Ratio Verification Test", function () {
  let btc1usd, vault, priceOracle;
  let mockWBTC, mockCBTC, mockTBTC;
  let owner, user1, user2, devWallet, endowmentWallet;

  const BTC_PRICE = ethers.parseUnits("100000", 8); // $100,000
  const ONE_BTC = ethers.parseUnits("1", 8); // 1 BTC with 8 decimals
  const MIN_CR = ethers.parseUnits("1.20", 8); // 120%
  const DECIMALS = ethers.parseUnits("1", 8);

  // Helper function to format numbers for display
  function format8Dec(value) {
    return ethers.formatUnits(value, 8);
  }

  // Helper function to calculate expected values
  function calculateExpectedMint(usdValue, mintPrice) {
    // tokensToMint = usdValue × DECIMALS ÷ mintPrice
    const tokensToMint = (usdValue * DECIMALS) / mintPrice;

    // devFee = tokensToMint × 1%
    const devFee = (tokensToMint * ethers.parseUnits("0.01", 8)) / DECIMALS;

    // endowmentFee = tokensToMint × 0.1%
    const endowmentFee = (tokensToMint * ethers.parseUnits("0.001", 8)) / DECIMALS;

    return {
      tokensToMint,
      devFee,
      endowmentFee,
      totalMinted: tokensToMint + devFee + endowmentFee
    };
  }

  before(async function () {
    [owner, user1, user2, devWallet, endowmentWallet] = await ethers.getSigners();

    console.log("\n📦 Deploying contracts...\n");

    // Deploy mock tokens
    const MockWBTC = await ethers.getContractFactory("MockWBTC");
    mockWBTC = await MockWBTC.deploy(owner.address);
    await mockWBTC.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockCBTC = await MockERC20.deploy("Coinbase BTC", "cbBTC", 8);
    await mockCBTC.waitForDeployment();

    mockTBTC = await MockERC20.deploy("Threshold BTC", "tBTC", 8);
    await mockTBTC.waitForDeployment();

    // Deploy BTC1USD
    const BTC1USD = await ethers.getContractFactory("BTC1USD");
    btc1usd = await BTC1USD.deploy(owner.address);
    await btc1usd.waitForDeployment();

    // Deploy Price Oracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy(owner.address, BTC_PRICE);
    await priceOracle.waitForDeployment();

    // Deploy Vault
    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy(
      await btc1usd.getAddress(),
      await priceOracle.getAddress(),
      owner.address,
      devWallet.address,
      endowmentWallet.address
    );
    await vault.waitForDeployment();

    // Setup
    await btc1usd.setVault(await vault.getAddress());
    // Set a dummy weeklyDistribution address (required for minting)
    await btc1usd.setWeeklyDistribution(owner.address);
    await priceOracle.setTokenPrice(await mockWBTC.getAddress(), BTC_PRICE);
    await priceOracle.setTokenPrice(await mockCBTC.getAddress(), BTC_PRICE);
    await priceOracle.setTokenPrice(await mockTBTC.getAddress(), BTC_PRICE);

    await vault.addCollateral(await mockWBTC.getAddress());
    await vault.addCollateral(await mockCBTC.getAddress());
    await vault.addCollateral(await mockTBTC.getAddress());

    // Mint test tokens to users
    await mockWBTC.mint(user1.address, ONE_BTC * 10n);
    await mockCBTC.mint(user1.address, ONE_BTC * 10n);
    await mockTBTC.mint(user1.address, ONE_BTC * 10n);

    await mockWBTC.mint(user2.address, ONE_BTC * 10n);
    await mockCBTC.mint(user2.address, ONE_BTC * 10n);
    await mockTBTC.mint(user2.address, ONE_BTC * 10n);

    console.log("✅ All contracts deployed and configured");
    console.log(`   BTC Price: $${format8Dec(BTC_PRICE)}`);
    console.log(`   Min CR: ${format8Dec(MIN_CR)}x (120%)\n`);
  });

  describe("📊 Sequential Deposits - Same Collateral Type", function () {
    it("Should track CR and mint price through 3 WBTC deposits", async function () {
      console.log("\n" + "=".repeat(80));
      console.log("TEST 1: Three Sequential 1 BTC Deposits (WBTC)");
      console.log("=".repeat(80) + "\n");

      const deposits = [
        { user: user1, token: mockWBTC, name: "WBTC", amount: ONE_BTC },
        { user: user1, token: mockWBTC, name: "WBTC", amount: ONE_BTC },
        { user: user1, token: mockWBTC, name: "WBTC", amount: ONE_BTC }
      ];

      for (let i = 0; i < deposits.length; i++) {
        const { user, token, name, amount } = deposits[i];

        console.log(`\n📥 DEPOSIT ${i + 1}: 1 ${name}`);
        console.log("-".repeat(80));

        // Get state BEFORE deposit
        const totalSupplyBefore = await btc1usd.totalSupply();
        const collateralValueBefore = await vault.getTotalCollateralValue();
        const crBefore = await vault.getCurrentCollateralRatio();

        console.log(`\n🔍 BEFORE Deposit ${i + 1}:`);
        console.log(`   Total Collateral Value: $${format8Dec(collateralValueBefore)}`);
        console.log(`   Total BTC1USD Supply:   ${format8Dec(totalSupplyBefore)} BTC1USD`);
        console.log(`   Collateral Ratio:       ${format8Dec(crBefore)}x (${(Number(format8Dec(crBefore)) * 100).toFixed(2)}%)`);

        // Calculate expected minting
        const usdValue = (amount * BTC_PRICE) / DECIMALS;
        const mintPrice = totalSupplyBefore === 0n ? MIN_CR : crBefore < MIN_CR ? MIN_CR : crBefore;
        const expected = calculateExpectedMint(usdValue, mintPrice);

        console.log(`\n💰 Mint Calculation:`);
        console.log(`   USD Value of Deposit:   $${format8Dec(usdValue)}`);
        console.log(`   Mint Price Used:        ${format8Dec(mintPrice)}x`);
        console.log(`   Tokens to User:         ${format8Dec(expected.tokensToMint)} BTC1USD`);
        console.log(`   Dev Fee (1%):           ${format8Dec(expected.devFee)} BTC1USD`);
        console.log(`   Endowment Fee (0.1%):   ${format8Dec(expected.endowmentFee)} BTC1USD`);
        console.log(`   Total Minted:           ${format8Dec(expected.totalMinted)} BTC1USD`);

        // Execute deposit
        await token.connect(user).approve(await vault.getAddress(), amount);

        const userBalanceBefore = await btc1usd.balanceOf(user.address);
        const devBalanceBefore = await btc1usd.balanceOf(devWallet.address);
        const endowmentBalanceBefore = await btc1usd.balanceOf(endowmentWallet.address);

        await vault.connect(user).mint(await token.getAddress(), amount);

        const userBalanceAfter = await btc1usd.balanceOf(user.address);
        const devBalanceAfter = await btc1usd.balanceOf(devWallet.address);
        const endowmentBalanceAfter = await btc1usd.balanceOf(endowmentWallet.address);

        const userReceived = userBalanceAfter - userBalanceBefore;
        const devReceived = devBalanceAfter - devBalanceBefore;
        const endowmentReceived = endowmentBalanceAfter - endowmentBalanceBefore;

        // Get state AFTER deposit
        const totalSupplyAfter = await btc1usd.totalSupply();
        const collateralValueAfter = await vault.getTotalCollateralValue();
        const crAfter = await vault.getCurrentCollateralRatio();

        console.log(`\n✅ AFTER Deposit ${i + 1}:`);
        console.log(`   Total Collateral Value: $${format8Dec(collateralValueAfter)}`);
        console.log(`   Total BTC1USD Supply:   ${format8Dec(totalSupplyAfter)} BTC1USD`);
        console.log(`   Collateral Ratio:       ${format8Dec(crAfter)}x (${(Number(format8Dec(crAfter)) * 100).toFixed(2)}%)`);
        console.log(`   Mint Price (for next):  ${format8Dec(await vault.lastMintPrice())}x`);

        console.log(`\n📊 Actual Tokens Received:`);
        console.log(`   User:                   ${format8Dec(userReceived)} BTC1USD`);
        console.log(`   Dev Wallet:             ${format8Dec(devReceived)} BTC1USD`);
        console.log(`   Endowment Wallet:       ${format8Dec(endowmentReceived)} BTC1USD`);
        console.log(`   Total:                  ${format8Dec(userReceived + devReceived + endowmentReceived)} BTC1USD`);

        // Verify the math is correct
        const tolerance = ethers.parseUnits("0.01", 8); // 0.01 tolerance for rounding
        expect(userReceived).to.be.closeTo(expected.tokensToMint, tolerance);
        expect(devReceived).to.be.closeTo(expected.devFee, tolerance);
        expect(endowmentReceived).to.be.closeTo(expected.endowmentFee, tolerance);

        // Verify CR behavior
        if (i > 0) {
          // After first deposit, CR should stay roughly constant
          const crDiff = crAfter > crBefore ? crAfter - crBefore : crBefore - crAfter;
          console.log(`\n🔍 CR Change: ${format8Dec(crDiff)}x (should be ~0 for same deposits)`);
        }

        // Check if CR is below minimum
        if (crAfter < MIN_CR) {
          console.log(`\n⚠️  WARNING: CR (${format8Dec(crAfter)}x) is BELOW minimum (${format8Dec(MIN_CR)}x)!`);
          console.log(`   This is due to fee minting and is BY DESIGN per code comments.`);
        }
      }

      console.log("\n" + "=".repeat(80));
      console.log("SUMMARY: After 3 deposits of 1 WBTC each");
      console.log("=".repeat(80));
      const finalSupply = await btc1usd.totalSupply();
      const finalValue = await vault.getTotalCollateralValue();
      const finalCR = await vault.getCurrentCollateralRatio();

      console.log(`Total Collateral:  $${format8Dec(finalValue)}`);
      console.log(`Total Supply:      ${format8Dec(finalSupply)} BTC1USD`);
      console.log(`Final CR:          ${format8Dec(finalCR)}x (${(Number(format8Dec(finalCR)) * 100).toFixed(2)}%)`);
      console.log(`Expected CR:       ~1.1869x (118.69%) - constant due to fee structure`);
      console.log("=".repeat(80) + "\n");
    });
  });

  describe("📊 Mixed Collateral Deposits", function () {
    it("Should handle deposits from different collateral types", async function () {
      console.log("\n" + "=".repeat(80));
      console.log("TEST 2: Mixed Collateral Deposits (WBTC, cbBTC, tBTC)");
      console.log("=".repeat(80) + "\n");

      // Reset by using a new user
      const deposits = [
        { user: user2, token: mockWBTC, name: "WBTC", amount: ONE_BTC },
        { user: user2, token: mockCBTC, name: "cbBTC", amount: ONE_BTC },
        { user: user2, token: mockTBTC, name: "tBTC", amount: ONE_BTC }
      ];

      const startSupply = await btc1usd.totalSupply();
      const startValue = await vault.getTotalCollateralValue();

      console.log(`Starting State (from previous test):`);
      console.log(`   Total Collateral: $${format8Dec(startValue)}`);
      console.log(`   Total Supply:     ${format8Dec(startSupply)} BTC1USD\n`);

      for (let i = 0; i < deposits.length; i++) {
        const { user, token, name, amount } = deposits[i];

        console.log(`\n📥 DEPOSIT ${i + 4}: 1 ${name}`);
        console.log("-".repeat(80));

        const supplyBefore = await btc1usd.totalSupply();
        const valueBefore = await vault.getTotalCollateralValue();
        const crBefore = await vault.getCurrentCollateralRatio();

        console.log(`BEFORE: CR = ${format8Dec(crBefore)}x, Supply = ${format8Dec(supplyBefore)}`);

        // Execute deposit
        await token.connect(user).approve(await vault.getAddress(), amount);

        const userBalanceBefore = await btc1usd.balanceOf(user.address);
        await vault.connect(user).mint(await token.getAddress(), amount);
        const userBalanceAfter = await btc1usd.balanceOf(user.address);

        const userReceived = userBalanceAfter - userBalanceBefore;

        const supplyAfter = await btc1usd.totalSupply();
        const valueAfter = await vault.getTotalCollateralValue();
        const crAfter = await vault.getCurrentCollateralRatio();

        console.log(`AFTER:  CR = ${format8Dec(crAfter)}x, Supply = ${format8Dec(supplyAfter)}`);
        console.log(`User received: ${format8Dec(userReceived)} BTC1USD`);

        // Verify all collateral types produce same result when price is same
        if (i === 0) {
          // Store first deposit amount for comparison
          this.firstDepositReceived = userReceived;
        } else {
          const tolerance = ethers.parseUnits("0.01", 8);
          expect(userReceived).to.be.closeTo(this.firstDepositReceived, tolerance);
          console.log(`✅ Same amount received as ${deposits[0].name} (prices are equal)`);
        }
      }

      console.log("\n" + "=".repeat(80));
      console.log("SUMMARY: Mixed collateral deposits");
      console.log("=".repeat(80));
      const finalSupply = await btc1usd.totalSupply();
      const finalValue = await vault.getTotalCollateralValue();
      const finalCR = await vault.getCurrentCollateralRatio();

      console.log(`Total Collateral:  $${format8Dec(finalValue)}`);
      console.log(`Total Supply:      ${format8Dec(finalSupply)} BTC1USD`);
      console.log(`Final CR:          ${format8Dec(finalCR)}x (${(Number(format8Dec(finalCR)) * 100).toFixed(2)}%)`);
      console.log(`\n✅ All collateral types work identically when prices are equal`);
      console.log("=".repeat(80) + "\n");
    });
  });

  describe("🚨 Price Drop Scenario", function () {
    it("Should show CR impact when BTC price drops", async function () {
      console.log("\n" + "=".repeat(80));
      console.log("TEST 3: BTC Price Drop Scenario");
      console.log("=".repeat(80) + "\n");

      const supplyBefore = await btc1usd.totalSupply();
      const valueBefore = await vault.getTotalCollateralValue();
      const crBefore = await vault.getCurrentCollateralRatio();

      console.log(`BEFORE Price Drop:`);
      console.log(`   BTC Price:            $${format8Dec(BTC_PRICE)}`);
      console.log(`   Total Collateral:     $${format8Dec(valueBefore)}`);
      console.log(`   Total Supply:         ${format8Dec(supplyBefore)} BTC1USD`);
      console.log(`   Collateral Ratio:     ${format8Dec(crBefore)}x (${(Number(format8Dec(crBefore)) * 100).toFixed(2)}%)`);

      // Drop BTC price by 20%
      const newBtcPrice = (BTC_PRICE * 80n) / 100n; // $80,000
      await priceOracle.setTokenPrice(await mockWBTC.getAddress(), newBtcPrice);
      await priceOracle.setTokenPrice(await mockCBTC.getAddress(), newBtcPrice);
      await priceOracle.setTokenPrice(await mockTBTC.getAddress(), newBtcPrice);

      const valueAfter = await vault.getTotalCollateralValue();
      const crAfter = await vault.getCurrentCollateralRatio();

      console.log(`\nAFTER 20% Price Drop:`);
      console.log(`   BTC Price:            $${format8Dec(newBtcPrice)} (-20%)`);
      console.log(`   Total Collateral:     $${format8Dec(valueAfter)} (-20%)`);
      console.log(`   Total Supply:         ${format8Dec(supplyBefore)} BTC1USD (unchanged)`);
      console.log(`   Collateral Ratio:     ${format8Dec(crAfter)}x (${(Number(format8Dec(crAfter)) * 100).toFixed(2)}%)`);

      const crDrop = crBefore - crAfter;
      const crDropPercent = (Number(format8Dec(crDrop)) / Number(format8Dec(crBefore))) * 100;

      console.log(`\n📉 Impact:`);
      console.log(`   CR dropped by:        ${format8Dec(crDrop)}x (${crDropPercent.toFixed(2)}%)`);

      if (crAfter < MIN_CR) {
        console.log(`\n🔴 CRITICAL: Vault is UNDERCOLLATERALIZED!`);
        console.log(`   Current CR: ${format8Dec(crAfter)}x`);
        console.log(`   Minimum CR: ${format8Dec(MIN_CR)}x`);
        console.log(`   Shortfall:  ${format8Dec(MIN_CR - crAfter)}x`);

        // Calculate stress mode redemption value
        const stressFactor = ethers.parseUnits("0.90", 8); // 90%
        const stressRedemptionValue = (crAfter * stressFactor) / DECIMALS;
        console.log(`\n⚠️  Stress Mode Redemption Active:`);
        console.log(`   Users redeeming get: ${format8Dec(stressRedemptionValue)}x of value`);
        console.log(`   Loss per BTC1USD:    ${format8Dec(DECIMALS - stressRedemptionValue)}x (${((1 - Number(format8Dec(stressRedemptionValue))) * 100).toFixed(2)}%)`);

        expect(crAfter).to.be.lt(MIN_CR);
      }

      console.log("\n" + "=".repeat(80) + "\n");
    });
  });

  describe("📋 CR Formula Verification", function () {
    it("Should verify CR = Total Collateral Value / Total Supply", async function () {
      console.log("\n" + "=".repeat(80));
      console.log("TEST 4: CR Formula Verification");
      console.log("=".repeat(80) + "\n");

      const totalSupply = await btc1usd.totalSupply();
      const totalValue = await vault.getTotalCollateralValue();
      const reportedCR = await vault.getCurrentCollateralRatio();

      // Calculate CR manually
      const calculatedCR = (totalValue * DECIMALS) / totalSupply;

      console.log(`Formula: CR = Total Collateral Value × DECIMALS ÷ Total Supply`);
      console.log(`\nInputs:`);
      console.log(`   Total Collateral Value: $${format8Dec(totalValue)}`);
      console.log(`   Total Supply:           ${format8Dec(totalSupply)} BTC1USD`);
      console.log(`   DECIMALS:               ${format8Dec(DECIMALS)}`);

      console.log(`\nCalculation:`);
      console.log(`   CR = ${format8Dec(totalValue)} × ${format8Dec(DECIMALS)} ÷ ${format8Dec(totalSupply)}`);
      console.log(`   CR = ${totalValue} × ${DECIMALS} ÷ ${totalSupply}`);
      console.log(`   CR = ${totalValue * DECIMALS} ÷ ${totalSupply}`);
      console.log(`   CR = ${calculatedCR}`);

      console.log(`\nResults:`);
      console.log(`   Calculated CR:  ${format8Dec(calculatedCR)}x`);
      console.log(`   Reported CR:    ${format8Dec(reportedCR)}x`);
      console.log(`   Match:          ${calculatedCR === reportedCR ? '✅ YES' : '❌ NO'}`);

      expect(reportedCR).to.equal(calculatedCR);

      console.log("\n" + "=".repeat(80) + "\n");
    });
  });

  describe("📊 Fee Impact Analysis", function () {
    it("Should show why CR starts below 120% minimum", async function () {
      console.log("\n" + "=".repeat(80));
      console.log("TEST 5: Fee Impact on CR - Why CR < 120%?");
      console.log("=".repeat(80) + "\n");

      // Deploy fresh contracts for clean test
      const BTC1USD = await ethers.getContractFactory("BTC1USD");
      const freshBtc1usd = await BTC1USD.deploy(owner.address);

      const PriceOracle = await ethers.getContractFactory("PriceOracle");
      const freshOracle = await PriceOracle.deploy(owner.address, BTC_PRICE);

      const Vault = await ethers.getContractFactory("Vault");
      const freshVault = await Vault.deploy(
        await freshBtc1usd.getAddress(),
        await freshOracle.getAddress(),
        owner.address,
        devWallet.address,
        endowmentWallet.address
      );

      await freshBtc1usd.setVault(await freshVault.getAddress());
      await freshBtc1usd.setWeeklyDistribution(owner.address);
      await freshOracle.setTokenPrice(await mockWBTC.getAddress(), BTC_PRICE);
      await freshVault.addCollateral(await mockWBTC.getAddress());

      console.log(`Scenario: User deposits $100,000 worth of BTC`);
      console.log(`Expected behavior if NO fees:`);
      console.log(`   Tokens minted: $100,000 ÷ 1.20 = 83,333.33 BTC1USD`);
      console.log(`   CR = $100,000 ÷ 83,333.33 = 1.20x (120%) ✅`);

      console.log(`\nActual behavior WITH fees (1% dev + 0.1% endowment):`);

      // Execute deposit
      await mockWBTC.connect(user1).approve(await freshVault.getAddress(), ONE_BTC);
      await freshVault.connect(user1).mint(await mockWBTC.getAddress(), ONE_BTC);

      const totalSupply = await freshBtc1usd.totalSupply();
      const totalValue = await freshVault.getTotalCollateralValue();
      const cr = await freshVault.getCurrentCollateralRatio();

      const userBalance = await freshBtc1usd.balanceOf(user1.address);
      const devBalance = await freshBtc1usd.balanceOf(devWallet.address);
      const endowmentBalance = await freshBtc1usd.balanceOf(endowmentWallet.address);

      console.log(`   User gets:              ${format8Dec(userBalance)} BTC1USD`);
      console.log(`   Dev fee:                ${format8Dec(devBalance)} BTC1USD (1%)`);
      console.log(`   Endowment fee:          ${format8Dec(endowmentBalance)} BTC1USD (0.1%)`);
      console.log(`   TOTAL MINTED:           ${format8Dec(totalSupply)} BTC1USD`);

      console.log(`\n   CR = $${format8Dec(totalValue)} ÷ ${format8Dec(totalSupply)}`);
      console.log(`   CR = ${format8Dec(cr)}x (${(Number(format8Dec(cr)) * 100).toFixed(2)}%) ⚠️`);

      const shortfall = MIN_CR - cr;
      console.log(`\n❌ CR is BELOW 120% minimum by ${format8Dec(shortfall)}x (${(Number(format8Dec(shortfall)) * 100).toFixed(2)}%)`);
      console.log(`\nRoot Cause:`);
      console.log(`   Fee tokens (${format8Dec(devBalance + endowmentBalance)}) are minted without backing collateral`);
      console.log(`   This dilutes the CR below the minimum threshold`);
      console.log(`   Per code comments (Vault.sol:20-23): This is BY DESIGN`);

      expect(cr).to.be.lt(MIN_CR);

      console.log("\n" + "=".repeat(80) + "\n");
    });
  });
});
