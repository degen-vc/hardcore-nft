require('dotenv').config();
const delay = require('delay');

const GameMinter = artifacts.require('GameMinter');
const GenesisPoolGame = artifacts.require('GenesisPoolGame');

if (!process.env.ERC_20) {
  throw new Error('ERC_20 is not set in .env file');
}

if (!process.env.NFT_FUND) {
  throw new Error('NFT_FUND is not set in .env file');
}

if (!process.env.FEE_IN_WEI) {
  throw new Error('FEE_IN_WEI is not set in .env file');
}

const ERC20Address = process.env.ERC_20;
const nftFundAddress = process.env.NFT_FUND;
const feeWei = process.env.FEE_IN_WEI;
const nextOwner = process.env.NEXT_OWNER;

const wait = async (param) => {console.log(`Mined: ${param}`); await delay(5000);};

module.exports = async function (deployer, network) {

  if (network == 'development') {
    return;
  }

  await deployer.deploy(GameMinter);
  const gameMinter = await GameMinter.deployed();
  await wait(`Game minter contract mined ${gameMinter.address}`);

  await gameMinter.init("Spottheball game minter", "HARDCORE");
  await wait('minter contract inited');

  await deployer.deploy(GenesisPoolGame, gameMinter.address, ERC20Address, nftFundAddress, feeWei);
  const genesisPool = await GenesisPoolGame.deployed();
  await wait(`genesis pool contract contract mined ${genesisPool.address}`);

  await gameMinter.addMinter(genesisPool.address);

  await wait('minter added');

  if (nextOwner) {
    await gameMinter.addWhitelistAdmin(nextOwner);

    await genesisPool.transferOwnership(nextOwner);

    await gameMinter.transferOwnership(nextOwner);

    await wait(`contracts ownership transferred to ${nextOwner}`);

  }
}
