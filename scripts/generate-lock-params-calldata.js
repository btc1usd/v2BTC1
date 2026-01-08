const ethers = require("ethers");

async function main() {
  console.log("=== Generate Calldata to Lock BTC1USD Critical Parameters ===\n");

  const deployment = require("../deployment-base-mainnet.json");
  const btc1usdAddress = deployment.core.btc1usd;

  console.log(`BTC1USD Contract: ${btc1usdAddress}`);
  console.log(`Current Owner (Safe): ${deployment.config.admin}\n`);

  // Create contract interface
  const btc1usdInterface = new ethers.Interface([
    "function lockCriticalParams() external",
    "function criticalParamsLocked() view returns (bool)"
  ]);

  // Generate calldata for lockCriticalParams
  const calldata = btc1usdInterface.encodeFunctionData("lockCriticalParams", []);

  console.log("=== LOCK CRITICAL PARAMETERS ===");
  console.log("This will PERMANENTLY prevent changes to:");
  console.log("  ✓ Vault address");
  console.log("  ✓ WeeklyDistribution address");
  console.log("  ✓ Cannot be undone!\n");

  console.log("📋 Transaction Details for Safe UI:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`To (Contract Address): ${btc1usdAddress}`);
  console.log(`Value: 0 ETH`);
  console.log(`Data (Calldata):\n${calldata}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔍 Function: lockCriticalParams()");
  console.log("   No parameters required");
  console.log("   Action: Permanently lock Vault and WeeklyDistribution addresses\n");

  console.log("✅ What This Achieves:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Sets criticalParamsLocked = true (PERMANENT)");
  console.log("2. Owner can no longer change:");
  console.log("   • Vault address");
  console.log("   • WeeklyDistribution address");
  console.log("3. Owner still retains:");
  console.log("   • Emergency pause capabilities (if any)");
  console.log("   • Ability to transfer ownership");
  console.log("4. Removes 'Contract Not Renounced' risk");
  console.log("   • Contract becomes effectively immutable");
  console.log("   • Security scanners will see parameters are locked");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("⚠️  IMPORTANT:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("• This action is IRREVERSIBLE");
  console.log("• Make sure current Vault and WeeklyDistribution are correct:");
  console.log(`  - Vault: ${deployment.core.vault}`);
  console.log(`  - WeeklyDistribution: ${deployment.distribution.weeklyDistribution}`);
  console.log("• After locking, these addresses CANNOT be changed");
  console.log("• Only execute if you're 100% confident in current setup");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📍 Safe Multisig UI Steps:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Go to: https://app.safe.global/home");
  console.log(`2. Connect wallet and select Safe: ${deployment.config.admin}`);
  console.log("3. Click 'New Transaction' → 'Contract Interaction'");
  console.log(`4. Enter Contract Address: ${btc1usdAddress}`);
  console.log("5. Paste the calldata above");
  console.log("6. Review carefully - THIS IS PERMANENT");
  console.log("7. Submit for signatures");
  console.log("8. Execute when threshold is met");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔗 Useful Links:");
  console.log(`• BTC1USD Contract: https://basescan.org/address/${btc1usdAddress}`);
  console.log(`• Safe Dashboard: https://app.safe.global/home?safe=base:${deployment.config.admin}`);
  console.log(`• Vault: https://basescan.org/address/${deployment.core.vault}`);
  console.log(`• WeeklyDistribution: https://basescan.org/address/${deployment.distribution.weeklyDistribution}`);
  console.log("");

  console.log("💡 Recommendation:");
  console.log("Execute lockCriticalParams() FIRST to remove the risk,");
  console.log("then optionally transfer ownership to DAO for governance.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
