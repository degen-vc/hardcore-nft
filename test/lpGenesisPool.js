const Ganache = require('./helpers/ganache');
const GameMinter = artifacts.require('GameMinter');
const ERC20Mock = artifacts.require('ERC20Mock');
const LPGenesisPoolGame = artifacts.require('LPGenesisPoolGame');

const truffleAssert = require('truffle-assertions');

contract('GameMinter', function(accounts) {
  const ganache = new Ganache(web3);
  afterEach('revert', ganache.revert);

  const bn = (input) => web3.utils.toBN(input);
  const assertBNequal = (bnOne, bnTwo) => assert.equal(bnOne.toString(), bnTwo.toString());

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const ONE_DAY = 86400;

  const owner = accounts[0];
  const notOwner = accounts[1];
  const user = accounts[2];

  const onePoint = '1000000000000000000';
  const currentTime = Math.floor(Date.now() / 1000);
  const width = 1800;
  const imageUrl = 'www.image.com';

  const stakeMaxAmount = '2020000000000000000';
  const stakeHalfAmount = '1010000000000000000';

  let gameMinter;
  let erc20Mock;
  let lpGenesisPool;

  before('setup others', async function() {
    gameMinter = await GameMinter.new();
    await gameMinter.init('Spottheball game minter', 'HARDCORE');

    erc20Mock = await ERC20Mock.new(1, true, true);
    lpGenesisPool = await LPGenesisPoolGame.new(gameMinter.address, erc20Mock.address);
    await gameMinter.addMinter(lpGenesisPool.address);
    await ganache.snapshot();
  });

  describe('after deploy default vars', async () => {
    it('should set default owner, minter address and token address after contract deploy', async () => {
      assert.equal(await lpGenesisPool.owner(), owner);
      assert.equal(await lpGenesisPool.gameMinter(), gameMinter.address);
      assert.equal(await lpGenesisPool.token(), erc20Mock.address);
      assertBNequal(await lpGenesisPool.MAX_STAKE(), stakeMaxAmount);
    });
  });

  describe('start game', async () => {
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

  describe('staking', async () => {
    it('should be possible to stake', async () => {
      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      assertBNequal(await lpGenesisPool.balanceOf(user), 0);
      assertBNequal(await lpGenesisPool.totalSupply(), 0);

      const result = await lpGenesisPool.stake(stakeMaxAmount, {from: user});

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Staked');
      assert.equal(result.logs[0].args.user, user);
      assertBNequal(result.logs[0].args.amount, stakeMaxAmount);

      assertBNequal(await lpGenesisPool.balanceOf(user), stakeMaxAmount);
      assertBNequal(await lpGenesisPool.totalSupply(), stakeMaxAmount);

    });

    it('should not be possible to stake more than 2.02 tokens', async () => {
      const startTime = currentTime + 1;
      const threeLPtokens = '3000000000000000000'

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      assertBNequal(await lpGenesisPool.balanceOf(user), 0);
      assertBNequal(await lpGenesisPool.totalSupply(), 0);

      await truffleAssert.reverts(
        lpGenesisPool.stake(threeLPtokens, {from: user}),
        'Cannot stake more than 2.02 UNI-V2 LP',
      );

      assertBNequal(await lpGenesisPool.balanceOf(user), 0);
      assertBNequal(await lpGenesisPool.totalSupply(), 0);
    });

    it('should not be possible to stake more than 2.02 tokens when staked in 2 parts', async () => {
      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      assertBNequal(await lpGenesisPool.balanceOf(user), 0);
      assertBNequal(await lpGenesisPool.totalSupply(), 0);

      await lpGenesisPool.stake(stakeMaxAmount, {from: user});

      await truffleAssert.reverts(
        lpGenesisPool.stake(1, {from: user}),
        'Cannot stake more than 2.02 UNI-V2 LP',
      );

      assertBNequal(await lpGenesisPool.balanceOf(user), stakeMaxAmount);
      assertBNequal(await lpGenesisPool.totalSupply(), stakeMaxAmount);
    });
  });

  describe('earnings calculations', async () => {
    it('should return 1 * 1e18 point after holding 2.02 LP tokens on genesis pool contract (earned)', async () => {
      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await lpGenesisPool.stake(stakeMaxAmount, {from: user});

      assertBNequal(await lpGenesisPool.earned.call(user, {from: user}), 0);

      const stakeTimeAfterOneDay = stakeTime + ONE_DAY;
      await ganache.setTime(stakeTimeAfterOneDay);

      const res = await lpGenesisPool.earned.call(user, {from: user})
      assertBNequal(res, onePoint);
    });

    it('should return 0.5 * 1e18 point after holding 1.01 LP tokens on genesis pool contract (earned)', async () => {
      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await lpGenesisPool.stake(stakeHalfAmount, {from: user});

      assertBNequal(await lpGenesisPool.earned.call(user, {from: user}), 0);

      const stakeTimeAfterOneDay = stakeTime + ONE_DAY;
      await ganache.setTime(stakeTimeAfterOneDay);

      const res = await lpGenesisPool.earned.call(user, {from: user});
      const halfPoint = '500000000000000000';
      assertBNequal(res, halfPoint);
    });

    it('should return 0.005 * 1e18 point after holding 0.0101 (small amount) LP tokens on genesis pool contract (earned)', async () => {
      const startTime = currentTime + 1;
      const smallLPAmount = '10100000000000000';

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await lpGenesisPool.stake(smallLPAmount, {from: user});

      assertBNequal(await lpGenesisPool.earned.call(user, {from: user}), 0);

      const stakeTimeAfterOneDay = stakeTime + ONE_DAY;
      await ganache.setTime(stakeTimeAfterOneDay);

      const res = await lpGenesisPool.earned.call(user, {from: user});
      const smallPointAmount = '5000000000000000';
      assertBNequal(res, smallPointAmount);
    });

    it('should withdraw 50% with removing LP tokens from contract and updating earned points (withdraw)', async () => {
      const startTime = currentTime + 1;
      const fiftyPercentLP = '1010000000000000000';

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await lpGenesisPool.stake(stakeMaxAmount, {from: user});

      assertBNequal(await lpGenesisPool.earned.call(user, {from: user}), 0);

      const stakeTimeAfterTwoDays = stakeTime + ONE_DAY * 2;
      await ganache.setTime(stakeTimeAfterTwoDays);

      assertBNequal(await lpGenesisPool.balanceOf(user), stakeMaxAmount);
      assertBNequal(await lpGenesisPool.totalSupply(), stakeMaxAmount);

      const result = await lpGenesisPool.withdraw(fiftyPercentLP, {from: user});

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Withdrawn');
      assert.equal(result.logs[0].args.user, user);
      assertBNequal(result.logs[0].args.amount, fiftyPercentLP);

      assertBNequal(await lpGenesisPool.balanceOf(user), fiftyPercentLP);
      assertBNequal(await lpGenesisPool.totalSupply(), fiftyPercentLP);

      const res = await lpGenesisPool.earned.call(user, {from: user});
      const twoPoints = bn(onePoint).mul(bn(2));
      assertBNequal(res, twoPoints);
    });

    it('should exit from game without updating earned points (exit)', async () => {
      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await lpGenesisPool.stake(stakeMaxAmount, {from: user});

      assertBNequal(await lpGenesisPool.earned.call(user, {from: user}), 0);

      const stakeTimeAfterTwoDays = stakeTime + ONE_DAY * 2;
      await ganache.setTime(stakeTimeAfterTwoDays);

      assertBNequal(await lpGenesisPool.balanceOf(user), stakeMaxAmount);
      assertBNequal(await lpGenesisPool.totalSupply(), stakeMaxAmount);

      const result = await lpGenesisPool.exit({from: user});

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Withdrawn');
      assert.equal(result.logs[0].args.user, user);
      assertBNequal(result.logs[0].args.amount, stakeMaxAmount);

      assertBNequal(await lpGenesisPool.balanceOf(user), 0);
      assertBNequal(await lpGenesisPool.totalSupply(), 0);

      const res = await lpGenesisPool.earned.call(user, {from: user});
      const twoPoints = bn(onePoint).mul(bn(2));
      assertBNequal(res, twoPoints);
    });
  });

  describe('redeem', async () => {
    it('should be possible to play spottheball (redeem) if user has enough earned points for card.', async () => {
      const x = 123;
      const y = 456;

      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await lpGenesisPool.stake(stakeMaxAmount, {from: user});

      const stakeTimeAfterTwoDays = stakeTime + ONE_DAY * 2;
      await ganache.setTime(stakeTimeAfterTwoDays);

      let res = await lpGenesisPool.earned.call(user, {from: user});
      const twoPoints = bn(onePoint).mul(bn(2));
      assertBNequal(res, twoPoints);

      const result = await lpGenesisPool.redeem(x, y, {from: user});

      const id = y * width + x;

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Created');
      assert.equal(result.logs[0].args.user, user);
      assert.equal(result.logs[0].args.id, id);
      assert.equal(result.logs[0].args.x, x);
      assert.equal(result.logs[0].args.y, y);

      res = await lpGenesisPool.earned.call(user, {from: user});
      assertBNequal(res, onePoint);

    });

    it('should be possible to play spottheball more than 1 time if user has enough earned points for multiple attempts.', async () => {

      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await lpGenesisPool.stake(stakeMaxAmount, {from: user});

      const stakeTimeAfterTwoDays = stakeTime + ONE_DAY * 2;
      await ganache.setTime(stakeTimeAfterTwoDays);

      let res = await lpGenesisPool.earned.call(user, {from: user});
      const twoPoints = bn(onePoint).mul(bn(2));
      assertBNequal(res, twoPoints);

      const xOne = 123;
      const yOne = 456;
      const idOne = yOne * width + xOne;

      const result = await lpGenesisPool.redeem(xOne, yOne, {from: user});

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Created');
      assert.equal(result.logs[0].args.user, user);
      assert.equal(result.logs[0].args.id, idOne);
      assert.equal(result.logs[0].args.x, xOne);
      assert.equal(result.logs[0].args.y, yOne);

      res = await lpGenesisPool.earned.call(user, {from: user});
      assertBNequal(res, onePoint);

      const xTwo = 546;
      const yTwo = 888;
      const idTwo = yTwo * width + xTwo;

      const attemptTwo = await lpGenesisPool.redeem(xTwo, yTwo, {from: user});

      assert.equal(attemptTwo.logs.length, 1);
      assert.equal(attemptTwo.logs[0].event, 'Created');
      assert.equal(attemptTwo.logs[0].args.user, user);
      assert.equal(attemptTwo.logs[0].args.id, idTwo);
      assert.equal(attemptTwo.logs[0].args.x, xTwo);
      assert.equal(attemptTwo.logs[0].args.y, yTwo);

      res = await lpGenesisPool.earned.call(user, {from: user});
      assertBNequal(res, 0);

    });

    it('should NOT be possible to play spottheball if game is not started', async () => {
      const x = 123;
      const y = 456;

      await truffleAssert.reverts(
        lpGenesisPool.redeem(x, y, {from: user}),
        'Not started yet',
      );
    });

    it('should NOT be possible to play spottheball if not enough points rewarded.', async () => {
      const x = 123;
      const y = 456;

      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await lpGenesisPool.stake(stakeMaxAmount, {from: user});

      const stakeTimeHalfDay = stakeTime + ONE_DAY / 2;
      await ganache.setTime(stakeTimeHalfDay);

      let res = await lpGenesisPool.earned.call(user, {from: user});
      const halfPoint = bn(onePoint).div(bn(2));
      assertBNequal(res, halfPoint);

      await truffleAssert.reverts(
        lpGenesisPool.redeem(x, y, {from: user}),
        'Not enough points to play',
      );

      res = await lpGenesisPool.earned.call(user, {from: user});
      assertBNequal(res, halfPoint);
    });
  
    it('should be possible to get participants ids', async () => {

      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await lpGenesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await lpGenesisPool.stake(stakeMaxAmount, {from: user});

      const stakeTimeAfterTwoDays = stakeTime + ONE_DAY * 2;
      await ganache.setTime(stakeTimeAfterTwoDays);

      let res = await lpGenesisPool.earned.call(user, {from: user});
      const twoPoints = bn(onePoint).mul(bn(2));
      assertBNequal(res, twoPoints);

      const xOne = 123;
      const yOne = 456;
      const idOne = yOne * width + xOne;

      assert.equal((await gameMinter.getParticipants()).length, 0);

      await lpGenesisPool.redeem(xOne, yOne, {from: user});

      const xTwo = 546;
      const yTwo = 888;
      const idTwo = yTwo * width + xTwo;

      await lpGenesisPool.redeem(xTwo, yTwo, {from: user});

      assert.equal((await gameMinter.getParticipants()).length, 2);
      const participators = await gameMinter.getParticipants();
      assert.equal(participators[0].id, idOne);
      assert.equal(participators[0].x, xOne);
      assert.equal(participators[0].y, yOne);
      assert.equal(participators[1].id, idTwo);
      assert.equal(participators[1].x, xTwo);
      assert.equal(participators[1].y, yTwo);
    });

  });
});
