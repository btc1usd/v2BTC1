const ethers = require("ethers");

async function main() {
  console.log("Checking BTC1USD ownership on Base Mainnet...\n");

  const deployment = require("../deployment-base-mainnet.json");
  const btc1usdAddress = deployment.core.btc1usd;

  console.log(`BTC1USD Address: ${btc1usdAddress}`);

  // Connect to Base Mainnet
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  
  const btc1usd = new ethers.Contract(
    btc1usdAddress,
    [
      "function owner() view returns (address)",
      "function pendingOwner() view returns (address)",
      "function criticalParamsLocked() view returns (bool)"
    ],
    provider
  );

  try {
    const currentOwner = await btc1usd.owner();
    console.log(`\nCurrent Owner: ${currentOwner}`);

    const pendingOwner = await btc1usd.pendingOwner();
    console.log(`Pending Owner: ${pendingOwner}`);

    const isLocked = await btc1usd.criticalParamsLocked();
    console.log(`Critical Params Locked: ${isLocked}`);

    // Check if it's the DAO
    const daoAddress = deployment.governance.dao;
    console.log(`\nDAO Address: ${daoAddress}`);
    console.log(`Is DAO the owner? ${currentOwner.toLowerCase() === daoAddress.toLowerCase()}`);

    // Check if it's the deployer
    const deployerAddress = deployment.deployer;
    console.log(`Deployer Address: ${deployerAddress}`);
    console.log(`Is Deployer the owner? ${currentOwner.toLowerCase() === deployerAddress.toLowerCase()}`);

    console.log("\n---");
    console.log("BTC1USD Contract: https://basescan.org/address/" + btc1usdAddress);
    console.log("Owner Address: https://basescan.org/address/" + currentOwner);
  } catch (error) {
    console.error("Error checking ownership:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
