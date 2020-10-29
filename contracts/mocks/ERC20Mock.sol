pragma solidity 0.5.12;

contract ERC20Mock {
    uint256 public balance_;
    bool public transfer_;
    bool public transferFrom_;

    constructor(uint256 _balance, bool _transfer, bool _transferFrom) public {
        balance_ = _balance;
        transfer_ = _transfer;
        transferFrom_ = _transferFrom;
    }

    function balanceOf(address) public view returns (uint256) {
        return balance_;
    }

    function transfer(address, uint256) public view returns (bool) {
        return transfer_;
    }

    function transferFrom(address, address, uint256) public view returns (bool) {
        return transferFrom_;
    }

}