const express = require('express');
const http = require("http");
const fileupload = require("express-fileupload");
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose')
const dotenv = require('dotenv');
const nftList = require('./nftList.json');
const { PublicKey, SystemProgram } = require('@solana/web3.js');
const { Program, Provider, web3, BN } = require('@project-serum/anchor');
const idl = require("./public/gem_farm.json")
const bankidl = require("./public/gem_bank.json")
const { findFarmerPDA, findWhitelistProofPDA, stringifyPKsAndBNs } = require('@gemworks/gem-farm-ts');

dotenv.config();
const app = express();
  
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());
app.use(fileupload());

app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + "/files"));

const programId = new PublicKey('farmL4xeBFVXJqtfxCzU9b28QACM7E2W2ctT6epAjvE')
const bankprogramId = new PublicKey('bankHHdqMuaaST4qQk6mkzxGeKPHWmqdgor6Gs8r88m');
const connection = new web3.Connection(web3.clusterApiUrl("mainnet-beta"));

console.log(new Uint8Array(process.env.SERVER_ADMIN_SERCRET), "secret")

const walletKeyPair = web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.SERVER_ADMIN_SERCRET)));

const opts = {
    preflightCommitment: "processed"
}

async function getProvider() {
    const provider = new Provider(
        connection, walletKeyPair, opts.preflightCommitment,
    );
    return provider;
}

const  nftAllow = async() => {
  const provider = await getProvider()
  const program = new Program(idl, programId, provider);
  const farmdata = await program.account.farm.fetch(new PublicKey(process.env.SERVER_FARM_ID))
  const farm =new PublicKey(process.env.SERVER_FARM_ID) ;
  const farmManager = walletKeyPair.publicKey;
  const signers = [farmManager]
  for(let j=0;j<=(nftList.length)/10-1;j++){
    let instructions1 = [];  
    for(let i=10*j; i<(j+1)*10;i++){
      const [whitelistProof, whitelistProofBump] = await findWhitelistProofPDA(farmdata.bank, new PublicKey(nftList[i]));
      const addressToWhitelist = new PublicKey(nftList[i]);
      instructions1.push(
        program.instruction.addToBankWhitelist(farmdata.farmAuthorityBumpSeed,2,{
          accounts:{
            farm,
            farmManager,
            farmAuthority: farmdata.farmAuthority,
            bank:farmdata.bank,
            addressToWhitelist,
            whitelistProof,
            systemProgram:SystemProgram.programId,
            gemBank:bankprogramId,
          },signers
        })
        )
    }
    try{
      setTimeout(async() => {
        const transaction = new web3.Transaction().add(...instructions1);
        web3.sendAndConfirmTransaction(
          connection,
          transaction,
          [walletKeyPair]
        );
        console.log(`success${j}`)
      },j*1000)
    }catch(e){
    }
  }

  let instructions = [];  
  for(let i=nftList.length-1;i>=(nftList.length)-(nftList.length)%10 ;i--){
      const [whitelistProof, whitelistProofBump] = await findWhitelistProofPDA(farmdata.bank, new PublicKey(nftList[i]));
      const addressToWhitelist = new PublicKey(nftList[i]);
      instructions.push(
        program.instruction.addToBankWhitelist(farmdata.farmAuthorityBumpSeed,2,{
          accounts:{
            farm,
            farmManager,
            farmAuthority: farmdata.farmAuthority,
            bank:farmdata.bank,
            addressToWhitelist,
            whitelistProof,
            systemProgram:SystemProgram.programId,
            gemBank:bankprogramId,
          },signers
        })
        )
  }
    try{
      const transaction = new web3.Transaction().add(...instructions);
      await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [walletKeyPair]
      );
      console.log(`success`)
    }catch(e){
    }
}

nftAllow()

const server = http.createServer(app);

server.listen(process.env.SERVER_PORT, () => console.log(`Listening on port ${process.env.SERVER_PORT}`));