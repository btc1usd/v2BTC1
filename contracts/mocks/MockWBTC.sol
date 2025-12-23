// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../libraries/SafeMath.sol";

contract MockWBTC {
    using SafeMath for uint256;

    string public constant name = "Wrapped Bitcoin";
    string public constant symbol = "WBTC";
    uint8 public constant decimals = 8;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address public admin;
    bool public paused;

    modifier onlyAdmin() {
        require(msg.sender == admin, "MockWBTC: caller is not admin");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "MockWBTC: token transfer while paused");
        _;
    }

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Paused();
    event Unpaused();
    event Mint(address indexed to, uint256 amount);

    constructor(address _admin) {
        admin = _admin;
    }

    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }

    function pause() external onlyAdmin {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused();
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external whenNotPaused returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external whenNotPaused returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external whenNotPaused returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "MockWBTC: transfer amount exceeds allowance");
        
        _transfer(from, to, amount);
        _approve(from, msg.sender, currentAllowance.sub(amount));
        
        return true;
    }

    function mint(address to, uint256 amount) external onlyAdmin {
        require(to != address(0), "MockWBTC: mint to zero address");
        
        _totalSupply = _totalSupply.add(amount);
        _balances[to] = _balances[to].add(amount);
        
        emit Transfer(address(0), to, amount);
        emit Mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyAdmin {
        require(from != address(0), "MockWBTC: burn from zero address");
        require(_balances[from] >= amount, "MockWBTC: burn amount exceeds balance");
        
        _balances[from] = _balances[from].sub(amount);
        _totalSupply = _totalSupply.sub(amount);
        
        emit Transfer(from, address(0), amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "MockWBTC: transfer from zero address");
        require(to != address(0), "MockWBTC: transfer to zero address");
        require(_balances[from] >= amount, "MockWBTC: transfer amount exceeds balance");

        _balances[from] = _balances[from].sub(amount);
        _balances[to] = _balances[to].add(amount);

        emit Transfer(from, to, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "MockWBTC: approve from zero address");
        require(spender != address(0), "MockWBTC: approve to zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}
