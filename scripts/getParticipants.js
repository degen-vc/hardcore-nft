require('dotenv').config();

const gameMinter = require('../build/contracts/GameMinter.json');

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(`https://${process.env.ENV}.infura.io/v3/${process.env.INFURA_API_KEY}`));

const minter = new web3.eth.Contract(gameMinter.abi, process.env.GAME_MINTER);

execute();

//WIP!
async function execute() {
  for (let i = 0; i < 1000; i++) {
    // const participant = await gameMinter.getParticipantById(i);
    // console.log(`nft id: ${participant[0]}`);
    const res = await minter.methods.getParticipantsCount().call();
    console.log(res);
    console.log(i);
  }
}





