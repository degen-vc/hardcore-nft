require('dotenv').config();
const objectsToCsv = require('objects-to-csv');

const gameMinter = require('../build/contracts/GameMinter.json');

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(`https://${process.env.ENV}.infura.io/v3/${process.env.INFURA_API_KEY}`));

const minter = new web3.eth.Contract(gameMinter.abi, process.env.GAME_MINTER);

execute();

async function execute() {
  let results = [];
  const count = await minter.methods.getParticipantsCount().call();
  console.log(`INFO: total game participants: ${count}`)
  for (let i = 0; i < count; i++) {
    const participant = await minter.methods.getParticipantById(i).call();
    results.push({id: participant[0], address: participant[3], x: participant[1], y: participant[2]})
  }
  const csv = new objectsToCsv(results);
  await csv.toDisk(`./scripts/csv/${process.env.GAME_MINTER}_participants.csv`);
}





