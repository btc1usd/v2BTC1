// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IBTC1USD.sol";
import "./libraries/SafeMath.sol";

contract BTC1USD is IBTC1USD {
    using SafeMath for uint256;

    string public constant name = "BTC1USD";
    string public constant symbol = "BTC1";
    uint8 public constant decimals = 8;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address public vault;
    address public weeklyDistribution;
    address public admin;
    bool public paused;

    modifier onlyVault() {
        require(msg.sender == vault, "BTC1USD: caller is not vault");
        _;
    }

    modifier onlyVaultOrDistribution() {
        require(msg.sender == vault || msg.sender == weeklyDistribution, "BTC1USD: caller is not authorized minter");
        require(weeklyDistribution != address(0), "BTC1USD: weekly distribution not set");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "BTC1USD: caller is not admin");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "BTC1USD: token transfer while paused");
        _;
    }

    event VaultChanged(address indexed oldVault, address indexed newVault);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event Paused();
    event Unpaused();

    constructor(address _admin) {
        admin = _admin;
    }

    function setVault(address _vault) external onlyAdmin {
        address oldVault = vault;
        vault = _vault;
        emit VaultChanged(oldVault, _vault);
    }

    function setWeeklyDistribution(address _weeklyDistribution) external onlyAdmin {
        weeklyDistribution = _weeklyDistribution;
    }

    function setAdmin(address _admin) external onlyAdmin {
        address oldAdmin = admin;
        admin = _admin;
        emit AdminChanged(oldAdmin, _admin);
    }

    function pause() external override onlyAdmin {
        paused = true;
        emit Paused();
    }

    function unpause() external override onlyAdmin {
        paused = false;
        emit Unpaused();
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external override whenNotPaused returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override whenNotPaused returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "BTC1USD: transfer amount exceeds allowance");
        
        _transfer(from, to, amount);
        _approve(from, msg.sender, currentAllowance.sub(amount));
        
        return true;
    }

    function mint(address to, uint256 amount) external override onlyVaultOrDistribution {
        require(to != address(0), "BTC1USD: mint to zero address");
        
        _totalSupply = _totalSupply.add(amount);
        _balances[to] = _balances[to].add(amount);
        
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external override onlyVault {
        require(from != address(0), "BTC1USD: burn from zero address");
        require(_balances[from] >= amount, "BTC1USD: burn amount exceeds balance");
        
        _balances[from] = _balances[from].sub(amount);
        _totalSupply = _totalSupply.sub(amount);
        
        emit Transfer(from, address(0), amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "BTC1USD: transfer from zero address");
        require(to != address(0), "BTC1USD: transfer to zero address");
        require(_balances[from] >= amount, "BTC1USD: transfer amount exceeds balance");

        _balances[from] = _balances[from].sub(amount);
        _balances[to] = _balances[to].add(amount);

        emit Transfer(from, to, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "BTC1USD: approve from zero address");
        require(spender != address(0), "BTC1USD: approve to zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}
