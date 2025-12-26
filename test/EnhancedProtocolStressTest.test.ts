import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BTC1USDWithPermit,
  VaultUpgradeableWithPermit,
  WeeklyDistributionUpgradeable,
  MerkleDistributorUpgradeable,
  ChainlinkBTCOracleUpgradeable,
  MockChainlinkOracle,
  MockWBTC,
  MockERC20
} from "../typechain-types";
import { MerkleTree } from "merkletreejs";
import { keccak256, solidityPackedKeccak256 } from "ethers";

const { ethers } = hre;

describe("Enhanced Protocol Stress Testing", function () {
  let btc1usd: BTC1USDWithPermit;
  let vault: VaultUpgradeableWithPermit;
  let weeklyDistribution: WeeklyDistributionUpgradeable;
  let merkleDistributor: MerkleDistributorUpgradeable;
  let oracle: MockChainlinkOracle;
  let mockWBTC: MockWBTC;
  let mockCBTC: MockERC20;
  let mockTBTC: MockERC20;

  let admin: SignerWithAddress;
  let devWallet: SignerWithAddress;
  let endowmentWallet: SignerWithAddress;
  let merklFeeCollector: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;
  let user6: SignerWithAddress;
  let user7: SignerWithAddress;
  let user8: SignerWithAddress;
  let user9: SignerWithAddress;
  let user10: SignerWithAddress;

  const INITIAL_BTC_PRICE = ethers.parseUnits("50000", 8); // $50,000
  const LARGE_MINT_AMOUNT = ethers.parseUnits("100", 8); // 100 WBTC
  const MEDIUM_MINT_AMOUNT = ethers.parseUnits("10", 8); // 10 WBTC
  const SMALL_MINT_AMOUNT = ethers.parseUnits("1", 8); // 1 WBTC
  const TINY_MINT_AMOUNT = ethers.parseUnits("0.001", 8); // 0.001 WBTC

  beforeEach(async function () {
    [admin, devWallet, endowmentWallet, merklFeeCollector, user1, user2, user3, user4, user5, user6, user7, user8, user9, user10] = await ethers.getSigners();

    // Deploy Mock Tokens
    const MockWBTCFactory = await ethers.getContractFactory("MockWBTC");
    mockWBTC = await MockWBTCFactory.deploy(admin.address); // Using proper constructor for MockWBTC
    await mockWBTC.waitForDeployment();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockCBTC = await MockERC20Factory.deploy("Coinbase Wrapped BTC", "cbBTC", 8);
    await mockCBTC.waitForDeployment();
    
    mockTBTC = await MockERC20Factory.deploy("Threshold BTC", "tBTC", 8);
    await mockTBTC.waitForDeployment();

    // Deploy MockChainlinkOracle for testing (allows price manipulation)
    const MockChainlinkOracleFactory = await ethers.getContractFactory("MockChainlinkOracle");
    oracle = await MockChainlinkOracleFactory.deploy(8, INITIAL_BTC_PRICE); // 8 decimals, initial price
    await oracle.waitForDeployment();

    // Deploy BTC1USD
    const BTC1USDFactory = await ethers.getContractFactory("BTC1USDWithPermit");
    btc1usd = await BTC1USDFactory.deploy(
      admin.address,
      ethers.ZeroAddress,
      ethers.ZeroAddress
    );
    await btc1usd.waitForDeployment();

    // Deploy Vault Implementation and Proxy
    const VaultUpgradeableWithPermitFactory = await ethers.getContractFactory("VaultUpgradeableWithPermit");
    const vaultImpl = await VaultUpgradeableWithPermitFactory.deploy();
    await vaultImpl.waitForDeployment();
    
    const UpgradeableProxyFactory = await ethers.getContractFactory("UpgradeableProxy");
    const vaultProxy = await UpgradeableProxyFactory.deploy(
      await vaultImpl.getAddress(),
      ethers.ZeroAddress // No proxy admin for testing
    );
    await vaultProxy.waitForDeployment();
    
    vault = VaultUpgradeableWithPermitFactory.attach(await vaultProxy.getAddress()) as VaultUpgradeableWithPermit;
    // Initialize the vault
    await vault.initialize(
      admin.address,
      await btc1usd.getAddress(),
      await oracle.getAddress(),
      devWallet.address,
      endowmentWallet.address
    );

    // Deploy MerkleDistributor Implementation and Proxy
    const MerkleDistributorUpgradeableFactory = await ethers.getContractFactory("MerkleDistributorUpgradeable");
    const merkleImpl = await MerkleDistributorUpgradeableFactory.deploy();
    await merkleImpl.waitForDeployment();
    
    const merkleProxy = await UpgradeableProxyFactory.deploy(
      await merkleImpl.getAddress(),
      ethers.ZeroAddress // No proxy admin for testing
    );
    await merkleProxy.waitForDeployment();
    
    merkleDistributor = MerkleDistributorUpgradeableFactory.attach(await merkleProxy.getAddress()) as MerkleDistributorUpgradeable;
    // Initialize the merkle distributor
    await merkleDistributor.initialize(
      admin.address,
      await btc1usd.getAddress(),
      ethers.ZeroAddress // Will be set after weekly distribution deployment
    );

    // Deploy WeeklyDistribution Implementation and Proxy
    const WeeklyDistributionUpgradeableFactory = await ethers.getContractFactory("WeeklyDistributionUpgradeable");
    const weeklyImpl = await WeeklyDistributionUpgradeableFactory.deploy();
    await weeklyImpl.waitForDeployment();
    
    const weeklyProxy = await UpgradeableProxyFactory.deploy(
      await weeklyImpl.getAddress(),
      ethers.ZeroAddress // No proxy admin for testing
    );
    await weeklyProxy.waitForDeployment();
    
    weeklyDistribution = WeeklyDistributionUpgradeableFactory.attach(await weeklyProxy.getAddress()) as WeeklyDistributionUpgradeable;
    // Initialize the weekly distribution
    await weeklyDistribution.initialize(
      admin.address,
      await btc1usd.getAddress(),
      await vault.getAddress(),
      devWallet.address,
      endowmentWallet.address,
      merklFeeCollector.address,
      await merkleDistributor.getAddress()
    );

    // Update MerkleDistributor to use WeeklyDistribution
    await merkleDistributor.setWeeklyDistribution(await weeklyDistribution.getAddress());

    // Set up vault with multiple collateral tokens
    await vault.addCollateral(await mockWBTC.getAddress());
    await vault.addCollateral(await mockCBTC.getAddress());
    await vault.addCollateral(await mockTBTC.getAddress());
    
    // Update BTC1USD to use vault and weeklyDistribution (using one-time setters)
    await btc1usd.setVault(await vault.getAddress());
    await btc1usd.setWeeklyDistribution(await weeklyDistribution.getAddress());

    // Mint WBTC to users for testing
    const users = [user1, user2, user3, user4, user5, user6, user7, user8, user9, user10];
    const amounts = [
      LARGE_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, SMALL_MINT_AMOUNT, SMALL_MINT_AMOUNT,
      LARGE_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, SMALL_MINT_AMOUNT, SMALL_MINT_AMOUNT
    ];
    
    for (let i = 0; i < users.length; i++) {
      await mockWBTC.mint(users[i].address, amounts[i]);
      await mockCBTC.mint(users[i].address, amounts[i]);
      await mockTBTC.mint(users[i].address, amounts[i]);
    }
  });

  describe("Enhanced Stress Test - High Volume Operations", function () {
    it("Should handle extreme volume mint and redeem operations", async function () {
      this.timeout(120000); // 2 minutes timeout

      // Users deposit collateral and mint BTC1USD with different collateral types
      const users = [user1, user2, user3, user4, user5, user6, user7, user8, user9, user10];
      const amounts = [
        LARGE_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, SMALL_MINT_AMOUNT, SMALL_MINT_AMOUNT,
        LARGE_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, SMALL_MINT_AMOUNT, SMALL_MINT_AMOUNT
      ];
      
      // Approve and deposit collateral for all users using different collateral types
      for (let i = 0; i < users.length; i++) {
        const collateralToken = i % 3 === 0 ? mockWBTC : i % 3 === 1 ? mockCBTC : mockTBTC;
        
        await collateralToken.connect(users[i]).approve(await vault.getAddress(), amounts[i]);
        await vault.connect(users[i]).mintWithPermit2(
          await collateralToken.getAddress(),
          amounts[i],
          {
            permitted: {
              token: await collateralToken.getAddress(),
              amount: amounts[i]
            },
            nonce: 0,
            deadline: ethers.MaxUint256
          },
          "0x"
        );
      }

      // Verify initial state
      const totalSupplyBefore = await btc1usd.totalSupply();
      const collateralRatioBefore = await vault.getCurrentCollateralRatio();
      console.log("Total supply before extreme stress test:", ethers.formatUnits(totalSupplyBefore, 8));
      console.log("Collateral ratio before extreme stress test:", ethers.formatUnits(collateralRatioBefore, 8));

      // Execute multiple mint and redeem operations in rapid succession
      for (let round = 0; round < 10; round++) {
        console.log(`Extreme stress test round ${round + 1}/10`);
        
        // Parallel mint and redeem operations
        const promises = [];
        
        // Some users redeem a portion of their tokens
        for (let i = 0; i < 5; i++) {
          const user = users[i];
          const balance = await btc1usd.balanceOf(user.address);
          if (balance > ethers.parseUnits("1", 8)) { // Only redeem if they have more than 1 token
            const redeemAmount = balance / 4n; // Redeem 25% of balance
            await btc1usd.connect(user).approve(await vault.getAddress(), redeemAmount);
            await vault.connect(user).redeemWithPermit(
              redeemAmount,
              await mockWBTC.getAddress(), // Always redeem to WBTC
              ethers.MaxUint256,
              0, "0x0", "0x0"
            );
          }
        }

        // Some users mint more tokens
        for (let i = 5; i < users.length; i++) {
          const user = users[i];
          const wbtcBalance = await mockWBTC.balanceOf(user.address);
          if (wbtcBalance > ethers.parseUnits("0.1", 8)) { // If they have more than 0.1 WBTC
            const mintAmount = wbtcBalance / 2n; // Mint with 50% of remaining WBTC
            await mockWBTC.connect(user).approve(await vault.getAddress(), mintAmount);
            await vault.connect(user).mintWithPermit2(
              await mockWBTC.getAddress(),
              mintAmount,
              {
                permitted: {
                  token: await mockWBTC.getAddress(),
                  amount: mintAmount
                },
                nonce: 0,
                deadline: ethers.MaxUint256
              },
              "0x"
            );
          }
        }
      }

      // Verify final state
      const totalSupplyAfter = await btc1usd.totalSupply();
      const collateralRatioAfter = await vault.getCurrentCollateralRatio();
      console.log("Total supply after extreme stress test:", ethers.formatUnits(totalSupplyAfter, 8));
      console.log("Collateral ratio after extreme stress test:", ethers.formatUnits(collateralRatioAfter, 8));

      // Protocol should still be healthy
      expect(await vault.isHealthy()).to.be.true;
      expect(collateralRatioAfter).to.be.greaterThanOrEqual(ethers.parseUnits("1.20", 8)); // MIN_COLLATERAL_RATIO
    });

    it("Should handle extreme price volatility scenarios", async function () {
      this.timeout(60000);

      // Mint tokens to have substantial supply
      await mockWBTC.connect(user1).approve(await vault.getAddress(), LARGE_MINT_AMOUNT);
      await vault.connect(user1).mintWithPermit2(
        await mockWBTC.getAddress(),
        LARGE_MINT_AMOUNT,
        {
          permitted: {
            token: await mockWBTC.getAddress(),
            amount: LARGE_MINT_AMOUNT
          },
          nonce: 0,
          deadline: ethers.MaxUint256
        },
        "0x"
      );

      // Artificially change the BTC price multiple times
      const priceChanges = [ethers.parseUnits("25000", 8), ethers.parseUnits("75000", 8), ethers.parseUnits("30000", 8), ethers.parseUnits("100000", 8)];
      
      for (let i = 0; i < priceChanges.length; i++) {
        console.log(`Testing with BTC price: $${ethers.formatUnits(priceChanges[i], 8)}`);
        await oracle["updatePrice(uint256)"](priceChanges[i]);
        
        // Try to perform operations at different price points
        const userBalance = await btc1usd.balanceOf(user1.address);
        if (userBalance > ethers.parseUnits("1", 8)) {
          await btc1usd.connect(user1).approve(await vault.getAddress(), userBalance / 10n);
          await expect(
            vault.connect(user1).redeemWithPermit(
              userBalance / 10n,
              await mockWBTC.getAddress(),
              ethers.MaxUint256,
              0, "0x0", "0x0"
            )
          ).to.not.be.reverted;
        }
      }

      // Final check with original price
      await oracle.setPrice(INITIAL_BTC_PRICE);
      expect(await vault.isHealthy()).to.be.true;
    });

    it("Should handle maximum distribution limits with high token supply", async function () {
      this.timeout(60000);

      // Create very high token supply by minting large amounts
      const users = [user1, user2, user3, user4, user5];
      for (const user of users) {
        await mockWBTC.mint(user.address, ethers.parseUnits("1000", 8));
        await mockWBTC.connect(user).approve(await vault.getAddress(), ethers.parseUnits("1000", 8));
        await vault.connect(user).mintWithPermit2(
          await mockWBTC.getAddress(),
          ethers.parseUnits("1000", 8),
          {
            permitted: {
              token: await mockWBTC.getAddress(),
              amount: ethers.parseUnits("1000", 8)
            },
            nonce: 0,
            deadline: ethers.MaxUint256
          },
          "0x"
        );
      }

      // Verify high supply
      const totalSupply = await btc1usd.totalSupply();
      console.log("High supply created:", ethers.formatUnits(totalSupply, 8));
      expect(totalSupply).to.be.greaterThan(ethers.parseUnits("4000", 8)); // More than 4000 tokens

      // Execute distribution after time passes
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethers.provider.send("evm_mine");

      // This should work even with very large amounts
      await expect(weeklyDistribution.executeDistribution())
        .to.emit(weeklyDistribution, "WeeklyDistributionExecuted");

      // Verify the distribution was processed correctly
      const distributionCount = await weeklyDistribution.distributionCount();
      expect(distributionCount).to.equal(1);
    });

    it("Should handle maximum merkle claim operations", async function () {
      this.timeout(120000);

      // Create many users for stress testing
      const manyUsers = await ethers.getSigners();
      const testUsers = manyUsers.slice(0, 20); // Use first 20 users
      
      // Mint tokens to users to create distribution
      for (let i = 0; i < testUsers.length; i++) {
        await mockWBTC.mint(testUsers[i].address, MEDIUM_MINT_AMOUNT);
        await mockWBTC.connect(testUsers[i]).approve(await vault.getAddress(), MEDIUM_MINT_AMOUNT);
        await vault.connect(testUsers[i]).mintWithPermit2(
          await mockWBTC.getAddress(),
          MEDIUM_MINT_AMOUNT,
          {
            permitted: {
              token: await mockWBTC.getAddress(),
              amount: MEDIUM_MINT_AMOUNT
            },
            nonce: 0,
            deadline: ethers.MaxUint256
          },
          "0x"
        );
      }

      // Execute a distribution
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethers.provider.send("evm_mine");
      await weeklyDistribution.executeDistribution();

      // Generate merkle tree for all users with large amounts
      const claims = [];
      for (let i = 0; i < testUsers.length; i++) {
        const balance = await btc1usd.balanceOf(testUsers[i].address);
        const rewardPerToken = await weeklyDistribution.getRewardPerToken(await vault.getCurrentCollateralRatio());
        const amount = (balance * rewardPerToken) / ethers.parseUnits("1", 8);
        
        claims.push({
          index: i,
          account: testUsers[i].address,
          amount: amount
        });
      }

      const elements = claims.map((claim) =>
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      const merkleTree = new MerkleTree(elements, keccak256, { sortPairs: true });
      const merkleRoot = merkleTree.getHexRoot();
      const totalRewards = claims.reduce((sum, claim) => sum + claim.amount, 0n);

      // Set merkle root
      await merkleDistributor.startNewDistributionWithFinalization(merkleRoot, totalRewards);

      // Execute claims for all users in batches to avoid gas limits
      const batchSize = 5;
      for (let i = 0; i < testUsers.length; i += batchSize) {
        const batch = testUsers.slice(i, i + batchSize);
        const batchPromises = [];
        
        for (let j = 0; j < batch.length; j++) {
          const userIndex = i + j;
          if (userIndex < testUsers.length) {
            const proof = merkleTree.getHexProof(elements[userIndex]);
            const user = testUsers[userIndex];
            const claim = claims[userIndex];
            
            batchPromises.push(
              merkleDistributor.connect(user).claim(1, claim.index, claim.account, claim.amount, proof)
            );
          }
        }
        
        await Promise.all(batchPromises);
      }

      // Verify all claims were processed
      const finalDistribution = await merkleDistributor.distributions(1);
      expect(finalDistribution.totalClaimed).to.equal(totalRewards);
    });
  });

  describe("Enhanced Stress Test - Oracle Manipulation Scenarios", function () {
    it("Should handle rapid oracle price changes", async function () {
      this.timeout(60000);

      // Mint some tokens first
      await mockWBTC.connect(user1).approve(await vault.getAddress(), MEDIUM_MINT_AMOUNT);
      await vault.connect(user1).mintWithPermit2(
        await mockWBTC.getAddress(),
        MEDIUM_MINT_AMOUNT,
        {
          permitted: {
            token: await mockWBTC.getAddress(),
            amount: MEDIUM_MINT_AMOUNT
          },
          nonce: 0,
          deadline: ethers.MaxUint256
        },
        "0x"
      );

      // Rapidly change oracle prices
      const rapidChanges = [
        ethers.parseUnits("45000", 8),
        ethers.parseUnits("55000", 8),
        ethers.parseUnits("40000", 8),
        ethers.parseUnits("60000", 8),
        ethers.parseUnits("35000", 8),
        ethers.parseUnits("65000", 8)
      ];

      for (const price of rapidChanges) {
        await oracle["updatePrice(uint256)"](price);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to simulate real conditions
      }

      // Verify protocol is still healthy
      expect(await vault.isHealthy()).to.be.true;
      
      // Should still be able to perform operations
      const userBalance = await btc1usd.balanceOf(user1.address);
      if (userBalance > ethers.parseUnits("1", 8)) {
        await btc1usd.connect(user1).approve(await vault.getAddress(), userBalance / 2n);
        await expect(
          vault.connect(user1).redeemWithPermit(
            userBalance / 2n,
            await mockWBTC.getAddress(),
            ethers.MaxUint256,
            0, "0x0", "0x0"
          )
        ).to.not.be.reverted;
      }
    });

    it("Should handle extreme oracle price movements", async function () {
      this.timeout(60000);

      // Mint tokens to have a substantial position
      await mockWBTC.mint(admin.address, ethers.parseUnits("1000", 8));
      await mockWBTC.approve(await vault.getAddress(), ethers.parseUnits("1000", 8));
      await vault.mintWithPermit2(
        await mockWBTC.getAddress(),
        ethers.parseUnits("1000", 8),
        {
          permitted: {
            token: await mockWBTC.getAddress(),
            amount: ethers.parseUnits("1000", 8)
          },
          nonce: 0,
          deadline: ethers.MaxUint256
        },
        "0x"
      );

      // Test with extremely high price (1M USD per BTC)
      await oracle["updatePrice(uint256)"](ethers.parseUnits("1000000", 8));
      expect(await vault.isHealthy()).to.be.true;

      // Test with extremely low price (1 USD per BTC)
      await oracle["updatePrice(uint256)"](ethers.parseUnits("1", 8));
      expect(await vault.isHealthy()).to.be.false; // Should be unhealthy at this point

      // Return to normal price
      await oracle.setPrice(INITIAL_BTC_PRICE);
      expect(await vault.isHealthy()).to.be.true;
    });
    
    it("Should handle oracle price oscillation attacks", async function () {
      this.timeout(60000);
      
      // Mint a substantial position
      await mockWBTC.mint(user1.address, ethers.parseUnits("100", 8));
      await mockWBTC.connect(user1).approve(await vault.getAddress(), ethers.parseUnits("100", 8));
      await vault.connect(user1).mintWithPermit2(
        await mockWBTC.getAddress(),
        ethers.parseUnits("100", 8),
        {
          permitted: {
            token: await mockWBTC.getAddress(),
            amount: ethers.parseUnits("100", 8)
          },
          nonce: 0,
          deadline: ethers.MaxUint256
        },
        "0x"
      );
      
      // Simulate an oscillation attack where price rapidly changes back and forth
      const oscillationPrices = [
        ethers.parseUnits("50000", 8),
        ethers.parseUnits("50100", 8),
        ethers.parseUnits("49900", 8),
        ethers.parseUnits("50200", 8),
        ethers.parseUnits("49800", 8),
        ethers.parseUnits("50300", 8),
        ethers.parseUnits("49700", 8),
        ethers.parseUnits("50400", 8),
        ethers.parseUnits("49600", 8),
        ethers.parseUnits("50500", 8)
      ];
      
      // Perform rapid oscillations
      for (const price of oscillationPrices) {
        await oracle["updatePrice(uint256)"](price);
        // Small delay to simulate block time
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Protocol should remain stable
      expect(await vault.isHealthy()).to.be.true;
      
      // Should still be able to perform operations
      const userBalance = await btc1usd.balanceOf(user1.address);
      if (userBalance > ethers.parseUnits("1", 8)) {
        await btc1usd.connect(user1).approve(await vault.getAddress(), userBalance / 4n);
        await expect(
          vault.connect(user1).redeemWithPermit(
            userBalance / 4n,
            await mockWBTC.getAddress(),
            ethers.MaxUint256,
            0, "0x0", "0x0"
          )
        ).to.not.be.reverted;
      }
    });
    
    it("Should handle oracle staleness scenarios", async function () {
      this.timeout(60000);
      
      // Mint tokens first
      await mockWBTC.connect(user1).approve(await vault.getAddress(), MEDIUM_MINT_AMOUNT);
      await vault.connect(user1).mintWithPermit2(
        await mockWBTC.getAddress(),
        MEDIUM_MINT_AMOUNT,
        {
          permitted: {
            token: await mockWBTC.getAddress(),
            amount: MEDIUM_MINT_AMOUNT
          },
          nonce: 0,
          deadline: ethers.MaxUint256
        },
        "0x"
      );
      
      // Advance time significantly to test staleness
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 * 2]); // 2 days
      await ethers.provider.send("evm_mine");
      
      // Check if oracle is stale
      const isStale = await oracle.isStale();
      
      // Depending on the oracle implementation, if it's stale, operations should handle it properly
      const userBalance = await btc1usd.balanceOf(user1.address);
      if (userBalance > ethers.parseUnits("1", 8)) {
        await btc1usd.connect(user1).approve(await vault.getAddress(), userBalance / 2n);
        
        // If oracle is stale, redemption might be restricted
        if (isStale) {
          await expect(
            vault.connect(user1).redeemWithPermit(
              userBalance / 2n,
              await mockWBTC.getAddress(),
              ethers.MaxUint256,
              0, "0x0", "0x0"
            )
          ).to.be.reverted;
        } else {
          await expect(
            vault.connect(user1).redeemWithPermit(
              userBalance / 2n,
              await mockWBTC.getAddress(),
              ethers.MaxUint256,
              0, "0x0", "0x0"
            )
          ).to.not.be.reverted;
        }
      }
    });
  });

  describe("Enhanced Stress Test - Security Edge Cases", function () {
    it("Should handle maximum integer values", async function () {
      this.timeout(60000);

      // Test with maximum possible values to check for overflow
      await mockWBTC.mint(user1.address, ethers.MaxUint256);
      
      // Try to mint with maximum values (this should fail gracefully)
      await mockWBTC.connect(user1).approve(await vault.getAddress(), ethers.MaxUint256);
      
      await expect(
        vault.connect(user1).mintWithPermit2(
          await mockWBTC.getAddress(),
          ethers.MaxUint256,
          {
            permitted: {
              token: await mockWBTC.getAddress(),
              amount: ethers.MaxUint256
            },
            nonce: 0,
            deadline: ethers.MaxUint256
          },
          "0x"
        )
      ).to.be.reverted; // Should revert due to overflow protection
    });

    it("Should handle multiple rapid state changes", async function () {
      this.timeout(60000);

      // Rapidly change contract states
      await weeklyDistribution.pause();
      await weeklyDistribution.unpause();
      await weeklyDistribution.pause();
      await weeklyDistribution.unpause();
      await weeklyDistribution.pause();
      await weeklyDistribution.unpause();

      // Execute distribution after rapid state changes
      await mockWBTC.connect(user1).approve(await vault.getAddress(), MEDIUM_MINT_AMOUNT);
      await vault.connect(user1).mintWithPermit2(
        await mockWBTC.getAddress(),
        MEDIUM_MINT_AMOUNT,
        {
          permitted: {
            token: await mockWBTC.getAddress(),
            amount: MEDIUM_MINT_AMOUNT
          },
          nonce: 0,
          deadline: ethers.MaxUint256
        },
        "0x"
      );

      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethers.provider.send("evm_mine");

      await expect(weeklyDistribution.executeDistribution())
        .to.emit(weeklyDistribution, "WeeklyDistributionExecuted");
    });

    it("Should handle zero address and edge value inputs", async function () {
      this.timeout(60000);

      // Test various zero and edge cases
      await expect(
        vault.connect(user1).mintWithPermit2(
          await mockWBTC.getAddress(),
          0,
          {
            permitted: {
              token: await mockWBTC.getAddress(),
              amount: 0
            },
            nonce: 0,
            deadline: ethers.MaxUint256
          },
          "0x"
        )
      ).to.be.reverted; // Should fail when minting 0 amount

      // Test with tiny amounts
      await mockWBTC.mint(user1.address, TINY_MINT_AMOUNT);
      await mockWBTC.connect(user1).approve(await vault.getAddress(), TINY_MINT_AMOUNT);
      
      await expect(
        vault.connect(user1).mintWithPermit2(
          await mockWBTC.getAddress(),
          TINY_MINT_AMOUNT,
          {
            permitted: {
              token: await mockWBTC.getAddress(),
              amount: TINY_MINT_AMOUNT
            },
            nonce: 0,
            deadline: ethers.MaxUint256
          },
          "0x"
        )
      ).to.not.be.reverted;
    });
  });
});