import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BTC1USDWithPermit,
  VaultUpgradeableWithPermit,
  WeeklyDistributionUpgradeable,
  MerkleDistributorUpgradeable,
  ChainlinkBTCOracleUpgradeable,
  MockWBTC
} from "../typechain-types";
import { MerkleTree } from "merkletreejs";
import { keccak256, solidityPackedKeccak256 } from "ethers";

const { ethers } = hre;

describe("Protocol Stress Testing", function () {
  let btc1usd: BTC1USDWithPermit;
  let vault: Vault;
  let weeklyDistribution: WeeklyDistribution;
  let merkleDistributor: MerkleDistributor;
  let oracle: PriceOracle;
  let mockWBTC: MockWBTC;

  let admin: SignerWithAddress;
  let devWallet: SignerWithAddress;
  let endowmentWallet: SignerWithAddress;
  let merklFeeCollector: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  const INITIAL_BTC_PRICE = ethers.parseUnits("50000", 8); // $50,000
  const LARGE_MINT_AMOUNT = ethers.parseUnits("100", 8); // 100 WBTC
  const MEDIUM_MINT_AMOUNT = ethers.parseUnits("10", 8); // 10 WBTC
  const SMALL_MINT_AMOUNT = ethers.parseUnits("1", 8); // 1 WBTC

  beforeEach(async function () {
    [admin, devWallet, endowmentWallet, merklFeeCollector, user1, user2, user3, user4, user5] = await ethers.getSigners();

    // Deploy MockWBTC
    const MockWBTCFactory = await ethers.getContractFactory("MockWBTC");
    mockWBTC = await MockWBTCFactory.deploy("Mock WBTC", "WBTC", 8);
    await mockWBTC.waitForDeployment();

    // Deploy Mock Oracle
    const OracleFactory = await ethers.getContractFactory("PriceOracle");
    oracle = await OracleFactory.deploy(INITIAL_BTC_PRICE);
    await oracle.waitForDeployment();

    // Deploy BTC1USD
    const BTC1USDFactory = await ethers.getContractFactory("BTC1USDWithPermit");
    btc1usd = await BTC1USDFactory.deploy(
      admin.address,
      ethers.ZeroAddress,
      ethers.ZeroAddress
    );
    await btc1usd.waitForDeployment();

    // Deploy Vault
    const VaultFactory = await ethers.getContractFactory("Vault");
    vault = await VaultFactory.deploy(
      await btc1usd.getAddress(),
      await oracle.getAddress(),
      admin.address
    );
    await vault.waitForDeployment();

    // Deploy MerkleDistributor
    const MerkleDistributorFactory = await ethers.getContractFactory("MerkleDistributor");
    merkleDistributor = await MerkleDistributorFactory.deploy(
      admin.address, // initialOwner for Ownable
      await btc1usd.getAddress(),
      admin.address,
      ethers.ZeroAddress // Will be set after weekly distribution deployment
    );
    await merkleDistributor.waitForDeployment();

    // Deploy WeeklyDistribution
    const WeeklyDistributionFactory = await ethers.getContractFactory("WeeklyDistribution");
    weeklyDistribution = await WeeklyDistributionFactory.deploy(
      await btc1usd.getAddress(),
      await vault.getAddress(),
      admin.address,
      devWallet.address,
      endowmentWallet.address,
      await merkleDistributor.getAddress()
    );
    await weeklyDistribution.waitForDeployment();

    // Update MerkleDistributor to use WeeklyDistribution
    await merkleDistributor.setWeeklyDistribution(await weeklyDistribution.getAddress());

    // Set up vault with WBTC as collateral
    await vault.addCollateralToken(await mockWBTC.getAddress(), ethers.parseUnits("0.7", 18)); // 70% LTV
    await btc1usd.setMinter(await vault.getAddress(), true);
    await btc1usd.setMinter(await weeklyDistribution.getAddress(), true);

    // Mint WBTC to users for testing
    const users = [user1, user2, user3, user4, user5];
    const amounts = [LARGE_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, SMALL_MINT_AMOUNT, SMALL_MINT_AMOUNT];
    
    for (let i = 0; i < users.length; i++) {
      await mockWBTC.mint(users[i].address, amounts[i]);
    }
  });

  describe("Stress Test - High Volume Minting and Redemption", function () {
    it("Should handle multiple large mint and redeem operations simultaneously", async function () {
      // Increase timeout for this heavy test
      this.timeout(60000);

      // Users deposit collateral and mint BTC1USD
      const users = [user1, user2, user3, user4, user5];
      const amounts = [LARGE_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, MEDIUM_MINT_AMOUNT, SMALL_MINT_AMOUNT, SMALL_MINT_AMOUNT];
      
      // Approve and deposit collateral for all users
      for (let i = 0; i < users.length; i++) {
        await mockWBTC.connect(users[i]).approve(await vault.getAddress(), amounts[i]);
        await vault.connect(users[i]).mintWithPermit2(
          await mockWBTC.getAddress(),
          amounts[i],
          {
            permitted: {
              token: await mockWBTC.getAddress(),
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
      console.log("Total supply before stress test:", ethers.formatUnits(totalSupplyBefore, 8));
      console.log("Collateral ratio before stress test:", ethers.formatUnits(collateralRatioBefore, 8));

      // Execute multiple mint and redeem operations in sequence
      for (let round = 0; round < 5; round++) {
        console.log(`Stress test round ${round + 1}/5`);
        
        // Some users redeem a portion of their tokens
        for (let i = 0; i < 3; i++) {
          const user = users[i];
          const balance = await btc1usd.balanceOf(user.address);
          if (balance > ethers.parseUnits("1", 8)) { // Only redeem if they have more than 1 token
            const redeemAmount = balance / 4n; // Redeem 25% of balance
            await btc1usd.connect(user).approve(await vault.getAddress(), redeemAmount);
            await vault.connect(user).redeemWithPermit(
              redeemAmount,
              await mockWBTC.getAddress(),
              ethers.MaxUint256,
              0, "0x0", "0x0"
            );
          }
        }

        // Some users mint more tokens
        for (let i = 2; i < users.length; i++) {
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
      console.log("Total supply after stress test:", ethers.formatUnits(totalSupplyAfter, 8));
      console.log("Collateral ratio after stress test:", ethers.formatUnits(collateralRatioAfter, 8));

      // Protocol should still be healthy
      expect(await vault.isHealthy()).to.be.true;
      expect(collateralRatioAfter).to.be.greaterThanOrEqual(ethers.parseUnits("1.20", 8)); // MIN_COLLATERAL_RATIO
    });

    it("Should handle rapid distribution cycles", async function () {
      this.timeout(60000);

      // Mint tokens to have a substantial supply
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

      // Execute multiple distributions in quick succession
      for (let i = 0; i < 5; i++) {
        // Fast forward time to allow distribution
        await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
        await ethers.provider.send("evm_mine");
        
        // Execute distribution
        await expect(weeklyDistribution.executeDistribution())
          .to.emit(weeklyDistribution, "WeeklyDistributionExecuted");

        // Verify distribution was recorded
        const distributionCount = await weeklyDistribution.distributionCount();
        expect(distributionCount).to.equal(i + 1);
      }

      // Verify multiple distributions were processed
      const finalDistributionCount = await weeklyDistribution.distributionCount();
      expect(finalDistributionCount).to.equal(5);
    });

    it("Should handle high volume merkle claims", async function () {
      this.timeout(60000);

      // Create many users for stress testing
      const manyUsers = await ethers.getSigners();
      const testUsers = manyUsers.slice(0, 10); // Use first 10 users
      
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

      // Generate merkle tree for all users
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
      await weeklyDistribution.updateMerkleRoot(merkleRoot, totalRewards);

      // Execute claims for all users
      for (let i = 0; i < testUsers.length; i++) {
        const proof = merkleTree.getHexProof(elements[i]);
        const user = testUsers[i];
        const claim = claims[i];
        
        await expect(
          merkleDistributor.connect(user).claim(claim.index, claim.account, claim.amount, proof)
        ).to.emit(merkleDistributor, "Claimed");
      }

      // Verify all claims were processed
      const finalDistribution = await merkleDistributor.distributions(1);
      expect(finalDistribution.totalClaimed).to.equal(totalRewards);
    });

    it("Should handle stress with low collateral ratio", async function () {
      this.timeout(60000);

      // Create a scenario with low collateral ratio
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

      // Artificially lower the BTC price to create stress
      await oracle.setPrice(ethers.parseUnits("25000", 8)); // Halve the price

      // Try to redeem - should still work but with stress pricing
      const userBalance = await btc1usd.balanceOf(user1.address);
      const redeemAmount = userBalance / 2n; // Try to redeem half
      
      await btc1usd.connect(user1).approve(await vault.getAddress(), redeemAmount);
      await expect(
        vault.connect(user1).redeemWithPermit(
          redeemAmount,
          await mockWBTC.getAddress(),
          ethers.MaxUint256,
          0, "0x0", "0x0"
        )
      ).to.not.be.reverted;
    });

    it("Should handle maximum distribution limits", async function () {
      this.timeout(60000);

      // Mint a large amount to trigger maximum distribution limits
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

      // Fast forward time and execute distribution
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethers.provider.send("evm_mine");
      
      // This should work even with large amounts
      await expect(weeklyDistribution.executeDistribution())
        .to.emit(weeklyDistribution, "WeeklyDistributionExecuted");

      // Verify the distribution was processed correctly
      const distributionCount = await weeklyDistribution.distributionCount();
      expect(distributionCount).to.equal(1);
    });
  });

  describe("Stress Test - Edge Cases", function () {
    it("Should handle rapid state changes", async function () {
      this.timeout(60000);

      // Rapidly change contract states
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

    it("Should handle concurrent access patterns", async function () {
      this.timeout(60000);

      // Create multiple users with tokens
      const users = [user1, user2, user3];
      for (const user of users) {
        await mockWBTC.mint(user.address, MEDIUM_MINT_AMOUNT);
        await mockWBTC.connect(user).approve(await vault.getAddress(), MEDIUM_MINT_AMOUNT);
        await vault.connect(user).mintWithPermit2(
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

      // Execute distribution
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethers.provider.send("evm_mine");
      await weeklyDistribution.executeDistribution();

      // Generate merkle tree for all users
      const claims = [];
      for (let i = 0; i < users.length; i++) {
        const balance = await btc1usd.balanceOf(users[i].address);
        const rewardPerToken = await weeklyDistribution.getRewardPerToken(await vault.getCurrentCollateralRatio());
        const amount = (balance * rewardPerToken) / ethers.parseUnits("1", 8);
        
        claims.push({
          index: i,
          account: users[i].address,
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

      await weeklyDistribution.updateMerkleRoot(merkleRoot, totalRewards);

      // Simulate concurrent claims using Promise.all
      const claimPromises = [];
      for (let i = 0; i < users.length; i++) {
        const proof = merkleTree.getHexProof(elements[i]);
        const user = users[i];
        const claim = claims[i];
        
        claimPromises.push(
          merkleDistributor.connect(user).claim(claim.index, claim.account, claim.amount, proof)
        );
      }

      // Execute all claims concurrently
      await Promise.all(claimPromises);

      // Verify all claims were processed
      const finalDistribution = await merkleDistributor.distributions(1);
      expect(finalDistribution.totalClaimed).to.equal(totalRewards);
    });
  });
});