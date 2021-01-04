const Ganache = require('./helpers/ganache');
const GameMinter = artifacts.require('GameMinter');
const ERC20Mock = artifacts.require('ERC20Mock');
const GenesisPoolGame = artifacts.require('GenesisPoolGame');

const truffleAssert = require('truffle-assertions');

contract('GenesisPoolGame', function(accounts) {
  const ganache = new Ganache(web3);
  afterEach('revert', ganache.revert);

  const bn = (input) => web3.utils.toBN(input);
  const assertBNequal = (bnOne, bnTwo) => assert.equal(bnOne.toString(), bnTwo.toString());

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const ONE_DAY = 86400;

  const owner = accounts[0];
  const notOwner = accounts[1];
  const user = accounts[2];
  const initialFee = 0;
  const feeReceiver = accounts[3];

  const onePoint = '1000000000000000000';
  const oneToken = '1000000000000000000';
  const currentTime = Math.floor(Date.now() / 1000);
  const width = 1800;
  const imageUrl = 'www.image.com';

  const stakeMaxAmount = '65000000000000000000';
  const stakeHalfAmount = '32500000000000000000';

  let gameMinter;
  let erc20Mock;
  let genesisPool;

  before('setup others', async function() {
    gameMinter = await GameMinter.new();
    await gameMinter.init('Spottheball game minter', 'HARDCORE');

    erc20Mock = await ERC20Mock.new(1, true, true);
    genesisPool = await GenesisPoolGame.new(gameMinter.address, erc20Mock.address, feeReceiver, initialFee);
    await gameMinter.addMinter(genesisPool.address);
    await ganache.snapshot();
  });

  describe('after deploy default vars', async () => {
    it('should set default owner, minter address and token address after contract deploy', async () => {
      assert.equal(await genesisPool.owner(), owner);
      assert.equal(await genesisPool.gameMinter(), gameMinter.address);
      assert.equal(await genesisPool.token(), erc20Mock.address);
      assertBNequal(await genesisPool.MAX_STAKE(), stakeMaxAmount);
      assertBNequal(await genesisPool.MAX_ALLOWED_FEE(), '1000000000000000000');
      
    });
  });

  describe('start game', async () => {
    it('should be possible to start a game', async () => {
      const startTime = currentTime + 1;

      assertBNequal(await genesisPool.gameStartTime(), 0);
      assertBNequal(await genesisPool.rewardNeeded(), 0);
      assertBNequal(await genesisPool.width(), 0);
      assert.equal(await genesisPool.url(), '');

      await ganache.setTime(currentTime);

      const result = await genesisPool.start(startTime, onePoint, width, imageUrl);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'GameStarted');
      assert.equal(result.logs[0].args.gameStartTime, startTime);
      assert.equal(result.logs[0].args.rewardNeeded, onePoint);

      assertBNequal(await genesisPool.gameStartTime(), startTime);
      assertBNequal(await genesisPool.rewardNeeded(), onePoint);
      assertBNequal(await genesisPool.width(), width);
      assert.equal(await genesisPool.url(), imageUrl);
    });

    it('should NOT be possible to start game for not owner', async () => {
      const startTime = currentTime + 1;

      assertBNequal(await genesisPool.gameStartTime(), 0);
      assertBNequal(await genesisPool.rewardNeeded(), 0);
      assertBNequal(await genesisPool.width(), 0);
      assert.equal(await genesisPool.url(), '');

      await ganache.setTime(currentTime);

      await truffleAssert.reverts(
        genesisPool.start(startTime, onePoint, width, imageUrl, {from: notOwner}),
        'Ownable: caller is not the owner',
      );

      assertBNequal(await genesisPool.gameStartTime(), 0);
      assertBNequal(await genesisPool.rewardNeeded(), 0);
      assertBNequal(await genesisPool.width(), 0);
      assert.equal(await genesisPool.url(), '');
    });

    it('should NOT be possible to start game if already started', async () => {
      const startTime = currentTime + 1;

      assertBNequal(await genesisPool.gameStartTime(), 0);
      assertBNequal(await genesisPool.rewardNeeded(), 0);
      assertBNequal(await genesisPool.width(), 0);
      assert.equal(await genesisPool.url(), '');

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      assertBNequal(await genesisPool.gameStartTime(), startTime);

      await truffleAssert.reverts(
        genesisPool.start(startTime + 1, onePoint, width, imageUrl),
        'Already started',
      );

      assertBNequal(await genesisPool.gameStartTime(), startTime);
    });

    it('should NOT be possible to start game if start time in the past', async () => {
      const startTime = currentTime - 1;

      assertBNequal(await genesisPool.gameStartTime(), 0);
      assertBNequal(await genesisPool.rewardNeeded(), 0);
      assertBNequal(await genesisPool.width(), 0);
      assert.equal(await genesisPool.url(), '');

      await ganache.setTime(currentTime);

      await truffleAssert.reverts(
        genesisPool.start(startTime, onePoint, width, imageUrl),
        'future time to start',
      );

      assertBNequal(await genesisPool.gameStartTime(), 0);
      assertBNequal(await genesisPool.rewardNeeded(), 0);
      assertBNequal(await genesisPool.width(), 0);
      assert.equal(await genesisPool.url(), '');
    });
  });

  describe('staking', async () => {
    it('should be possible to stake', async () => {
      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      assertBNequal(await genesisPool.balanceOf(user), 0);
      assertBNequal(await genesisPool.totalSupply(), 0);

      const result = await genesisPool.stake(stakeMaxAmount, {from: user});

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Staked');
      assert.equal(result.logs[0].args.user, user);
      assertBNequal(result.logs[0].args.amount, stakeMaxAmount);

      assertBNequal(await genesisPool.balanceOf(user), stakeMaxAmount);
      assertBNequal(await genesisPool.totalSupply(), stakeMaxAmount);

    });

    it('should not be possible to stake more than 2.02 tokens', async () => {
      const startTime = currentTime + 1;
      const moreThanMaxTokens = '66000000000000000000'

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      assertBNequal(await genesisPool.balanceOf(user), 0);
      assertBNequal(await genesisPool.totalSupply(), 0);

      await truffleAssert.reverts(
        genesisPool.stake(moreThanMaxTokens, {from: user}),
        'Cannot stake more than 65 HCORE',
      );

      assertBNequal(await genesisPool.balanceOf(user), 0);
      assertBNequal(await genesisPool.totalSupply(), 0);
    });

    it('should not be possible to stake more than 2.02 tokens when staked in 2 parts', async () => {
      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      assertBNequal(await genesisPool.balanceOf(user), 0);
      assertBNequal(await genesisPool.totalSupply(), 0);

      await genesisPool.stake(stakeMaxAmount, {from: user});

      await truffleAssert.reverts(
        genesisPool.stake(1, {from: user}),
        'Cannot stake more than 65 HCORE',
      );

      assertBNequal(await genesisPool.balanceOf(user), stakeMaxAmount);
      assertBNequal(await genesisPool.totalSupply(), stakeMaxAmount);
    });
  });

  describe('earnings calculations', async () => {
    it('should return 1 * 1e18 point after holding 65 tokens on genesis pool contract (earned)', async () => {
      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await genesisPool.stake(stakeMaxAmount, {from: user});

      assertBNequal(await genesisPool.earned.call(user, {from: user}), 0);

      const stakeTimeAfterOneDay = stakeTime + ONE_DAY;
      await ganache.setTime(stakeTimeAfterOneDay);

      const res = await genesisPool.earned.call(user, {from: user})
      assertBNequal(res, onePoint);
    });

    it('should return 0.5 * 1e18 point after holding 32.5 tokens on genesis pool contract (earned)', async () => {
      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await genesisPool.stake(stakeHalfAmount, {from: user});

      assertBNequal(await genesisPool.earned.call(user, {from: user}), 0);

      const stakeTimeAfterOneDay = stakeTime + ONE_DAY;
      await ganache.setTime(stakeTimeAfterOneDay);

      const res = await genesisPool.earned.call(user, {from: user});
      const halfPoint = '500000000000000000';
      assertBNequal(res, halfPoint);
    });

    it('should return 0.001 * 1e18 point after holding 0.065 (small amount) tokens on genesis pool contract (earned)', async () => {
      const startTime = currentTime + 1;
      const smallTokensAmount = '65000000000000000';

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await genesisPool.stake(smallTokensAmount, {from: user});

      assertBNequal(await genesisPool.earned.call(user, {from: user}), 0);

      const stakeTimeAfterOneDay = stakeTime + ONE_DAY;
      await ganache.setTime(stakeTimeAfterOneDay);

      const res = await genesisPool.earned.call(user, {from: user});
      const smallPointAmount = '1000000000000000';
      assertBNequal(res, smallPointAmount);
    });

    it('should withdraw 50% with removing tokens from contract and updating earned points (withdraw)', async () => {
      const startTime = currentTime + 1;
      const fiftyPercentTokens = '32500000000000000000';

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await genesisPool.stake(stakeMaxAmount, {from: user});

      assertBNequal(await genesisPool.earned.call(user, {from: user}), 0);

      const stakeTimeAfterTwoDays = stakeTime + ONE_DAY * 2;
      await ganache.setTime(stakeTimeAfterTwoDays);

      assertBNequal(await genesisPool.balanceOf(user), stakeMaxAmount);
      assertBNequal(await genesisPool.totalSupply(), stakeMaxAmount);

      const result = await genesisPool.withdraw(fiftyPercentTokens, {from: user});

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Withdrawn');
      assert.equal(result.logs[0].args.user, user);
      assertBNequal(result.logs[0].args.amount, fiftyPercentTokens);

      assertBNequal(await genesisPool.balanceOf(user), fiftyPercentTokens);
      assertBNequal(await genesisPool.totalSupply(), fiftyPercentTokens);

      await ganache.setTime(stakeTimeAfterTwoDays);

      const res = await genesisPool.earned.call(user, {from: user});
      const twoPoints = bn(onePoint).mul(bn(2));
      assertBNequal(res, twoPoints);
    });

    it('should exit from game without updating earned points (exit)', async () => {
      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await genesisPool.stake(stakeMaxAmount, {from: user});

      assertBNequal(await genesisPool.earned.call(user, {from: user}), 0);

      const stakeTimeAfterTwoDays = stakeTime + ONE_DAY * 2;
      await ganache.setTime(stakeTimeAfterTwoDays);

      assertBNequal(await genesisPool.balanceOf(user), stakeMaxAmount);
      assertBNequal(await genesisPool.totalSupply(), stakeMaxAmount);

      const result = await genesisPool.exit({from: user});

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Withdrawn');
      assert.equal(result.logs[0].args.user, user);
      assertBNequal(result.logs[0].args.amount, stakeMaxAmount);

      assertBNequal(await genesisPool.balanceOf(user), 0);
      assertBNequal(await genesisPool.totalSupply(), 0);

      const res = await genesisPool.earned.call(user, {from: user});
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

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await genesisPool.stake(stakeMaxAmount, {from: user});

      const stakeTimeAfterTwoDays = stakeTime + ONE_DAY * 2;
      await ganache.setTime(stakeTimeAfterTwoDays);

      let res = await genesisPool.earned.call(user, {from: user});
      const twoPoints = bn(onePoint).mul(bn(2));
      assertBNequal(res, twoPoints);

      const result = await genesisPool.redeem(x, y, {from: user});

      const id = y * width + x;

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Created');
      assert.equal(result.logs[0].args.user, user);
      assert.equal(result.logs[0].args.id, id);
      assert.equal(result.logs[0].args.x, x);
      assert.equal(result.logs[0].args.y, y);

      res = await genesisPool.earned.call(user, {from: user});
      assertBNequal(res, onePoint);

    });

    it('should be possible to play spottheball more than 1 time if user has enough earned points for multiple attempts.', async () => {

      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await genesisPool.stake(stakeMaxAmount, {from: user});

      const stakeTimeAfterTwoDays = stakeTime + ONE_DAY * 2;
      await ganache.setTime(stakeTimeAfterTwoDays);

      let res = await genesisPool.earned.call(user, {from: user});
      const twoPoints = bn(onePoint).mul(bn(2));
      assertBNequal(res, twoPoints);

      const xOne = 123;
      const yOne = 456;
      const idOne = yOne * width + xOne;

      const result = await genesisPool.redeem(xOne, yOne, {from: user});

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Created');
      assert.equal(result.logs[0].args.user, user);
      assert.equal(result.logs[0].args.id, idOne);
      assert.equal(result.logs[0].args.x, xOne);
      assert.equal(result.logs[0].args.y, yOne);

      res = await genesisPool.earned.call(user, {from: user});
      assertBNequal(res, onePoint);

      const xTwo = 546;
      const yTwo = 888;
      const idTwo = yTwo * width + xTwo;

      const attemptTwo = await genesisPool.redeem(xTwo, yTwo, {from: user});

      assert.equal(attemptTwo.logs.length, 1);
      assert.equal(attemptTwo.logs[0].event, 'Created');
      assert.equal(attemptTwo.logs[0].args.user, user);
      assert.equal(attemptTwo.logs[0].args.id, idTwo);
      assert.equal(attemptTwo.logs[0].args.x, xTwo);
      assert.equal(attemptTwo.logs[0].args.y, yTwo);

      res = await genesisPool.earned.call(user, {from: user});
      assertBNequal(res, 0);

    });

    it('should NOT be possible to play spottheball if game is not started', async () => {
      const x = 123;
      const y = 456;

      await truffleAssert.reverts(
        genesisPool.redeem(x, y, {from: user}),
        'Not started yet',
      );
    });

    it('should NOT be possible to play spottheball if not enough points rewarded.', async () => {
      const x = 123;
      const y = 456;

      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await genesisPool.stake(stakeMaxAmount, {from: user});

      const stakeTimeHalfDay = stakeTime + ONE_DAY / 2;
      await ganache.setTime(stakeTimeHalfDay);

      let res = await genesisPool.earned.call(user, {from: user});
      const halfPoint = bn(onePoint).div(bn(2));
      assertBNequal(res, halfPoint);

      await truffleAssert.reverts(
        genesisPool.redeem(x, y, {from: user}),
        'Not enough points to play',
      );

      res = await genesisPool.earned.call(user, {from: user});
      assertBNequal(res, halfPoint);
    });
  
    it('should be possible to get participants ids', async () => {

      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await genesisPool.stake(stakeMaxAmount, {from: user});

      const stakeTimeAfterTwoDays = stakeTime + ONE_DAY * 2;
      await ganache.setTime(stakeTimeAfterTwoDays);

      let res = await genesisPool.earned.call(user, {from: user});
      const twoPoints = bn(onePoint).mul(bn(2));
      assertBNequal(res, twoPoints);

      const xOne = 123;
      const yOne = 456;
      const idOne = yOne * width + xOne;

      assert.equal(await gameMinter.getParticipantsCount(), 0);

      await genesisPool.redeem(xOne, yOne, {from: user});

      const xTwo = 546;
      const yTwo = 888;
      const idTwo = yTwo * width + xTwo;

      await genesisPool.redeem(xTwo, yTwo, {from: user});

      assert.equal(await gameMinter.getParticipantsCount(), 2);
      const participantOne = await gameMinter.getParticipantById(0);
      assert.equal(participantOne[0], idOne);
      assert.equal(participantOne[1], xOne);
      assert.equal(participantOne[2], yOne);
      assert.equal(participantOne[3], user);

      const participantTwo = await gameMinter.getParticipantById(1);
      assert.equal(participantTwo[0], idTwo);
      assert.equal(participantTwo[1], xTwo);
      assert.equal(participantTwo[2], yTwo);
      assert.equal(participantTwo[3], user);
    });

    it('should be possible to get participants ids in a loop', async () => {

      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      const stakeTime = currentTime + 1;
      await ganache.setTime(stakeTime);

      await genesisPool.stake(stakeMaxAmount, {from: user});

      const stakeTimeAfterTwoDays = stakeTime + ONE_DAY * 2;
      await ganache.setTime(stakeTimeAfterTwoDays);

      let res = await genesisPool.earned.call(user, {from: user});
      const twoPoints = bn(onePoint).mul(bn(2));
      assertBNequal(res, twoPoints);

      const xOne = 123;
      const yOne = 456;

      assert.equal(await gameMinter.getParticipantsCount(), 0);

      await genesisPool.redeem(xOne, yOne, {from: user});

      const xTwo = 546;
      const yTwo = 888;

      await genesisPool.redeem(xTwo, yTwo, {from: user});

      const participantsCount = await gameMinter.getParticipantsCount();

      for (let i = 0; i < participantsCount; i++) {
        const participant = await gameMinter.getParticipantById(i);
        console.log(`nft id: ${participant[0]}`);
      }
    });
  });

  describe('fees', async () => {
    it('set default fee receiver after contract deploy', async () => {
      assert.equal(await genesisPool.nftFund(), feeReceiver);
    });

    it('should be possible to set fee receiver for an owner', async () => {
      const newFeeReceiver = accounts[5];
      assert.equal(await genesisPool.nftFund(), feeReceiver);

      const result = await genesisPool.setNftFund(newFeeReceiver);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'FundUpdated');
      assert.equal(result.logs[0].args.nftFund, newFeeReceiver);

      assert.equal(await genesisPool.nftFund(), newFeeReceiver);
    });

    it('should NOT be possible to set fee receiver for NOT an owner', async () => {
      const newFeeReceiver = accounts[5];
      assert.equal(await genesisPool.nftFund(), feeReceiver);

      await truffleAssert.reverts(
        genesisPool.setNftFund(newFeeReceiver, {from: notOwner}),
        'Ownable: caller is not the owner',
      );
      assert.equal(await genesisPool.nftFund(), feeReceiver);
    });

    it('should NOT be possible to set zero address fee receiver', async () => {
      assert.equal(await genesisPool.nftFund(), feeReceiver);

      await truffleAssert.reverts(
        genesisPool.setNftFund(ZERO_ADDRESS),
        'Zero address not allowed',
      );
      assert.equal(await genesisPool.nftFund(), feeReceiver);
    });

    it('should be possible to set fee for an owner', async () => {
      const fee = 100;
      assertBNequal(await genesisPool.fee(), 0);

      const result = await genesisPool.setFee(fee);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'FeeUpdated');
      assertBNequal(result.logs[0].args.fee, fee);

      assertBNequal(await genesisPool.fee(), fee);
    });

    it('should be possible to set max allowed fee', async () => {
      const maxAllowedFee = bn('1000000000000000000');
      assertBNequal(await genesisPool.fee(), 0);

      const result = await genesisPool.setFee(maxAllowedFee);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'FeeUpdated');
      assertBNequal(result.logs[0].args.fee, maxAllowedFee);

      assertBNequal(await genesisPool.fee(), maxAllowedFee);
    });

    it('should NOT be possible to set fee for NOT an owner', async () => {
      const fee = 100;
      assertBNequal(await genesisPool.fee(), 0);

      await truffleAssert.reverts(
        genesisPool.setFee(fee, {from: notOwner}),
        'Ownable: caller is not the owner',
      );

      assertBNequal(await genesisPool.fee(), 0);
    });

    it('should NOT be possible to set fee more than max allowed', async () => {
      const maxAllowedFee = bn('1000000000000000000');
      assertBNequal(await genesisPool.fee(), 0);

      await truffleAssert.reverts(
        genesisPool.setFee(maxAllowedFee.add(bn(1))),
        'Max fee is 1 HCORE',
      );

      assertBNequal(await genesisPool.fee(), 0);
    });
  });


  describe('staking with fees', async () => {

    it('should send fees on stake step', async () => {
      const fee = bn(onePoint).div(bn(2));
      await genesisPool.setFee(fee);

      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      assertBNequal(await genesisPool.balanceOf(user), 0);
      assertBNequal(await genesisPool.totalSupply(), 0);

      const result = await genesisPool.stake(stakeMaxAmount, {from: user});

      const stakeAmount = bn(stakeMaxAmount).sub(fee);
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Staked');
      assert.equal(result.logs[0].args.user, user);
      assertBNequal(result.logs[0].args.amount, stakeAmount);

      assertBNequal(await genesisPool.balanceOf(user), stakeAmount);
      assertBNequal(await genesisPool.totalSupply(), stakeAmount);

    });

    it('should be possible to stake max amount + fee', async () => {
      const fee = bn(onePoint).div(bn(2));
      const maxWithFee = bn(stakeMaxAmount).add(fee);
      await genesisPool.setFee(fee);

      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      assertBNequal(await genesisPool.balanceOf(user), 0);
      assertBNequal(await genesisPool.totalSupply(), 0);

      const result = await genesisPool.stake(maxWithFee, {from: user});

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'Staked');
      assert.equal(result.logs[0].args.user, user);
      assertBNequal(result.logs[0].args.amount, stakeMaxAmount);

      assertBNequal(await genesisPool.balanceOf(user), stakeMaxAmount);
      assertBNequal(await genesisPool.totalSupply(), stakeMaxAmount);

    });

    it('should NOT be possible to stake max amount + fee + 1 cent', async () => {
      const fee = bn(onePoint).div(bn(2));
      const maxWithFeePlusOne = bn(stakeMaxAmount).add(fee).add(bn(1));
      await genesisPool.setFee(fee);

      const startTime = currentTime + 1;

      await ganache.setTime(currentTime);

      await genesisPool.start(startTime, onePoint, width, imageUrl);

      assertBNequal(await genesisPool.balanceOf(user), 0);
      assertBNequal(await genesisPool.totalSupply(), 0);

      await truffleAssert.reverts(
        genesisPool.stake(maxWithFeePlusOne, {from: user}),
        'Cannot stake more than 65 HCORE',
      );

      assertBNequal(await genesisPool.balanceOf(user), 0);
      assertBNequal(await genesisPool.totalSupply(), 0);

    });
  });
});
