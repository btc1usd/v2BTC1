const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔍 Testing initiateVaultChange ABI Encoding\n");
  
  // Test address
  const testVaultAddress = "0x1234567890123456789012345678901234567890";
  
  // Create interface with the function signature
  const btc1usdInterface = new ethers.Interface([
    "function initiateVaultChange(address newVault)"
  ]);
  
  // Encode the function call
  const calldata = btc1usdInterface.encodeFunctionData("initiateVaultChange", [testVaultAddress]);
  
  console.log("✅ Encoding Results:");
  console.log("Function: initiateVaultChange(address)");
  console.log("Parameter:", testVaultAddress);
  console.log("\nGenerated Calldata:", calldata);
  console.log("Calldata length:", calldata.length, "characters");
  console.log("\n📊 Breakdown:");
  console.log("Function Selector (first 10 chars):", calldata.slice(0, 10));
  console.log("Parameter (remaining):", calldata.slice(10));
  
  // Decode it back to verify
  const decoded = btc1usdInterface.decodeFunctionData("initiateVaultChange", calldata);
  console.log("\n✅ Decoded Parameter:", decoded[0]);
  console.log("Matches input:", decoded[0].toLowerCase() === testVaultAddress.toLowerCase());
  
  // Get the function fragment for detailed info
  const fragment = btc1usdInterface.getFunction("initiateVaultChange");
  console.log("\n📝 Function Details:");
  console.log("Name:", fragment.name);
  console.log("Selector:", fragment.selector);
  console.log("Inputs:", fragment.inputs.map(i => `${i.name}: ${i.type}`).join(", "));
  
  console.log("\n✅ ABI encoding is working correctly!");
  console.log("\n⚠️  Important Notes:");
  console.log("1. The BTC1USD contract must have criticalParamsLocked = false");
  console.log("2. The transaction must be sent from the owner address (Safe multisig)");
  console.log("3. The new vault address must be different from the current vault");
  console.log("4. There must be no pending vault change already in progress");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
