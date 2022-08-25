//Moola market test on live network
//Hardhat forking is not working with celo network for some reason
//Use npx ganache-cli --fork "https://forno.celo.org" --unlock "0xC32cBaf3D44dA6fbC761289b871af1A30cc7f993"
//to run this test

// Libraries
const BigNumber = require("bignumber.js");
const { assert, artifacts, network } = require("hardhat");
const { DEFAULT_SALT, factoryReceiptToContract } = require("./base");
//constants
const DAYS = 60 * 60 * 24;
// AAVE mainnet addresses
const addressProvider = "0xD1088091A174d33412a968Fa34Cb67131188B332";
const poolAddress = "0x970b12522CA9b4054807a2c5B736149a5BE6f670";
const mTokenAddress = "0x918146359264C492BD6934071c6Bd31C854EDBc3"; // mCUSD
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
//Hijack fat CUSD stack address
const alice = "0xC32cBaf3D44dA6fbC761289b871af1A30cc7f993";

const MoolaMarket = artifacts.require("MoolaMarket");
const Factory = artifacts.require("Factory");
const ERC20 = artifacts.require("ERC20Mock");
const moolaPoolAbi = require("./abi/aavePool");
const mTokenAbi = require("./abi/aToken");

contract("MoolaMarket", accounts => {
  describe("MooolaMarket", () => {
    beforeEach(async () => {
      //await network.provider.request({
      //      method: "hardhat_impersonateAccount",
      //      params: [alice]
      //});
      rewardsTo = accounts[0];
      rescuer = accounts[1];
      // prepare test architecture
      cusd = await ERC20.at(CUSD);
      moolaPool = new web3.eth.Contract(moolaPoolAbi, poolAddress);
      mToken = new web3.eth.Contract(mTokenAbi, mTokenAddress);
      factory = await Factory.new();
      moolaMarketTemplate = await MoolaMarket.new();
      marketReceipt = await factory.createMoolaMarket(
        moolaMarketTemplate.address,
        DEFAULT_SALT,
        addressProvider,
        mTokenAddress,
        rewardsTo,
        rescuer,
        CUSD
      );
      moolaMarket = await factoryReceiptToContract(marketReceipt, MoolaMarket);
    });
    it("deposits funds to the Moola lending pool", async () => {
      let amount = BigNumber(100 * 1e18); //100,000 CUSD
      //check our contract mToken balance
      let bal = await mToken.methods.balanceOf(moolaMarket.address).call();
      console.log("mToken balance before deposit: ", bal / 1e18);
      assert.equal(bal, 0);
      //sending 100,000 CUSD to Moola
      await cusd.transfer(rewardsTo, BigNumber(1000 * 1e18), { from: alice });
      await cusd.approve(moolaMarket.address, amount);
      await moolaMarket.deposit(amount);
      //check our contract mToken balance
      bal = await mToken.methods.balanceOf(moolaMarket.address).call();
      console.log("mToken balance after deposit: ", bal / 1e18);
      //if contract received mTokens, the deposit was successful
      assert.equal(bal, amount * 1);
    });

    it("withdraws funds from the Moola lending pool", async () => {
      let amount = BigNumber(100 * 1e18); //100,000 CUSD
      //check our contract mToken balance
      let bal = await mToken.methods.balanceOf(moolaMarket.address).call();
      assert.equal(bal, 0);
      //sending 100,000 CUSD to Moola
      await cusd.transfer(rewardsTo, BigNumber(1000 * 1e18), { from: alice });
      let balUsdBefore = await cusd.balanceOf(rewardsTo);
      console.log("CUSD balance before deposit: ", balUsdBefore / 1e18);
      console.log("mToken balance before deposit: ", bal / 1e18);
      await cusd.approve(moolaMarket.address, amount);
      await moolaMarket.deposit(amount);
      let balUsd = await cusd.balanceOf(rewardsTo);
      console.log("CUSD balance after deposit: ", balUsd / 1e18);
      //check our contract mToken balance
      bal = await mToken.methods.balanceOf(moolaMarket.address).call();
      console.log("mToken balance after deposit: ", bal / 1e18);
      //if contract received mTokens, the deposit was successful
      assert.equal(bal, amount * 1);

      //withdrawing funds from Moola
      await moolaMarket.withdraw(amount);
      bal = await mToken.methods.balanceOf(moolaMarket.address).call();
      balUsd = await cusd.balanceOf(rewardsTo);
      console.log("CUSD balance after withdraw: ", balUsd / 1e18);
      console.log("mToken balance after withdraw: ", bal / 1e18);
      //check if user's CUSD balance is the same as before the deposit
      assert.equal(balUsd * 1, balUsdBefore * 1);
    });
  });
});
