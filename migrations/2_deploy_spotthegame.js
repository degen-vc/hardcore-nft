require('dotenv').config();
const delay = require('delay');

const GameMinter = artifacts.require('GameMinter');
const LPGenesisPoolGame = artifacts.require('LPGenesisPoolGame');

if (!process.env.LP_ERC_20) {
  throw new Error('LP_ERC_20 is not set in .env file');
}

const lpERC20Address = process.env.LP_ERC_20;
const nextOwner = process.env.NEXT_OWNER;

const wait = async (param) => {console.log(`Mined: ${param}`); await delay(10000);};

module.exports = async function (deployer, network) {

  if (network == 'development') {
    return;
  }

  await deployer.deploy(GameMinter);
  const gameMinter = await GameMinter.deployed();
  await wait(`Game minter contract mined ${gameMinter.address}`);

  await deployer.deploy(LPGenesisPoolGame, gameMinter.address, lpERC20Address);
  const lpGenesisPool = await LPGenesisPoolGame.deployed();
  await wait(`LP genesis pool contract contract mined ${lpGenesisPool.address}`);

  await gameMinter.addMinter(lpGenesisPool.address);

  await wait('minter added');

  if (nextOwner) {
    await gameMinter.addWhitelistAdmin(nextOwner);

    await lpGenesisPool.transferOwnership(nextOwner);

    await gameMinter.transferOwnership(nextOwner);

    await wait(`contracts ownership transferred to ${nextOwner}`);

  }
}
