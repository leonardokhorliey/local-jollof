//Aave market test on live network
//Make sure you've enabled ethereum mainnet forking in hardhat.config

// Libraries
const BigNumber = require("bignumber.js");
const { assert, artifacts, network } = require("hardhat");
const { DEFAULT_SALT, factoryReceiptToContract } = require("./base");
//constants
const DAYS = 60 * 60 * 24;
// AAVE mainnet addresses
const addressProvider = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5";
const poolAddress = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
const aTokenAddress = "0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811"; // aUSDT
const aMiningAddress = "0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5";
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
//Hijack fat USDT stack address
const alice = "0x5a52E96BAcdaBb82fd05763E25335261B270Efcb";

const AaveMarket = artifacts.require("AaveMarket");
const Factory = artifacts.require("Factory");
const ERC20 = artifacts.require("ERC20Mock");
const aavePoolAbi = require("./abi/aavePool");
const aTokenAbi = require("./abi/aToken");

contract("AaveMarket", accounts => {
  describe("AaveMarket", () => {
    beforeEach(async () => {
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [alice]
      });
      rewardsTo = accounts[0];
      rescuer = accounts[1];
      // prepare test architecture
      usdt = await ERC20.at(USDT);
      aavePool = new web3.eth.Contract(aavePoolAbi, poolAddress);
      aToken = new web3.eth.Contract(aTokenAbi, aTokenAddress);
      factory = await Factory.new();
      aaveMarketTemplate = await AaveMarket.new();
      marketReceipt = await factory.createAaveMarket(
        aaveMarketTemplate.address,
        DEFAULT_SALT,
        addressProvider,
        aTokenAddress,
        aMiningAddress,
        rewardsTo,
        rescuer,
        USDT
      );
      aaveMarket = await factoryReceiptToContract(marketReceipt, AaveMarket);
    });
    it("deposits funds to the Aave lending pool", async () => {
      let amount = 100000 * 1e6; //100,000 USDT
      //check our contract aToken balance
      let bal = await aToken.methods.balanceOf(aaveMarket.address).call();
      console.log("aToken balance before deposit: ", bal * 1);
      assert.equal(bal, 0);
      //sending 100,000 USDT to aave
      await usdt.transfer(rewardsTo, 1000000 * 1e6, { from: alice });
      await usdt.approve(aaveMarket.address, amount);
      await aaveMarket.deposit(amount);
      //check our contract aToken balance
      bal = await aToken.methods.balanceOf(aaveMarket.address).call();
      console.log("aToken balance after deposit: ", bal * 1);
      //if contract received aTokens, the deposit was successful
      assert.equal(bal, amount);
    });

    it("withdraws funds from the Aave lending pool", async () => {
      let amount = 100000 * 1e6; //100,000 USDT
      //check our contract aToken balance
      let bal = await aToken.methods.balanceOf(aaveMarket.address).call();
      assert.equal(bal, 0);
      //sending 100,000 USDT to aave
      await usdt.transfer(rewardsTo, 1000000 * 1e6, { from: alice });
      let balUsdBefore = await usdt.balanceOf(rewardsTo);
      console.log("USDT balance before deposit: ", balUsdBefore * 1);
      console.log("aToken balance before deposit: ", bal * 1);
      await usdt.approve(aaveMarket.address, amount);
      await aaveMarket.deposit(amount);
      let balUsd = await usdt.balanceOf(rewardsTo);
      console.log("USDT balance after deposit: ", balUsd * 1);
      //check our contract aToken balance
      bal = await aToken.methods.balanceOf(aaveMarket.address).call();
      console.log("aToken balance after deposit: ", bal * 1);
      //if contract received aTokens, the deposit was successful
      assert.equal(bal, amount);

      //withdrawing funds from aave
      await aaveMarket.withdraw(amount);
      bal = await aToken.methods.balanceOf(aaveMarket.address).call();
      balUsd = await usdt.balanceOf(rewardsTo);
      console.log("USDT balance after withdraw: ", balUsd * 1);
      console.log("aToken balance after withdraw: ", bal * 1);
      //check if user's USDT balance is the same as before the deposit
      assert.equal(balUsd * 1, balUsdBefore * 1);
    });
  });
});
