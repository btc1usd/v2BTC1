import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BTC1USD,
  Vault,
  WeeklyDistribution,
  MerkleDistributor,
  PriceOracle,
  MockWBTC
} from "../typechain-types";
import { MerkleTree } from "merkletreejs";
import { keccak256, solidityPackedKeccak256 } from "ethers";

const { ethers } = hre;

describe("WeeklyDistribution + MerkleDistributor Integration", function () {
  let btc1usd: BTC1USD;
  let vault: Vault;
  let weeklyDistribution: WeeklyDistribution;
  let merkleDistributor: MerkleDistributor;
  let priceOracle: PriceOracle;
  let mockWBTC: MockWBTC;
  
  let admin: SignerWithAddress;
  let devWallet: SignerWithAddress;
  let endowmentWallet: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  const INITIAL_BTC_PRICE = ethers.parseUnits("50000", 8); // $50,000
  const MINT_AMOUNT = ethers.parseUnits("1", 8); // 1 WBTC

  beforeEach(async function () {
    [admin, devWallet, endowmentWallet, user1, user2, user3] = await ethers.getSigners();

    // Deploy MockWBTC
    const MockWBTCFactory = await ethers.getContractFactory("MockWBTC");
    mockWBTC = await MockWBTCFactory.deploy();
    await mockWBTC.waitForDeployment();

    // Deploy PriceOracle
    const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracleFactory.deploy(INITIAL_BTC_PRICE);
    await priceOracle.waitForDeployment();

    // Deploy BTC1USD
    const BTC1USDFactory = await ethers.getContractFactory("BTC1USD");
    btc1usd = await BTC1USDFactory.deploy(
      admin.address,
      "BTC1USD",
      "BTC1USD"
    );
    await btc1usd.waitForDeployment();

    // Deploy Vault
    const VaultFactory = await ethers.getContractFactory("Vault");
    vault = await VaultFactory.deploy(
      await btc1usd.getAddress(),
      await priceOracle.getAddress(),
      admin.address
    );
    await vault.waitForDeployment();

    // Deploy MerkleDistributor
    const MerkleDistributorFactory = await ethers.getContractFactory("MerkleDistributor");
    merkleDistributor = await MerkleDistributorFactory.deploy(
      admin.address, // initialOwner for Ownable
      await btc1usd.getAddress(),
      admin.address,
      ethers.ZeroAddress // Will be set to WeeklyDistribution address
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
    await mockWBTC.mint(user1.address, MINT_AMOUNT);
    await mockWBTC.mint(user2.address, MINT_AMOUNT);
    await mockWBTC.mint(user3.address, MINT_AMOUNT);

    // Users deposit collateral and mint BTC1USD
    for (const user of [user1, user2, user3]) {
      await mockWBTC.connect(user).approve(await vault.getAddress(), MINT_AMOUNT);
      await vault.connect(user).depositCollateral(await mockWBTC.getAddress(), MINT_AMOUNT);
      
      // Mint different amounts for each user
      const mintAmount = user === user1 ? ethers.parseUnits("10", 8) :
                       user === user2 ? ethers.parseUnits("20", 8) :
                       ethers.parseUnits("30", 8);
      await vault.connect(user).mintBTC1USD(mintAmount);
    }
  });

  describe("Complete Distribution Flow", function () {
    it("Should execute full distribution and merkle setup flow", async function () {
      // Check initial state
      expect(await weeklyDistribution.canDistribute()).to.be.true;
      
      const totalSupplyBefore = await btc1usd.totalSupply();
      const collateralRatio = await vault.getCurrentCollateralRatio();
      
      console.log("Total supply before:", ethers.formatUnits(totalSupplyBefore, 8));
      console.log("Collateral ratio:", ethers.formatUnits(collateralRatio, 18));

      // Step 1: Execute weekly distribution
      const distributionTx = await weeklyDistribution.executeDistribution();
      const receipt = await distributionTx.wait();

      // Check that tokens were minted
      const totalSupplyAfter = await btc1usd.totalSupply();
      expect(totalSupplyAfter).to.be.greaterThan(totalSupplyBefore);

      // Check that distribution was recorded
      const distributionCount = await weeklyDistribution.distributionCount();
      expect(distributionCount).to.equal(1);

      const distributionInfo = await weeklyDistribution.getCurrentDistributionInfo();
      console.log("Distribution ID:", distributionInfo.distributionId.toString());
      console.log("Reward per token:", ethers.formatUnits(distributionInfo.rewardPerToken, 18));

      // Step 2: Generate merkle tree for token holders
      const user1Balance = await btc1usd.balanceOf(user1.address);
      const user2Balance = await btc1usd.balanceOf(user2.address);
      const user3Balance = await btc1usd.balanceOf(user3.address);

      console.log("User balances:");
      console.log("User1:", ethers.formatUnits(user1Balance, 8));
      console.log("User2:", ethers.formatUnits(user2Balance, 8));
      console.log("User3:", ethers.formatUnits(user3Balance, 8));

      // Calculate rewards for each user
      const rewardPerToken = distributionInfo.rewardPerToken;
      const claims = [
        {
          index: 0,
          account: user1.address,
          amount: (user1Balance * rewardPerToken) / ethers.parseUnits("1", 18)
        },
        {
          index: 1,
          account: user2.address,
          amount: (user2Balance * rewardPerToken) / ethers.parseUnits("1", 18)
        },
        {
          index: 2,
          account: user3.address,
          amount: (user3Balance * rewardPerToken) / ethers.parseUnits("1", 18)
        }
      ];

      // Generate merkle tree
      const elements = claims.map((claim) =>
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      const merkleTree = new MerkleTree(elements, keccak256, { sortPairs: true });
      const merkleRoot = merkleTree.getHexRoot();

      const totalRewards = claims.reduce((sum, claim) => sum + claim.amount, 0n);
      console.log("Total rewards:", ethers.formatUnits(totalRewards.toString(), 8));
      console.log("Merkle root:", merkleRoot);

      // Step 3: Set merkle root in weekly distribution
      const setRootTx = await weeklyDistribution.setMerkleRoot(merkleRoot, totalRewards);
      await setRootTx.wait();

      // Verify merkle root was set
      expect(await merkleDistributor.merkleRoot()).to.equal(merkleRoot);
      expect(await merkleDistributor.currentDistributionId()).to.equal(1);

      // Step 4: Test claims
      for (let i = 0; i < claims.length; i++) {
        const claim = claims[i];
        const user = [user1, user2, user3][i];
        
        const proof = merkleTree.getHexProof(elements[i]);
        const balanceBefore = await btc1usd.balanceOf(user.address);

        // Verify user can claim
        const canClaim = await merkleDistributor.canClaim(
          1, // distributionId
          claim.index,
          claim.account,
          claim.amount,
          proof
        );
        expect(canClaim).to.be.true;

        // Execute claim
        await expect(
          merkleDistributor.connect(user).claim(claim.index, claim.account, claim.amount, proof)
        ).to.emit(merkleDistributor, "Claimed")
          .withArgs(claim.index, claim.account, claim.amount);

        const balanceAfter = await btc1usd.balanceOf(user.address);
        expect(balanceAfter - balanceBefore).to.equal(claim.amount);
        
        console.log(`User ${i + 1} claimed:`, ethers.formatUnits(claim.amount.toString(), 8));
      }

      // Verify distribution stats
      const stats = await merkleDistributor.getCurrentDistributionStats();
      expect(stats.totalClaimed).to.equal(totalRewards);
      expect(stats.percentageClaimed).to.equal(10000); // 100% in basis points
    });

    it("Should handle partial claims correctly", async function () {
      // Execute distribution
      await weeklyDistribution.executeDistribution();
      
      // Generate simple merkle tree with 2 users
      const claims = [
        { index: 0, account: user1.address, amount: ethers.parseUnits("1", 8) },
        { index: 1, account: user2.address, amount: ethers.parseUnits("2", 8) }
      ];

      const elements = claims.map((claim) =>
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      const merkleTree = new MerkleTree(elements, keccak256, { sortPairs: true });
      const merkleRoot = merkleTree.getHexRoot();
      const totalRewards = ethers.parseUnits("3", 8);

      await weeklyDistribution.setMerkleRoot(merkleRoot, totalRewards);

      // Only user1 claims
      const proof = merkleTree.getHexProof(elements[0]);
      await merkleDistributor.connect(user1).claim(
        claims[0].index,
        claims[0].account,
        claims[0].amount,
        proof
      );

      // Check stats show partial claim
      const stats = await merkleDistributor.getCurrentDistributionStats();
      expect(stats.totalClaimed).to.equal(claims[0].amount);
      expect(stats.percentageClaimed).to.be.lessThan(10000); // Less than 100%

      // Finalize distribution to return unclaimed tokens
      const adminBalanceBefore = await btc1usd.balanceOf(admin.address);
      await merkleDistributor.finalizeCurrentDistribution();
      const adminBalanceAfter = await btc1usd.balanceOf(admin.address);

      const unclaimedAmount = adminBalanceAfter - adminBalanceBefore;
      expect(unclaimedAmount).to.equal(claims[1].amount); // User2's unclaimed amount
    });

    it("Should prevent claims when paused", async function () {
      // Execute distribution and set merkle root
      await weeklyDistribution.executeDistribution();
      
      const claims = [
        { index: 0, account: user1.address, amount: ethers.parseUnits("1", 8) }
      ];

      const elements = claims.map((claim) =>
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      const merkleTree = new MerkleTree(elements, keccak256, { sortPairs: true });
      const merkleRoot = merkleTree.getHexRoot();

      await weeklyDistribution.setMerkleRoot(merkleRoot, ethers.parseUnits("1", 8));

      // Pause the distributor
      await merkleDistributor.pause();

      // Attempt to claim should fail
      const proof = merkleTree.getHexProof(elements[0]);
      await expect(
        merkleDistributor.connect(user1).claim(
          claims[0].index,
          claims[0].account,
          claims[0].amount,
          proof
        )
      ).to.be.revertedWith("MerkleDistributor: contract is paused");

      // Unpause and claim should work
      await merkleDistributor.unpause();
      await expect(
        merkleDistributor.connect(user1).claim(
          claims[0].index,
          claims[0].account,
          claims[0].amount,
          proof
        )
      ).to.emit(merkleDistributor, "Claimed");
    });

    it("Should handle multiple distribution rounds", async function () {
      // First distribution
      await weeklyDistribution.executeDistribution();
      
      const claims1 = [
        { index: 0, account: user1.address, amount: ethers.parseUnits("1", 8) }
      ];

      let elements = claims1.map((claim) =>
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      let merkleTree = new MerkleTree(elements, keccak256, { sortPairs: true });
      let merkleRoot = merkleTree.getHexRoot();

      await weeklyDistribution.setMerkleRoot(merkleRoot, ethers.parseUnits("1", 8));

      // Claim from first distribution
      let proof = merkleTree.getHexProof(elements[0]);
      await merkleDistributor.connect(user1).claim(
        claims1[0].index,
        claims1[0].account,
        claims1[0].amount,
        proof
      );

      expect(await merkleDistributor.currentDistributionId()).to.equal(1);

      // Advance time for next distribution (in real scenario)
      // For testing, we'll just execute another distribution
      await weeklyDistribution.executeDistribution();

      // Second distribution with different amounts
      const claims2 = [
        { index: 0, account: user2.address, amount: ethers.parseUnits("2", 8) }
      ];

      elements = claims2.map((claim) =>
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      merkleTree = new MerkleTree(elements, keccak256, { sortPairs: true });
      merkleRoot = merkleTree.getHexRoot();

      await weeklyDistribution.setMerkleRoot(merkleRoot, ethers.parseUnits("2", 8));

      // Should be distribution 2 now
      expect(await merkleDistributor.currentDistributionId()).to.equal(2);

      // Claim from second distribution
      proof = merkleTree.getHexProof(elements[0]);
      await merkleDistributor.connect(user2).claim(
        claims2[0].index,
        claims2[0].account,
        claims2[0].amount,
        proof
      );

      // Verify total claimed by each user across all distributions
      expect(await merkleDistributor.totalClaimedByUser(user1.address)).to.equal(ethers.parseUnits("1", 8));
      expect(await merkleDistributor.totalClaimedByUser(user2.address)).to.equal(ethers.parseUnits("2", 8));
    });
  });

  describe("Error Handling", function () {
    it("Should revert if merkle root is set without distribution", async function () {
      const dummyRoot = keccak256("0x1234");
      
      await expect(
        weeklyDistribution.setMerkleRoot(dummyRoot, ethers.parseUnits("1", 8))
      ).to.be.revertedWith("WeeklyDistribution: No distribution executed yet");
    });

    it("Should revert if invalid merkle root is provided", async function () {
      await weeklyDistribution.executeDistribution();
      
      await expect(
        weeklyDistribution.setMerkleRoot(ethers.ZeroHash, ethers.parseUnits("1", 8))
      ).to.be.revertedWith("WeeklyDistribution: Invalid merkle root");
    });

    it("Should handle case where no tokens are available for distribution", async function () {
      // Remove all tokens from distributor
      const distributorBalance = await btc1usd.balanceOf(await merkleDistributor.getAddress());
      if (distributorBalance > 0) {
        await merkleDistributor.pause();
        await merkleDistributor.emergencyRecoverTokens(await btc1usd.getAddress(), distributorBalance);
        await merkleDistributor.unpause();
      }

      await weeklyDistribution.executeDistribution();
      
      const claims = [
        { index: 0, account: user1.address, amount: ethers.parseUnits("1", 8) }
      ];

      const elements = claims.map((claim) =>
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      const merkleTree = new MerkleTree(elements, keccak256, { sortPairs: true });
      const merkleRoot = merkleTree.getHexRoot();

      await weeklyDistribution.setMerkleRoot(merkleRoot, ethers.parseUnits("1", 8));

      // Claim should fail due to insufficient tokens
      const proof = merkleTree.getHexProof(elements[0]);
      await expect(
        merkleDistributor.connect(user1).claim(
          claims[0].index,
          claims[0].account,
          claims[0].amount,
          proof
        )
      ).to.be.revertedWith("MerkleDistributor: Transfer failed");
    });
  });

  describe("Fee Distribution", function () {
    it("Should correctly distribute fees to different wallets", async function () {
      const devBalanceBefore = await btc1usd.balanceOf(devWallet.address);
      const endowmentBalanceBefore = await btc1usd.balanceOf(endowmentWallet.address);
      const distributorBalanceBefore = await btc1usd.balanceOf(await merkleDistributor.getAddress());

      await weeklyDistribution.executeDistribution();

      const devBalanceAfter = await btc1usd.balanceOf(devWallet.address);
      const endowmentBalanceAfter = await btc1usd.balanceOf(endowmentWallet.address);
      const distributorBalanceAfter = await btc1usd.balanceOf(await merkleDistributor.getAddress());

      // Check that fees were distributed
      expect(devBalanceAfter).to.be.greaterThan(devBalanceBefore);
      expect(endowmentBalanceAfter).to.be.greaterThan(endowmentBalanceBefore);
      expect(distributorBalanceAfter).to.be.greaterThan(distributorBalanceBefore);

      console.log("Dev fee received:", ethers.formatUnits(devBalanceAfter - devBalanceBefore, 8));
      console.log("Endowment fee received:", ethers.formatUnits(endowmentBalanceAfter - endowmentBalanceBefore, 8));
      console.log("Distributor tokens received:", ethers.formatUnits(distributorBalanceAfter - distributorBalanceBefore, 8));
    });
  });
});