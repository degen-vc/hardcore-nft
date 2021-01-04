pragma solidity 0.5.12;
pragma experimental ABIEncoderV2;

import "../Ownable.sol";
import "./ERC1155Minter.sol";
import "../IERC20.sol";
import "../TokenWrapper.sol";


contract GenesisPoolGame is TokenWrapper, Ownable {

    uint256 public constant MAX_STAKE = 65 * 1e18;
    uint256 public constant MAX_ALLOWED_FEE = 1e18;
    ERC1155Minter public gameMinter;
    address public nftFund;
    uint256 public fee;

    uint256 public gameStartTime;
    uint256 public rewardNeeded;
    uint256 public width;
    string public url;
    mapping(address => uint256) public lastUpdateTime;
    mapping(address => uint256) public points;

    event GameStarted(uint256 gameStartTime, uint256 rewardNeeded);
    event FeeUpdated(uint256 fee);
    event FundUpdated(address nftFund);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Created(address indexed user, uint256 indexed id, uint256 x, uint256 y);

    modifier updateReward(address account) {
        if (account != address(0)) {
            points[account] = earned(account);
            lastUpdateTime[account] = block.timestamp;
        }
        _;
    }

    constructor(ERC1155Minter _gameMinter, IERC20 _erc20Address, address _nftFund, uint256 _initialFee) public TokenWrapper(_erc20Address) {
        gameMinter = _gameMinter;
        nftFund = _nftFund;
        fee = _initialFee;
    }

    function setFee(uint256 _fee) public onlyOwner {
        require(_fee <= MAX_ALLOWED_FEE, "Max fee is 1 HCORE");
        fee = _fee;
        emit FeeUpdated(_fee);
    }

    function setNftFund(address _nftFund) public onlyOwner {
        require(_nftFund != address(0), "Zero address not allowed");

        nftFund = _nftFund;
        emit FundUpdated(_nftFund);
    }

    function start(uint256 _gameStartTime, uint256 _amount, uint256 _imageWidth, string memory _url) public onlyOwner {
        require(gameStartTime == 0,  "Already started");
        require(block.timestamp <= _gameStartTime, "Only future time to start");

        gameStartTime = _gameStartTime;
        rewardNeeded = _amount;
        width =_imageWidth;
        url = _url;
        emit GameStarted(_gameStartTime, _amount);
    }

    function earned(address account) public view returns (uint256) {
        uint256 blockTime = block.timestamp;
        return
            points[account].add(
                (blockTime.sub(lastUpdateTime[account]).mul(1e18).div(86400).mul(
                    (balanceOf(account).mul(10000)).div(1e18)
                //1 point equals 65 tokens per day
                )).div(650000)
            );
    }

    function _sendFee() private {
        token.transferFrom(msg.sender, nftFund, fee);
    }

    // stake visibility is public as overriding TokenWrapper's stake() function
    // UI should show to user amount that will be staked minus fee
    function stake(uint256 amount) public updateReward(msg.sender) {
        require(gameStartTime != 0,  "Not started yet");
        require(amount >= fee, "Cannot stake less than fee");

        uint256 resultAmount = amount - fee;
        require(resultAmount.add(balanceOf(msg.sender)) <= MAX_STAKE, "Cannot stake more than 65 HCORE");

        super.stake(resultAmount);
        emit Staked(msg.sender, resultAmount);
        _sendFee();
    }

    function withdraw(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");

        super.withdraw(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function exit() external {
        withdraw(balanceOf(msg.sender));
    }

    function redeem(uint256 _xPoint, uint256 _yPoint) public updateReward(msg.sender) {
        require(gameStartTime != 0,  "Not started yet");
        require(points[msg.sender] >= rewardNeeded, "Not enough points to play");

        points[msg.sender] = points[msg.sender].sub(rewardNeeded);
        uint256 _id = _generateId(_xPoint, _yPoint, width);
        gameMinter.create(msg.sender, 1, 1, _id, uint64(_xPoint), uint64(_yPoint), "0x");
        emit Created(msg.sender, _id, _xPoint, _yPoint);
    }

    function _generateId(uint256 _xPoint, uint256 _yPoint, uint256 _width) internal view returns(uint256) {
        uint256 id = _width * _yPoint + _xPoint;
        require(gameMinter.creators(id) == address(0), "Id already used");
        return id;
    }
}
