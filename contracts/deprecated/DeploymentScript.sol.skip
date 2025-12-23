// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../BTC1USD.sol";
import "../Vault.sol";
import "../WeeklyDistribution.sol";
import "../EndowmentManager.sol";
import "../PriceOracle.sol";
import "../ProtocolGovernance.sol";

contract DeploymentScript {
    struct DeploymentAddresses {
        address btc1usd;
        address vault;
        address weeklyDistribution;
        address endowmentManager;
        address priceOracle;
        address protocolGovernance;
    }
    
    event ProtocolDeployed(DeploymentAddresses addresses);
    
    function deployProtocol(
        address admin,
        address devWallet,
        address endowmentWallet,
        address merklFeeCollector,
        address emergencyCouncil,
        address merklDistributor,
        uint256 initialBTCPrice,
        address[] memory initialCollateralTokens
    ) external returns (DeploymentAddresses memory) {
        
        // Deploy core contracts
        BTC1USD btc1usd = new BTC1USD(admin);
        PriceOracle priceOracle = new PriceOracle(admin, initialBTCPrice);
        
        Vault vault = new Vault(
            address(btc1usd),
            address(priceOracle),
            admin,
            devWallet,
            endowmentWallet
        );
        
        WeeklyDistribution weeklyDistribution = new WeeklyDistribution(
            address(btc1usd),
            address(vault),
            admin,
            devWallet,
            endowmentWallet,
            merklFeeCollector,
            merklDistributor
        );
        
        EndowmentManager endowmentManager = new EndowmentManager(
            address(btc1usd),
            admin,
            endowmentWallet
        );
        
        ProtocolGovernance governance = new ProtocolGovernance(
            admin,
            emergencyCouncil
        );
        
        // Initialize connections
        btc1usd.setVault(address(vault));
        
        governance.initializeContracts(
            address(btc1usd),
            address(vault),
            address(weeklyDistribution),
            address(endowmentManager),
            address(priceOracle)
        );
        
        // Add initial collateral tokens
        for (uint i = 0; i < initialCollateralTokens.length; i++) {
            vault.addCollateral(initialCollateralTokens[i]);
        }
        
        DeploymentAddresses memory addresses = DeploymentAddresses({
            btc1usd: address(btc1usd),
            vault: address(vault),
            weeklyDistribution: address(weeklyDistribution),
            endowmentManager: address(endowmentManager),
            priceOracle: address(priceOracle),
            protocolGovernance: address(governance)
        });
        
        emit ProtocolDeployed(addresses);
        return addresses;
    }
}
