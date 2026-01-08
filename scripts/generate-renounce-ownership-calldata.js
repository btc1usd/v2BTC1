const ethers = require("ethers");

async function main() {
  console.log("=== Generate Calldata to Renounce BTC1USD Ownership ===\n");

  const deployment = require("../deployment-base-mainnet.json");
  const btc1usdAddress = deployment.core.btc1usd;
  const zeroAddress = "0x0000000000000000000000000000000000000000";

  console.log(`BTC1USD Contract: ${btc1usdAddress}`);
  console.log(`Target (Zero Address): ${zeroAddress}`);
  console.log(`Current Owner (Safe): ${deployment.config.admin}\n`);

  // Create contract interface
  const btc1usdInterface = new ethers.Interface([
    "function transferOwnership(address newOwner) external",
    "function owner() view returns (address)",
    "function pendingOwner() view returns (address)",
    "function criticalParamsLocked() view returns (bool)"
  ]);

  // Generate calldata for transferOwnership to zero address
  const calldata = btc1usdInterface.encodeFunctionData("transferOwnership", [
    zeroAddress
  ]);

  console.log("--- STEP 1: Initiate Ownership Transfer to Zero Address ---");
  console.log("\n📋 Transaction Details for Safe UI:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`To (Contract Address): ${btc1usdAddress}`);
  console.log(`Value: 0 ETH`);
  console.log(`Data (Calldata):\n${calldata}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔍 Function: transferOwnership(address)");
  console.log(`   Parameter: newOwner = ${zeroAddress}`);
  console.log(`   Action: Transfer ownership to zero address (renounce)\n`);

  console.log("⚠️  IMPORTANT NOTES:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. This uses Ownable2Step - requires 2 transactions:");
  console.log("   • Step 1: Current owner calls transferOwnership(0x000...)");
  console.log("   • Step 2: CANNOT be completed (zero address can't accept)");
  console.log("");
  console.log("2. After Step 1, ownership is in PENDING state:");
  console.log("   • owner() = Current Safe address");
  console.log("   • pendingOwner() = 0x000...000");
  console.log("");
  console.log("3. Since zero address cannot call acceptOwnership():");
  console.log("   • Ownership remains with Safe FOREVER");
  console.log("   • pendingOwner will stay at 0x000...000");
  console.log("   • This effectively LOCKS ownership to current Safe");
  console.log("");
  console.log("4. Alternative approach (if you want TRUE renouncement):");
  console.log("   • Lock critical parameters instead");
  console.log("   • Then transfer to DAO for governance");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📍 Safe Multisig UI Steps:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Go to: https://app.safe.global/home");
  console.log(`2. Connect wallet and select Safe: ${deployment.config.admin}`);
  console.log("3. Click 'New Transaction' → 'Contract Interaction'");
  console.log(`4. Enter Contract Address: ${btc1usdAddress}`);
  console.log("5. Paste the calldata above");
  console.log("6. Review and submit for signatures");
  console.log("7. Execute when threshold is met");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔗 Useful Links:");
  console.log(`• BTC1USD Contract: https://basescan.org/address/${btc1usdAddress}`);
  console.log(`• Safe Dashboard: https://app.safe.global/home?safe=base:${deployment.config.admin}`);
  console.log("");

  console.log("❓ Do you want to proceed with this approach?");
  console.log("   OR would you prefer to:");
  console.log("   1. Lock critical parameters (keeps ownership for emergencies)");
  console.log("   2. Transfer to DAO (for decentralized governance)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
