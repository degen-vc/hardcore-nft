pragma solidity 0.5.12;
pragma experimental ABIEncoderV2;

import "./ERC1155Minter.sol";

contract GameMinter is ERC1155Minter {

  function uri() public view returns (string memory) {
    return baseMetadataURI;
  }

  function uri(uint256 _id) public view returns (string memory) {
    return string(abi.encodePacked(baseMetadataURI, _uint2str(_id)));
  }
}