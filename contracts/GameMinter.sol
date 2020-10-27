pragma solidity 0.5.12;

import "./ERC1155Tradable.sol";

contract GameMinter is ERC1155Tradable {
    constructor(address _proxyRegistryAddress) public ERC1155Tradable("Spottheball game minter", "HARDCORE", _proxyRegistryAddress) {
        _setBaseMetadataURI("https://api.dontbuymeme.com/memes/");
    }
}