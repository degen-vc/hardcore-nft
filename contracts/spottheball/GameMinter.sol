pragma solidity 0.5.12;

import "./ERC1155Minter.sol";

contract GameMinter is ERC1155Minter {
    constructor() public ERC1155Minter("Spottheball game minter", "HARDCORE") {
        _setBaseMetadataURI("https://lambo.hcore.finance/spot-the-ball-win/#home");
    }

  function uri() public view returns (string memory) {
    return baseMetadataURI;
  }

  function uri(uint256) public view returns (string memory) {
    return baseMetadataURI;
  }
}