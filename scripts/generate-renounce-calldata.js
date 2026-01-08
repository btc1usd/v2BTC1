const ethers = require("ethers");

async function main() {
  console.log("=== Generate Calldata to TRULY Renounce BTC1USD Ownership ===\n");

  const deployment = require("../deployment-base-mainnet.json");
  const btc1usdAddress = deployment.core.btc1usd;

  console.log(`BTC1USD Contract: ${btc1usdAddress}`);
  console.log(`Current Owner (Safe): ${deployment.config.admin}\n`);

  // Create contract interface - Ownable2Step has renounceOwnership
  const btc1usdInterface = new ethers.Interface([
    "function renounceOwnership() external",
    "function owner() view returns (address)",
    "function pendingOwner() view returns (address)"
  ]);

  // Generate calldata for renounceOwnership
  const calldata = btc1usdInterface.encodeFunctionData("renounceOwnership", []);

  console.log("=== RENOUNCE OWNERSHIP (TRUE RENOUNCEMENT) ===");
  console.log("This will PERMANENTLY set owner to address(0)!\n");

  console.log("📋 Transaction Details for Safe UI:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`To (Contract Address): ${btc1usdAddress}`);
  console.log(`Value: 0 ETH`);
  console.log(`Data (Calldata):\n${calldata}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔍 Function: renounceOwnership()");
  console.log("   No parameters required");
  console.log("   Action: Set owner to address(0) - TRUE renouncement\n");

  console.log("✅ What This Achieves:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Sets owner() = 0x000...000 (IMMEDIATE)");
  console.log("2. Removes 'Contract Not Renounced' risk completely");
  console.log("3. NO ONE can ever call owner-only functions again:");
  console.log("   • Cannot change Vault address (even with timelock)");
  console.log("   • Cannot change WeeklyDistribution address");
  console.log("   • Cannot lock critical parameters");
  console.log("   • Cannot transfer ownership");
  console.log("4. Contract becomes TRULY IMMUTABLE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("⚠️  CRITICAL WARNINGS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚨 THIS IS IRREVERSIBLE AND PERMANENT!");
  console.log("");
  console.log("Before renouncing, make ABSOLUTELY SURE:");
  console.log(`1. Vault is correct: ${deployment.core.vault}`);
  console.log(`2. WeeklyDistribution is correct: ${deployment.distribution.weeklyDistribution}`);
  console.log(`3. criticalParamsLocked = ${await checkLockStatus(btc1usdAddress)}`);
  console.log("");
  console.log("After renouncement:");
  console.log("❌ NO upgrades possible (if proxied)");
  console.log("❌ NO parameter changes");
  console.log("❌ NO emergency controls");
  console.log("❌ NO way to fix bugs or issues");
  console.log("");
  console.log("🎯 RECOMMENDED APPROACH INSTEAD:");
  console.log("1. FIRST: Execute lockCriticalParams() (0xc3f6b125)");
  console.log("2. THEN: Transfer ownership to DAO for governance");
  console.log("3. Keep DAO as owner for emergency situations");
  console.log("");
  console.log("Only renounce if you want ZERO control forever!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📍 Safe Multisig UI Steps (IF YOU'RE SURE):");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Go to: https://app.safe.global/home");
  console.log(`2. Connect wallet and select Safe: ${deployment.config.admin}`);
  console.log("3. Click 'New Transaction' → 'Contract Interaction'");
  console.log(`4. Enter Contract Address: ${btc1usdAddress}`);
  console.log("5. Paste the calldata above");
  console.log("6. ⚠️  REVIEW VERY CAREFULLY - NO UNDO!");
  console.log("7. Submit for signatures");
  console.log("8. Execute when threshold is met");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔗 Useful Links:");
  console.log(`• BTC1USD Contract: https://basescan.org/address/${btc1usdAddress}`);
  console.log(`• Safe Dashboard: https://app.safe.global/home?safe=base:${deployment.config.admin}`);
  console.log("");

  console.log("💡 FINAL RECOMMENDATION:");
  console.log("═══════════════════════════════════════════════");
  console.log("Option A (Recommended): lockCriticalParams() + Transfer to DAO");
  console.log("  ✓ Locks parameters (immutable)");
  console.log("  ✓ Keeps DAO for emergencies");
  console.log("  ✓ Removes security risk");
  console.log("");
  console.log("Option B (Nuclear): renounceOwnership()");
  console.log("  ✓ Removes security risk");
  console.log("  ✗ NO emergency controls");
  console.log("  ✗ Irreversible");
  console.log("═══════════════════════════════════════════════\n");
}

async function checkLockStatus(btc1usdAddress) {
  try {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const btc1usd = new ethers.Contract(
      btc1usdAddress,
      ["function criticalParamsLocked() view returns (bool)"],
      provider
    );
    const isLocked = await btc1usd.criticalParamsLocked();
    return isLocked ? "✅ true (LOCKED)" : "❌ false (NOT LOCKED)";
  } catch (error) {
    return "unknown";
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
