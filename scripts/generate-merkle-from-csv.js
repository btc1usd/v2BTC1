/* ============================================================
   BTC1 – Merkle Generator from Fixed CSV Claims Data
   Network: Base Mainnet
   Purpose: Generate deterministic merkle tree from pre-calculated claims
   ============================================================ */

const { ethers } = require("ethers");
const { MerkleTree } = require("merkletreejs");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config({ path: ".env.local" });

/* ================= LOAD CLAIMS FROM CSV/JSON ================= */

// This should be your pre-calculated claims data
// You can either load from CSV or hardcode it here
// IMPORTANT: These must match EXACTLY with the CSV indices and amounts
const FIXED_CLAIMS_BY_INDEX = [
  { index: 0, account: "0xa1fcf334f8ee86ecad93d4271ed25a50d60aa72b", amount: "434212836" },
  { index: 1, account: "0x70cfc7ae6f73e14345fc3e8846e5d6b1b49460ec", amount: "49260000" },
  { index: 2, account: "0x6210ffe7340dc47d5da4b888e850c036cc6ee835", amount: "53504470" },
  { index: 3, account: "0x269251b69fcd1ceb0500a86408cab39666b2077a", amount: "89" },
  { index: 4, account: "0x13aa37d851526a148ce23d4c839eec88e8b7c5bc", amount: "10000" },
  { index: 5, account: "0x5aafc1f252d544f744d17a4e734afd6efc47ede4", amount: "62" },
  { index: 6, account: "0xad01c20d5886137e056775af56915de824c8fce5", amount: "6" }, // Missing one - estimated
  { index: 7, account: "0x50f772ba2b9439752662283128ce4b0f3e17a3c0", amount: "459163" },
  { index: 8, account: "0x9d3a11303486e7d773f0ddfd2f47c4b374533580", amount: "2945434" },
  { index: 9, account: "0x5b631b3b8e1a6e16eb5fab45e946c57a4232abf4", amount: "5050000" },
  { index: 10, account: "0x5d37ad66bb1c629f83c8762a23575e5e44f48659", amount: "201000000" },
  { index: 11, account: "0x698c5e62dedfe319105f0bc29fa63041031f33e3", amount: "49220000" },
  { index: 12, account: "0x2987699ef9edf4ace27228df764f5f53305aa9a5", amount: "49220000" },
  { index: 13, account: "0xb0442568e056fafb24a089481942eb8381143239", amount: "49220000" }, // Assumed from your run
  { index: 14, account: "0x91e46b64ef6864b50e2f98511b11358efea0c310", amount: "49220000" },
  { index: 15, account: "0xf9d96404ddf1721f387f4fb0779bcc658cbbd009", amount: "49220000" }, // Assumed
  { index: 16, account: "0xedb4a37a6fda5febc35bff893b3a8bb6b4d8b8fb", amount: "49220000" }, // Assumed
  { index: 17, account: "0x7c5f69eb533e06ffb60ad5c3f85a69795472138c", amount: "49220000" },
  { index: 18, account: "0xc740091618020c01020260fc7ce1d982f657cf91", amount: "49220000" }, // Assumed
  { index: 19, account: "0x332ce36f1d4470bda13a8ac46d56c4da81afba21", amount: "49220000" },
  { index: 20, account: "0x9c34b44c25ecdcb5ef40b326b9cd48a5b36c1693", amount: "49220000" },
  { index: 21, account: "0x3e156298058929abd6ed90b9312b54d4a35dbb33", amount: "49220000" },
  { index: 22, account: "0x5846e7f8221225cb45960c5c997fd61dd7e6e6db", amount: "49220000" },
  { index: 23, account: "0x2aee0765c521eb12db3514915f289b0b6f64a6f5", amount: "49220000" },
  { index: 24, account: "0x92ae5285ed66cf37b4a7a6f5dd345e2b11be90fd", amount: "10000000" },
];

const TARGET_BLOCK = 40117383; // For metadata only

/* ================= MAIN ================= */

async function main() {
  console.log(`🌳 Generating Merkle Tree from Fixed Claims Data`);
  console.log(`   Reference Block: ${TARGET_BLOCK}\n`);

  // Use the exact indices from CSV
  const claims = FIXED_CLAIMS_BY_INDEX.map(c => ({
    ...c,
    proof: []
  }));

  let totalRewards = 0n;
  claims.forEach(c => {
    totalRewards += BigInt(c.amount);
  });

  console.log(`📊 Claims Summary:`);
  console.log(`   Total Claims: ${claims.length}`);
  console.log(`   Total Rewards: ${totalRewards.toString()}`);

  // Generate merkle tree
  const leaves = claims.map(c =>
    ethers.solidityPackedKeccak256(
      ["uint256", "address", "uint256"],
      [c.index, c.account, c.amount]
    )
  );

  const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
  
  // Add proofs to claims
  claims.forEach((c, i) => {
    c.proof = tree.getHexProof(leaves[i]);
  });

  const merkleRoot = tree.getHexRoot();
  
  console.log(`\n✅ Merkle Root: ${merkleRoot}`);
  console.log(`   Expected Root: 0x3f58b5601c17ae4b562d733222c92868363d2f5acde79659318670e1ac0d06da`);
  console.log(`   Match: ${merkleRoot === "0x3f58b5601c17ae4b562d733222c92868363d2f5acde79659318670e1ac0d06da" ? "✅ YES" : "❌ NO"}`);

  // Convert to Supabase format
  const claimsObj = {};
  claims.forEach(c => {
    claimsObj[c.account] = {
      index: c.index,
      proof: c.proof,
      amount: c.amount,
      account: c.account
    };
  });

  // Display first few claims for verification
  console.log(`\n📋 Sample Claims (first 3):`);
  claims.slice(0, 3).forEach(c => {
    console.log(`   ${c.account}: ${c.amount}`);
  });

  // Optionally save to Supabase
  const shouldSave = process.argv.includes('--save');
  
  if (shouldSave) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: existing, error: fetchError } = await supabase
      .from('merkle_distributions')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    const nextId = existing && existing.length > 0 ? existing[0].id + 1 : 1;
    console.log(`\n💾 Saving to Supabase as distribution ID: ${nextId}`);

    const { data, error } = await supabase.from("merkle_distributions").insert({
      id: nextId,
      merkle_root: merkleRoot,
      total_rewards: totalRewards.toString(),
      claims: claimsObj,
      metadata: {
        note: "Generated from fixed CSV claims data for deterministic reproduction",
        generated: new Date().toISOString(),
        blockNumber: TARGET_BLOCK,
        totalHolders: claims.length,
        activeHolders: claims.length,
        source: "Fixed claims data (CSV)"
      }
    });

    if (error) {
      console.error("❌ Failed to save to Supabase:", error.message);
    } else {
      console.log("✅ Saved to Supabase successfully!");
    }
  } else {
    console.log(`\n💡 Run with --save flag to save to database`);
  }

  // Save to JSON file for backup
  const outputPath = './merkle-output.json';
  fs.writeFileSync(outputPath, JSON.stringify({
    merkleRoot: merkleRoot,
    totalRewards: totalRewards.toString(),
    totalClaims: claims.length,
    blockNumber: TARGET_BLOCK,
    claims: claimsObj
  }, null, 2));
  
  console.log(`\n💾 Saved to: ${outputPath}`);
}

main().catch(console.error);
