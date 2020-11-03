require('dotenv').config();
const HDWalletProvider = require("@truffle/hdwallet-provider");
const Web3 = require('web3');

web3 = new Web3();

if (!process.env.GAS_PRICE_GWEI) {
  throw new Error('GAS_PRICE_GWEI is not set in .env file');
}

if (!process.env.INFURA_API_KEY) {
  throw new Error('INFURA_API_KEY is not set in .env file');
}

if (!process.env.PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY is not set in .env file');
}

const gasPrice = web3.utils.toWei(process.env.GAS_PRICE_GWEI, "gwei");

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 12000000,
      gasPrice: 100000000000,
    },
    ropsten: { // truffle deploy --network ropsten --reset
      provider: () => new HDWalletProvider(process.env.PRIVATE_KEY, `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`),
      network_id: 3,
      gasPrice: gasPrice,
      gas: 3000000,
      skipDryRun: true
    },
    kovan: { // truffle deploy --network kovan --reset
      provider: () => new HDWalletProvider(process.env.PRIVATE_KEY, `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`),
      network_id: 42,
      gasPrice: gasPrice,
      gas: 3000000,
      skipDryRun: true,
    },
    mainnet: { // truffle deploy --network mainnet --reset
      provider: () => new HDWalletProvider(process.env.PRIVATE_KEY, `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`),
      network_id: 1,
      gasPrice: gasPrice,
      gas: 3000000,
      skipDryRun: true,
    },
  },
  compilers: {
    solc: {
      version: "0.5.12",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
};
