const Ganache = require('./helpers/ganache');
const GameMinter = artifacts.require('GameMinter');

const truffleAssert = require('truffle-assertions');

contract('GameMinter', function(accounts) {
  const ganache = new Ganache(web3);
  afterEach('revert', ganache.revert);

  const bn = (input) => web3.utils.toBN(input);
  const assertBNequal = (bnOne, bnTwo) => assert.equal(bnOne.toString(), bnTwo.toString());

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  const owner = accounts[0];
  const defaultUri = 'https://lambo.hcore.finance/spot-the-ball-win/#home';

  let gameMinter;

  before('setup others', async function() {
    gameMinter = await GameMinter.new();
    await gameMinter.init('Spottheball game minter', 'HARDCORE');
    await ganache.snapshot();
  });

  describe('after deploy default vars', async () => {
    it('should set default owner after contract deploy', async () => {
      assert.equal(await gameMinter.owner(), owner);
    });

    it('should set default symbol and name after contract deploy', async () => {
      assert.equal(await gameMinter.name(), 'Spottheball game minter');
      assert.equal(await gameMinter.symbol(), 'HARDCORE');
    });

    it('should return valid URL and URL id', async () => {
      assert.equal(await gameMinter.uri(), defaultUri);
      assert.equal(await gameMinter.uri(1), defaultUri);
    });

  });

  describe('adding/removing admin/minter roles', async () => {
    it('should be possible to add minter', async () => {
      const minter = accounts[1];

      assert.equal(await gameMinter.isMinter(minter), false);
      const result = await gameMinter.addMinter(minter);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'MinterAdded');
      assert.equal(result.logs[0].args.account, minter);

      assert.equal(await gameMinter.isMinter(minter), true);
    });

    it('should NOT be possible to add minter for user without minter role', async () => {
      const minter = accounts[1];
      const notMinter = accounts[2];

      assert.equal(await gameMinter.isMinter(minter), false);
      
      await truffleAssert.reverts(
        gameMinter.addMinter(minter, {from: notMinter}),
        'MinterRole: caller does not have the Minter role',
      );
      assert.equal(await gameMinter.isMinter(minter), false);
    });

    it('should be possible to remove minter', async () => {
      const minter = accounts[1];

      await gameMinter.addMinter(minter);

      assert.equal(await gameMinter.isMinter(minter), true);
      const result = await gameMinter.removeMinter(minter);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'MinterRemoved');
      assert.equal(result.logs[0].args.account, minter);
      assert.equal(await gameMinter.isMinter(minter), false);
    });

    it('should be possible to add whitelist admin', async () => {
      const admin = accounts[1];

      assert.equal(await gameMinter.isWhitelistAdmin(admin), false);
      const result = await gameMinter.addWhitelistAdmin(admin);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'WhitelistAdminAdded');
      assert.equal(result.logs[0].args.account, admin);

      assert.equal(await gameMinter.isWhitelistAdmin(admin), true);
    });

    it('should NOT be possible to add whitelist admin for user without whitelist admin role', async () => {
      const admin = accounts[1];
      const notAdmin = accounts[2];

      assert.equal(await gameMinter.isWhitelistAdmin(admin), false);

      await truffleAssert.reverts(
        gameMinter.addWhitelistAdmin(admin, {from: notAdmin}),
        'WhitelistAdminRole: caller does not have the WhitelistAdmin role',
      );
      assert.equal(await gameMinter.isWhitelistAdmin(admin), false);
    });

    it('should be possible to remove whitelist admin', async () => {
      const admin = accounts[1];

      await gameMinter.addWhitelistAdmin(admin);

      assert.equal(await gameMinter.isWhitelistAdmin(admin), true);
      const result = await gameMinter.removeWhitelistAdmin(admin);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'WhitelistAdminRemoved');
      assert.equal(result.logs[0].args.account, admin);

      assert.equal(await gameMinter.isWhitelistAdmin(admin), false);
    });

    it('should be possible to add setBaseMetadataURI for whitelist admin', async () => {
      const newUri = 'new_uri';

      assert.equal(await gameMinter.uri(), defaultUri);
      assert.equal(await gameMinter.uri(1), defaultUri);

      await gameMinter.setBaseMetadataURI(newUri);

      assert.equal(await gameMinter.uri(), newUri);
      assert.equal(await gameMinter.uri(1), newUri);
    });

    it('should NOT be possible to add setBaseMetadataURI for NOT whitelist admin', async () => {
      const newUri = 'new_uri';
      const notAdmin = accounts[2];

      assert.equal(await gameMinter.uri(), defaultUri);
      assert.equal(await gameMinter.uri(1), defaultUri);

      await truffleAssert.reverts(
        gameMinter.setBaseMetadataURI(newUri, {from: notAdmin}),
        'WhitelistAdminRole: caller does not have the WhitelistAdmin role',
      );

      assert.equal(await gameMinter.uri(), defaultUri);
      assert.equal(await gameMinter.uri(1), defaultUri);
    });

  });


  describe('token create', async () => {
    it('should be possible to create a token for user with minter role', async () => {
      const tokenId = 10;
      const maxSupply = 1;
      const initialSupply = 1;
      const creator = accounts[2];

      assert.equal(await gameMinter.creators(tokenId), ZERO_ADDRESS);
      assert.equal(await gameMinter.totalSupply(tokenId), 0);
      assert.equal(await gameMinter.maxSupply(tokenId), 0);
      assert.equal(await gameMinter.balanceOf(creator, tokenId), 0);

      const result = await gameMinter.create(creator, maxSupply, initialSupply, tokenId, '0x');

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'TransferSingle');
      assert.equal(result.logs[0].args._operator, owner);
      assert.equal(result.logs[0].args._from, ZERO_ADDRESS);
      assert.equal(result.logs[0].args._to, creator);
      assert.equal(result.logs[0].args._id, tokenId);
      assert.equal(result.logs[0].args._amount, initialSupply);

      assert.equal(await gameMinter.creators(tokenId), creator);
      assert.equal(await gameMinter.totalSupply(tokenId), initialSupply);
      assert.equal(await gameMinter.maxSupply(tokenId), maxSupply);
      assert.equal(await gameMinter.balanceOf(creator, tokenId), initialSupply);

    });

    it('should NOT be possible to create a token for user without a minter role', async () => {
      const tokenId = 10;
      const maxSupply = 1;
      const initialSupply = 1;
      const creator = accounts[2];
      const notMinter = accounts[3];

      assert.equal(await gameMinter.creators(tokenId), ZERO_ADDRESS);
      assert.equal(await gameMinter.totalSupply(tokenId), 0);
      assert.equal(await gameMinter.maxSupply(tokenId), 0);
      assert.equal(await gameMinter.balanceOf(creator, tokenId), 0);

      await truffleAssert.reverts(
        gameMinter.create(creator, maxSupply, initialSupply, tokenId, '0x', {from: notMinter}),
        'MinterRole: caller does not have the Minter role',
      );

      assert.equal(await gameMinter.creators(tokenId), ZERO_ADDRESS);
      assert.equal(await gameMinter.totalSupply(tokenId), 0);
      assert.equal(await gameMinter.maxSupply(tokenId), 0);
      assert.equal(await gameMinter.balanceOf(creator, tokenId), 0);
    });

    it('should NOT allow to create token if maxSupply is less than initialSupply', async () => {
      const tokenId = 10;
      const maxSupply = 1;
      const initialSupply = 2;
      const creator = accounts[2];

      assert.equal(await gameMinter.creators(tokenId), ZERO_ADDRESS);
      assert.equal(await gameMinter.totalSupply(tokenId), 0);
      assert.equal(await gameMinter.maxSupply(tokenId), 0);
      assert.equal(await gameMinter.balanceOf(creator, tokenId), 0);

      await truffleAssert.reverts(
        gameMinter.create(creator, maxSupply, initialSupply, tokenId, '0x'),
        'Initial supply cannot be more than max supply',
      );

      assert.equal(await gameMinter.creators(tokenId), ZERO_ADDRESS);
      assert.equal(await gameMinter.totalSupply(tokenId), 0);
      assert.equal(await gameMinter.maxSupply(tokenId), 0);
      assert.equal(await gameMinter.balanceOf(creator, tokenId), 0);
    });

    it('should NOT be possible to create token if provided id is not unique', async () => {
      const tokenId = 10;
      const maxSupply = 1;
      const initialSupply = 1;
      const creator = accounts[2];

      assert.equal(await gameMinter.creators(tokenId), ZERO_ADDRESS);
      assert.equal(await gameMinter.totalSupply(tokenId), 0);
      assert.equal(await gameMinter.maxSupply(tokenId), 0);
      assert.equal(await gameMinter.balanceOf(creator, tokenId), 0);

      await gameMinter.create(creator, maxSupply, initialSupply, tokenId, '0x');

      await truffleAssert.reverts(
        gameMinter.create(creator, maxSupply, initialSupply, tokenId, '0x'),
        'Id already used',
      );

      assert.equal(await gameMinter.creators(tokenId), creator);
      assert.equal(await gameMinter.totalSupply(tokenId), initialSupply);
      assert.equal(await gameMinter.maxSupply(tokenId), maxSupply);
      assert.equal(await gameMinter.balanceOf(creator, tokenId), initialSupply);

    });
    

  });


});

