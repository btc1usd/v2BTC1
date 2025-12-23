import { expect } from "chai";
import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MerkleDistributor, MockERC20, WeeklyDistribution, BTC1USD } from "../typechain-types";
import { MerkleTree } from "merkletreejs";
import { keccak256, solidityPackedKeccak256 } from "ethers";
const { ethers } = hre;

describe("MerkleDistributor", function () {
  let merkleDistributor: MerkleDistributor;
  let token: MockERC20;
  let admin: SignerWithAddress;
  let weeklyDistribution: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let merkleTree: MerkleTree;
  let merkleRoot: string;
  let claims: any[];

  beforeEach(async function () {
    [admin, weeklyDistribution, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock token
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    token = await MockERC20Factory.deploy("Test Token", "TEST", 8);
    await token.waitForDeployment();

    // Deploy MerkleDistributor
    const MerkleDistributorFactory = await ethers.getContractFactory("MerkleDistributor");
    merkleDistributor = await MerkleDistributorFactory.deploy(
      admin.address, // initialOwner for Ownable
      await token.getAddress(),
      admin.address,
      weeklyDistribution.address
    );
    await merkleDistributor.waitForDeployment();

    // Prepare test claims
    claims = [
      { index: 0, account: user1.address, amount: ethers.parseUnits("10", 8) },
      { index: 1, account: user2.address, amount: ethers.parseUnits("20", 8) },
      { index: 2, account: user3.address, amount: ethers.parseUnits("30", 8) },
    ];

    // Generate merkle tree
    const elements = claims.map((claim) =>
      solidityPackedKeccak256(
        ["uint256", "address", "uint256"],
        [claim.index, claim.account, claim.amount]
      )
    );

    merkleTree = new MerkleTree(elements, keccak256, { sortPairs: true });
    merkleRoot = merkleTree.getHexRoot();

    // Mint tokens to distributor
    const totalAmount = ethers.parseUnits("60", 8); // 10 + 20 + 30
    await token.mint(await merkleDistributor.getAddress(), totalAmount);
  });

  describe("Deployment", function () {
    it("Should set the correct token address", async function () {
      expect(await merkleDistributor.token()).to.equal(await token.getAddress());
    });

    it("Should set the correct admin", async function () {
      expect(await merkleDistributor.admin()).to.equal(admin.address);
    });

    it("Should set the correct weekly distribution address", async function () {
      expect(await merkleDistributor.weeklyDistribution()).to.equal(weeklyDistribution.address);
    });

    it("Should initialize with no merkle root", async function () {
      expect(await merkleDistributor.merkleRoot()).to.equal(ethers.ZeroHash);
    });

    it("Should not be paused initially", async function () {
      expect(await merkleDistributor.paused()).to.be.false;
    });
  });

  describe("Starting New Distribution", function () {
    it("Should allow weekly distribution to start new distribution", async function () {
      const totalTokens = ethers.parseUnits("60", 8);
      
      await expect(
        merkleDistributor.connect(weeklyDistribution).startNewDistribution(merkleRoot, totalTokens)
      )
        .to.emit(merkleDistributor, "MerkleRootUpdated")
        .withArgs(ethers.ZeroHash, merkleRoot, 1)
        .and.to.emit(merkleDistributor, "DistributionStarted")
        .withArgs(1, merkleRoot, totalTokens);

      expect(await merkleDistributor.merkleRoot()).to.equal(merkleRoot);
      expect(await merkleDistributor.currentDistributionId()).to.equal(1);
      expect(await merkleDistributor.totalTokensInCurrentDistribution()).to.equal(totalTokens);
    });

    it("Should revert if not called by weekly distribution", async function () {
      const totalTokens = ethers.parseUnits("60", 8);
      
      await expect(
        merkleDistributor.connect(admin).startNewDistribution(merkleRoot, totalTokens)
      ).to.be.revertedWith("MerkleDistributor: caller is not weekly distribution");
    });

    it("Should finalize previous distribution when starting new one", async function () {
      const totalTokens = ethers.parseUnits("60", 8);
      
      // Start first distribution
      await merkleDistributor.connect(weeklyDistribution).startNewDistribution(merkleRoot, totalTokens);
      
      // Start second distribution (should finalize first)
      const newRoot = keccak256("0x1234");
      await expect(
        merkleDistributor.connect(weeklyDistribution).startNewDistribution(newRoot, totalTokens)
      ).to.emit(merkleDistributor, "DistributionFinalized");
    });
  });

  describe("Claiming Rewards", function () {
    beforeEach(async function () {
      const totalTokens = ethers.parseUnits("60", 8);
      await merkleDistributor.connect(weeklyDistribution).startNewDistribution(merkleRoot, totalTokens);
    });

    it("Should allow valid claims", async function () {
      const claim = claims[0];
      const proof = merkleTree.getHexProof(
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      const balanceBefore = await token.balanceOf(user1.address);
      
      await expect(
        merkleDistributor.connect(user1).claim(claim.index, claim.account, claim.amount, proof)
      )
        .to.emit(merkleDistributor, "Claimed")
        .withArgs(claim.index, claim.account, claim.amount);

      const balanceAfter = await token.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(claim.amount);
      expect(await merkleDistributor.isClaimed(claim.index)).to.be.true;
    });

    it("Should reject invalid proofs", async function () {
      const claim = claims[0];
      const invalidProof = ["0x1234567890123456789012345678901234567890123456789012345678901234"];

      await expect(
        merkleDistributor.connect(user1).claim(claim.index, claim.account, claim.amount, invalidProof)
      ).to.be.revertedWith("MerkleDistributor: Invalid proof");
    });

    it("Should reject double claims", async function () {
      const claim = claims[0];
      const proof = merkleTree.getHexProof(
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      // First claim should succeed
      await merkleDistributor.connect(user1).claim(claim.index, claim.account, claim.amount, proof);

      // Second claim should fail
      await expect(
        merkleDistributor.connect(user1).claim(claim.index, claim.account, claim.amount, proof)
      ).to.be.revertedWith("MerkleDistributor: Drop already claimed");
    });

    it("Should reject claims when paused", async function () {
      await merkleDistributor.connect(admin).pause();

      const claim = claims[0];
      const proof = merkleTree.getHexProof(
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      await expect(
        merkleDistributor.connect(user1).claim(claim.index, claim.account, claim.amount, proof)
      ).to.be.revertedWith("MerkleDistributor: contract is paused");
    });

    it("Should update claimed statistics", async function () {
      const claim = claims[0];
      const proof = merkleTree.getHexProof(
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      await merkleDistributor.connect(user1).claim(claim.index, claim.account, claim.amount, proof);

      expect(await merkleDistributor.totalClaimedInCurrentDistribution()).to.equal(claim.amount);
      expect(await merkleDistributor.totalClaimedByUser(user1.address)).to.equal(claim.amount);
    });
  });

  describe("Merkle Proof Verification", function () {
    it("Should correctly verify valid proofs", async function () {
      const claim = claims[0];
      const proof = merkleTree.getHexProof(
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      const leaf = solidityPackedKeccak256(
        ["uint256", "address", "uint256"],
        [claim.index, claim.account, claim.amount]
      );

      expect(await merkleDistributor.verify(proof, merkleRoot, leaf)).to.be.true;
    });

    it("Should reject invalid proofs", async function () {
      const invalidProof = ["0x1234567890123456789012345678901234567890123456789012345678901234"];
      const leaf = solidityPackedKeccak256(
        ["uint256", "address", "uint256"],
        [0, user1.address, ethers.parseUnits("10", 8)]
      );

      expect(await merkleDistributor.verify(invalidProof, merkleRoot, leaf)).to.be.false;
    });
  });

  describe("Can Claim Check", function () {
    beforeEach(async function () {
      const totalTokens = ethers.parseUnits("60", 8);
      await merkleDistributor.connect(weeklyDistribution).startNewDistribution(merkleRoot, totalTokens);
    });

    it("Should return true for valid unclaimed rewards", async function () {
      const claim = claims[0];
      const proof = merkleTree.getHexProof(
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      expect(
        await merkleDistributor.canClaim(1, claim.index, claim.account, claim.amount, proof)
      ).to.be.true;
    });

    it("Should return false for already claimed rewards", async function () {
      const claim = claims[0];
      const proof = merkleTree.getHexProof(
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      // Claim the reward
      await merkleDistributor.connect(user1).claim(claim.index, claim.account, claim.amount, proof);

      // Check should now return false
      expect(
        await merkleDistributor.canClaim(1, claim.index, claim.account, claim.amount, proof)
      ).to.be.false;
    });

    it("Should return false for invalid distribution ID", async function () {
      const claim = claims[0];
      const proof = merkleTree.getHexProof(
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      expect(
        await merkleDistributor.canClaim(999, claim.index, claim.account, claim.amount, proof)
      ).to.be.false;
    });
  });

  describe("Distribution Statistics", function () {
    beforeEach(async function () {
      const totalTokens = ethers.parseUnits("60", 8);
      await merkleDistributor.connect(weeklyDistribution).startNewDistribution(merkleRoot, totalTokens);
    });

    it("Should return correct distribution stats", async function () {
      const stats = await merkleDistributor.getCurrentDistributionStats();
      
      expect(stats.distributionId).to.equal(1);
      expect(stats.totalTokens).to.equal(ethers.parseUnits("60", 8));
      expect(stats.totalClaimed).to.equal(0);
      expect(stats.percentageClaimed).to.equal(0);
    });

    it("Should update stats after claims", async function () {
      const claim = claims[0];
      const proof = merkleTree.getHexProof(
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      await merkleDistributor.connect(user1).claim(claim.index, claim.account, claim.amount, proof);

      const stats = await merkleDistributor.getCurrentDistributionStats();
      expect(stats.totalClaimed).to.equal(claim.amount);
      expect(stats.percentageClaimed).to.be.greaterThan(0);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to pause/unpause", async function () {
      await merkleDistributor.connect(admin).pause();
      expect(await merkleDistributor.paused()).to.be.true;

      await merkleDistributor.connect(admin).unpause();
      expect(await merkleDistributor.paused()).to.be.false;
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(
        merkleDistributor.connect(user1).pause()
      ).to.be.revertedWith("MerkleDistributor: caller is not admin");
    });

    it("Should allow admin to change admin", async function () {
      await merkleDistributor.connect(admin).setAdmin(user1.address);
      expect(await merkleDistributor.admin()).to.equal(user1.address);
    });

    it("Should allow admin to change weekly distribution address", async function () {
      await merkleDistributor.connect(admin).setWeeklyDistribution(user1.address);
      expect(await merkleDistributor.weeklyDistribution()).to.equal(user1.address);
    });

    it("Should allow emergency token recovery when paused", async function () {
      await merkleDistributor.connect(admin).pause();
      
      const amount = ethers.parseUnits("10", 8);
      await expect(
        merkleDistributor.connect(admin).emergencyRecoverTokens(await token.getAddress(), amount)
      ).to.not.be.reverted;
    });

    it("Should not allow emergency recovery when not paused", async function () {
      const amount = ethers.parseUnits("10", 8);
      await expect(
        merkleDistributor.connect(admin).emergencyRecoverTokens(await token.getAddress(), amount)
      ).to.be.revertedWith("MerkleDistributor: Contract must be paused");
    });
  });

  describe("Distribution Finalization", function () {
    beforeEach(async function () {
      const totalTokens = ethers.parseUnits("60", 8);
      await merkleDistributor.connect(weeklyDistribution).startNewDistribution(merkleRoot, totalTokens);
    });

    it("Should finalize distribution and return unclaimed tokens", async function () {
      // Claim only part of the rewards
      const claim = claims[0];
      const proof = merkleTree.getHexProof(
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      await merkleDistributor.connect(user1).claim(claim.index, claim.account, claim.amount, proof);

      const adminBalanceBefore = await token.balanceOf(admin.address);
      
      await expect(
        merkleDistributor.connect(admin).finalizeCurrentDistribution()
      ).to.emit(merkleDistributor, "DistributionFinalized");

      const adminBalanceAfter = await token.balanceOf(admin.address);
      const expectedUnclaimed = ethers.parseUnits("50", 8); // 60 - 10 claimed
      expect(adminBalanceAfter - adminBalanceBefore).to.equal(expectedUnclaimed);
    });

    it("Should not allow double finalization", async function () {
      await merkleDistributor.connect(admin).finalizeCurrentDistribution();
      
      await expect(
        merkleDistributor.connect(admin).finalizeCurrentDistribution()
      ).to.be.revertedWith("MerkleDistributor: Distribution already finalized");
    });
  });

  describe("Token Deposits", function () {
    it("Should allow weekly distribution to deposit tokens", async function () {
      const amount = ethers.parseUnits("100", 8);
      await token.mint(weeklyDistribution.address, amount);
      await token.connect(weeklyDistribution).approve(await merkleDistributor.getAddress(), amount);

      await expect(
        merkleDistributor.connect(weeklyDistribution).depositTokens(amount)
      ).to.emit(merkleDistributor, "TokensDeposited")
        .withArgs(amount, 0); // distributionId is 0 initially
    });

    it("Should not allow non-weekly distribution to deposit tokens", async function () {
      const amount = ethers.parseUnits("100", 8);
      await token.mint(admin.address, amount);
      await token.connect(admin).approve(await merkleDistributor.getAddress(), amount);

      await expect(
        merkleDistributor.connect(admin).depositTokens(amount)
      ).to.be.revertedWith("MerkleDistributor: caller is not weekly distribution");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero amount claims", async function () {
      const zeroClaims = [
        { index: 0, account: user1.address, amount: ethers.parseUnits("0", 8) }
      ];

      const elements = zeroClaims.map((claim) =>
        solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [claim.index, claim.account, claim.amount]
        )
      );

      const zeroMerkleTree = new MerkleTree(elements, keccak256, { sortPairs: true });
      const zeroMerkleRoot = zeroMerkleTree.getHexRoot();

      await merkleDistributor.connect(weeklyDistribution).startNewDistribution(zeroMerkleRoot, 0);

      const proof = zeroMerkleTree.getHexProof(elements[0]);
      
      await expect(
        merkleDistributor.connect(user1).claim(0, user1.address, 0, proof)
      ).to.emit(merkleDistributor, "Claimed")
        .withArgs(0, user1.address, 0);
    });

    it("Should handle empty merkle tree", async function () {
      await expect(
        merkleDistributor.connect(weeklyDistribution).startNewDistribution(ethers.ZeroHash, 0)
      ).to.not.be.reverted;

      expect(await merkleDistributor.merkleRoot()).to.equal(ethers.ZeroHash);
    });
  });
});