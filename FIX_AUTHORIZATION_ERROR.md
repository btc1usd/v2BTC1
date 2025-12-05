# Fixing "Not authorized - admin only" Error

## Problem

When trying to add development wallets or perform admin operations, you're seeing the error:
```
❌ Not authorized - admin only
```

## Root Cause

The wallet contracts (DevWallet, EndowmentWallet, MerkleFeeCollector) were deployed by address `0x0c8852280df8eF9fCb2a24e9d76f1ee4779773E9` (the deployer), but the configured admin is `0x6210FfE7340dC47d5DA4b888e850c036CC6ee835`.

These contracts use the `onlyOwner` modifier from OpenZeppelin's Ownable contract, which restricts certain functions to the contract owner. Currently, the owner is still the deployer address, not the admin address.

## Solution

Transfer ownership of the wallet contracts from the deployer to the admin address.

### Steps

1. **Ensure you have access to the deployer wallet**
   - The deployer address is: `0x0c8852280df8eF9fCb2a24e9d76f1ee4779773E9`
   - Make sure you can sign transactions from this address

2. **Run the ownership transfer script**
   ```bash
   npx hardhat run scripts/transfer-wallet-ownership.js --network base-sepolia
   ```

3. **Verify the transfer**
   - The script will output verification links to BaseScan
   - Check that the owner is now `0x6210FfE7340dC47d5DA4b888e850c036CC6ee835`

### What the script does

The script will:
1. Check the current owner of each wallet contract
2. Transfer ownership to the admin address (`0x6210FfE7340dC47d5DA4b888e850c036CC6ee835`)
3. Verify the transfer was successful

### Contracts to be updated

- **DevWallet**: `0xC90779c0d5e188C2d5357d8256E04CFc80b34526`
- **EndowmentWallet**: `0x57F7085B030FcBa707F8Ffff4207f14524dB092C`
- **MerkleFeeCollector**: `0x56bA2CB3f50BD4D1A4BEf192Be508BD1D4dbbd3A`

## After Transfer

Once ownership is transferred, the admin address `0x6210FfE7340dC47d5DA4b888e850c036CC6ee835` will be able to:
- Add/remove development wallets
- Add/remove endowment wallets  
- Add/remove merkle fee wallets
- Execute distributions
- Manage all admin functions

## Alternative: Manual Transfer via BaseScan

If you prefer to transfer manually:

1. Go to each contract on BaseScan (Base Sepolia):
   - [DevWallet](https://sepolia.basescan.org/address/0xC90779c0d5e188C2d5357d8256E04CFc80b34526#writeContract)
   - [EndowmentWallet](https://sepolia.basescan.org/address/0x57F7085B030FcBa707F8Ffff4207f14524dB092C#writeContract)
   - [MerkleFeeCollector](https://sepolia.basescan.org/address/0x56bA2CB3f50BD4D1A4BEf192Be508BD1D4dbbd3A#writeContract)

2. Connect the deployer wallet (`0x0c8852280df8eF9fCb2a24e9d76f1ee4779773E9`)

3. Call `transferOwnership` with the new owner address: `0x6210FfE7340dC47d5DA4b888e850c036CC6ee835`

4. Confirm each transaction

## Verification

After transferring ownership, you can verify by:

1. **Via Block Explorer**:
   - Go to the contract's "Read Contract" tab
   - Call the `owner()` function
   - It should return `0x6210FfE7340dC47d5DA4b888e850c036CC6ee835`

2. **Via Frontend**:
   - Connect with the admin wallet `0x6210FfE7340dC47d5DA4b888e850c036CC6ee835`
   - Try adding a development wallet
   - The operation should succeed without the "Not authorized" error

## Troubleshooting

### Error: "Ownable: caller is not the owner"
- This means you're not connected with the deployer wallet
- Make sure you're using `0x0c8852280df8eF9fCb2a24e9d76f1ee4779773E9` to run the script

### Ownership already transferred
- If the owner is already the admin address, no action is needed
- The script will skip already-transferred contracts

### Cannot find deployer private key
- Check your `.env` file or Hardhat config
- The deployer's private key should be configured for the Base Sepolia network
