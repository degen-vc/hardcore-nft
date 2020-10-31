const Ganache = require('./helpers/ganache');
const GameMinter = artifacts.require('GameMinter');
const ERC20Mock = artifacts.require('ERC20Mock');
const LPGenesisPoolGame = artifacts.require('LPGenesisPoolGame');

const truffleAssert = require('truffle-assertions');

contract.only('GameMinter', function(accounts) {
  const ganache = new Ganache(web3);
  afterEach('revert', ganache.revert);

  const bn = (input) => web3.utils.toBN(input);
  const assertBNequal = (bnOne, bnTwo) => assert.equal(bnOne.toString(), bnTwo.toString());

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  const owner = accounts[0];
  const notOwner = accounts[1];

  const onePoint = '1000000000000000000';
  const currentTime = Math.floor(Date.now() / 1000);
  const width = 1800;
  const imageUrl = 'www.image.com';

  let gameMinter;
  let erc20Mock;
  let lpGenesisPool;

  before('setup others', async function() {
    gameMinter = await GameMinter.new();
    erc20Mock = await ERC20Mock.new(1, true, true);
    lpGenesisPool = await LPGenesisPoolGame.new(gameMinter.address, erc20Mock.address);
    await ganache.snapshot();
  });

  describe('after deploy default vars', async () => {
    it('should set default owner, minter address and token address after contract deploy', async () => {
      assert.equal(await lpGenesisPool.owner(), owner);
      assert.equal(await lpGenesisPool.gameMinter(), gameMinter.address);
      assert.equal(await lpGenesisPool.token(), erc20Mock.address);
    });
  });

  describe('after deploy default vars', async () => {
    it('should be possible to start a game', async () => {
      const startTime = currentTime + 1;

      assertBNequal(await lpGenesisPool.gameStartTime(), 0);
      assertBNequal(await lpGenesisPool.rewardNeeded(), 0);
      assertBNequal(await lpGenesisPool.width(), 0);
      assert.equal(await lpGenesisPool.url(), '');

      await ganache.setTime(currentTime);

      const result = await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'GameStarted');
      assert.equal(result.logs[0].args.gameStartTime, startTime);
      assert.equal(result.logs[0].args.rewardNeeded, onePoint);

      assertBNequal(await lpGenesisPool.gameStartTime(), startTime);
      assertBNequal(await lpGenesisPool.rewardNeeded(), onePoint);
      assertBNequal(await lpGenesisPool.width(), width);
      assert.equal(await lpGenesisPool.url(), imageUrl);
    });

    it('should NOT be possible to start game for not owner', async () => {
      const startTime = currentTime + 1;

      assertBNequal(await lpGenesisPool.gameStartTime(), 0);
      assertBNequal(await lpGenesisPool.rewardNeeded(), 0);
      assertBNequal(await lpGenesisPool.width(), 0);
      assert.equal(await lpGenesisPool.url(), '');

      await ganache.setTime(currentTime);

      await truffleAssert.reverts(
        lpGenesisPool.start(startTime, onePoint, width, imageUrl, {from: notOwner}),
        'Ownable: caller is not the owner',
      );

      assertBNequal(await lpGenesisPool.gameStartTime(), 0);
      assertBNequal(await lpGenesisPool.rewardNeeded(), 0);
      assertBNequal(await lpGenesisPool.width(), 0);
      assert.equal(await lpGenesisPool.url(), '');
    });

    it('should NOT be possible to start game if already started', async () => {
      const startTime = currentTime + 1;

      assertBNequal(await lpGenesisPool.gameStartTime(), 0);
      assertBNequal(await lpGenesisPool.rewardNeeded(), 0);
      assertBNequal(await lpGenesisPool.width(), 0);
      assert.equal(await lpGenesisPool.url(), '');

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      assertBNequal(await lpGenesisPool.gameStartTime(), startTime);

      await truffleAssert.reverts(
        lpGenesisPool.start(startTime + 1, onePoint, width, imageUrl),
        'Already started',
      );

      assertBNequal(await lpGenesisPool.gameStartTime(), startTime);
    });

    it('should NOT be possible to start game if start time in the past', async () => {
      const startTime = currentTime - 1;

      assertBNequal(await lpGenesisPool.gameStartTime(), 0);
      assertBNequal(await lpGenesisPool.rewardNeeded(), 0);
      assertBNequal(await lpGenesisPool.width(), 0);
      assert.equal(await lpGenesisPool.url(), '');

      await ganache.setTime(currentTime);

      await truffleAssert.reverts(
        lpGenesisPool.start(startTime, onePoint, width, imageUrl),
        'future time to start',
      );

      assertBNequal(await lpGenesisPool.gameStartTime(), 0);
      assertBNequal(await lpGenesisPool.rewardNeeded(), 0);
      assertBNequal(await lpGenesisPool.width(), 0);
      assert.equal(await lpGenesisPool.url(), '');
    });
  });


  // should be possible to stake
  // should not be possible to stake more than 2.02 tokens
  // should not be possible to stake if LP tokens transfer failed (due to low allowance)

  //should return 1 * 1e18 point after holding 2.02 LP tokens on genesis pool contract (earned)
  //should withdraw with removing LP tokens from contract and updating earned points (withdraw)
  //should not be possible to withdraw if nothing was staked.
  //should exit from game without updating earned points (exit)

  //should be possible to play spottheball (redeem) if user has enough earned points for card.
  //should be possible to play spottheball more than 1 time if user has enough earned points for multiple attempts.
  //should NOT be possible to play spottheball if game is not started
  //should NOT be possible to play spottheball if not enough points rewarded.



});

