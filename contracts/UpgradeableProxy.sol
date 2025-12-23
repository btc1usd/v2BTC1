// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title UpgradeableProxy
 * @notice Simple transparent upgradeable proxy for protocol contracts
 * @dev Uses delegate call to forward all calls to implementation contract
 */
contract UpgradeableProxy {
    // Storage slot for implementation address
    bytes32 private constant IMPLEMENTATION_SLOT = keccak256("eip1967.proxy.implementation");

    // Storage slot for admin address
    bytes32 private constant ADMIN_SLOT = keccak256("eip1967.proxy.admin");

    event Upgraded(address indexed implementation);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    /**
     * @dev Initializes the proxy with initial implementation and admin
     */
    constructor(address implementation_, address admin_) {
        _setImplementation(implementation_);
        _setAdmin(admin_);
    }

    /**
     * @dev Fallback function that delegates calls to the implementation
     */
    fallback() external payable {
        _delegate(_implementation());
    }

    receive() external payable {
        _delegate(_implementation());
    }

    /**
     * @dev Returns the current implementation address
     */
    function implementation() public view returns (address impl) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            impl := sload(slot)
        }
    }

    /**
     * @dev Returns the current admin address
     */
    function admin() public view returns (address adm) {
        bytes32 slot = ADMIN_SLOT;
        assembly {
            adm := sload(slot)
        }
    }

    /**
     * @dev Upgrades the implementation
     * Can only be called by admin
     */
    function upgradeTo(address newImplementation) external {
        require(msg.sender == admin(), "UpgradeableProxy: caller is not admin");
        require(newImplementation != address(0), "UpgradeableProxy: new implementation is zero address");
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    /**
     * @dev Changes the admin
     * Can only be called by current admin
     */
    function changeAdmin(address newAdmin) external {
        require(msg.sender == admin(), "UpgradeableProxy: caller is not admin");
        require(newAdmin != address(0), "UpgradeableProxy: new admin is zero address");
        address previousAdmin = admin();
        _setAdmin(newAdmin);
        emit AdminChanged(previousAdmin, newAdmin);
    }

    /**
     * @dev Stores the implementation address
     */
    function _setImplementation(address newImplementation) private {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, newImplementation)
        }
    }

    /**
     * @dev Stores the admin address
     */
    function _setAdmin(address newAdmin) private {
        bytes32 slot = ADMIN_SLOT;
        assembly {
            sstore(slot, newAdmin)
        }
    }

    /**
     * @dev Delegates the current call to implementation
     */
    function _delegate(address impl) private {
        assembly {
            // Copy msg.data
            calldatacopy(0, 0, calldatasize())

            // Delegate call to implementation
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)

            // Copy the returned data
            returndatacopy(0, 0, returndatasize())

            switch result
            case 0 {
                // Delegatecall failed, revert
                revert(0, returndatasize())
            }
            default {
                // Delegatecall succeeded, return data
                return(0, returndatasize())
            }
        }
    }

    /**
     * @dev Returns implementation address (internal helper for fallback)
     */
    function _implementation() private view returns (address impl) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            impl := sload(slot)
        }
    }
}

/**
 * @title ProxyAdmin
 * @notice Admin contract for managing multiple upgradeable proxies
 * @dev Designed to be controlled by GovernanceDAO
 */
contract ProxyAdmin {
    address public owner;
    address public governanceDAO;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event GovernanceDAOUpdated(address indexed oldDAO, address indexed newDAO);

    modifier onlyOwner() {
        require(msg.sender == owner, "ProxyAdmin: caller is not owner");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governanceDAO || msg.sender == owner, "ProxyAdmin: caller is not governance");
        _;
    }

    constructor(address _governanceDAO) {
        owner = msg.sender;
        governanceDAO = _governanceDAO;
    }

    /**
     * @dev Upgrades a proxy to a new implementation
     */
    function upgrade(UpgradeableProxy proxy, address implementation) external onlyGovernance {
        proxy.upgradeTo(implementation);
    }

    /**
     * @dev Changes the admin of a proxy
     */
    function changeProxyAdmin(UpgradeableProxy proxy, address newAdmin) external onlyOwner {
        proxy.changeAdmin(newAdmin);
    }

    /**
     * @dev Executes an arbitrary call on a proxy contract
     * @param target The target contract to call
     * @param data The calldata to execute
     */
    function executeCall(address target, bytes memory data) external payable onlyGovernance returns (bytes memory) {
        (bool success, bytes memory returndata) = target.call{value: msg.value}(data);
        if (!success) {
            if (returndata.length > 0) {
                // Bubble up the revert reason
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert("ProxyAdmin: call reverted without reason");
            }
        }
        return returndata;
    }

    /**
     * @dev Transfers ownership of ProxyAdmin
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ProxyAdmin: new owner is zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @dev Updates the governance DAO address
     */
    function setGovernanceDAO(address newDAO) external onlyOwner {
        require(newDAO != address(0), "ProxyAdmin: new DAO is zero address");
        address oldDAO = governanceDAO;
        governanceDAO = newDAO;
        emit GovernanceDAOUpdated(oldDAO, newDAO);
    }

    /**
     * @dev Gets the implementation of a proxy
     */
    function getProxyImplementation(UpgradeableProxy proxy) external view returns (address) {
        return proxy.implementation();
    }

    /**
     * @dev Gets the admin of a proxy
     */
    function getProxyAdmin(UpgradeableProxy proxy) external view returns (address) {
        return proxy.admin();
    }
}
