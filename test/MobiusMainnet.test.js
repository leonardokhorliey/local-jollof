//Mobius market test on live network
//Run ganache-cli --fork "https://forno.celo.org" --unlock "0xC32cBaf3D44dA6fbC761289b871af1A30cc7f993"
//in the background
//Run test npx hardhat test test/MobiusMainnet.test.js --network ganache

// Libraries
const BigNumber = require("bignumber.js");
const { assert, artifacts, network } = require("hardhat");
const {
  DEFAULT_SALT,
  factoryReceiptToContract,
  latestBlockTimestamp,
  timeTravel
} = require("./base");
//constants
const DAYS = 60 * 60 * 24;
const YEAR_IN_SEC = DAYS * 365;
const STABLECOIN_DECIMALS = 18;
const STABLECOIN_PRECISION = 1e18;
const PRECISION = 1e18;
const INIT_INTEREST_RATE = 0.1; // 10% APY
const DevRewardMultiplier = BigNumber(0.1 * PRECISION).toFixed();
const GovRewardMultiplier = BigNumber(0.1 * PRECISION).toFixed();
const MINTER_BURNER_ROLE = web3.utils.soliditySha3("MINTER_BURNER_ROLE");
const DIVIDEND_ROLE = web3.utils.soliditySha3("DIVIDEND_ROLE");
const WHITELISTER_ROLE = web3.utils.soliditySha3("WHITELISTER_ROLE");
const WHITELISTED_POOL_ROLE = web3.utils.soliditySha3("WHITELISTED_POOL_ROLE");
const CONVERTER_ROLE = web3.utils.soliditySha3("CONVERTER_ROLE");
const dailyConvertLimit = BigNumber(10000 * PRECISION);
const INF = (module.exports.INF = BigNumber(2)
  .pow(256)
  .minus(1)
  .toFixed());
const interestFee = BigNumber(0.2 * PRECISION).toFixed();
const earlyWithdrawFee = BigNumber(0.005 * PRECISION).toFixed();
const multiplierIntercept = BigNumber(0.5 * PRECISION).toFixed();
const multiplierSlope = BigNumber((0.25 / YEAR_IN_SEC) * PRECISION)
  .integerValue()
  .toFixed();
const EMAUpdateInterval = 24 * 60 * 60;
const EMASmoothingFactor = BigNumber(2 * PRECISION).toFixed();
const EMAAverageWindowInIntervals = 30;
const MaxDepositPeriod = 3 * YEAR_IN_SEC; // 3 years in seconds
const MinDepositAmount = BigNumber(0.1 * STABLECOIN_PRECISION).toFixed(); // 0.1 stablecoin
const PoolDepositorRewardMintMultiplier = BigNumber(
  3.168873e-13 * PRECISION * (PRECISION / STABLECOIN_PRECISION)
)
  .integerValue()
  .toFixed(); // 1e5 stablecoin * 1 year => 1 MPH
const PoolFunderRewardMultiplier = BigNumber(
  1e-13 * PRECISION * (PRECISION / STABLECOIN_PRECISION)
)
  .integerValue()
  .toFixed(); // 1e5 stablecoin => 1 MPH
//Mobius mainnet addresses
const routerAddress = "0xdBF27fD2a702Cc02ac7aCF0aea376db780D53247"; //cUSD/cUSDT swap
const lpTokenAddress = "0xC7a4c6EF4A16Dc24634Cc2A951bA5Fec4398f7e0";
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
//Hijack fat CUSD stack address
const alice = "0xC32cBaf3D44dA6fbC761289b871af1A30cc7f993";
// Contract artifacts
const MobiusMarket = artifacts.require("MobiusMarket");
const Factory = artifacts.require("Factory");
const DInterest = (module.exports.DInterest = artifacts.require("DInterest"));
const DInterestLens = artifacts.require("DInterestLens");
const PercentageFeeModel = artifacts.require("PercentageFeeModel");
const LinearDecayInterestModel = artifacts.require("LinearDecayInterestModel");
const NFT = artifacts.require("NFT");
const FundingMultitoken = artifacts.require("FundingMultitoken");
const MPHToken = artifacts.require("MPHToken");
const MPHMinter = artifacts.require("MPHMinter");
const EMAOracle = artifacts.require("EMAOracle");
const Vesting02 = artifacts.require("Vesting02");
const ERC20Wrapper = artifacts.require("ERC20Wrapper");
const MPHConverter = artifacts.require("MPHConverter");
const ERC20 = artifacts.require("ERC20Mock");
const ERC20Mock = artifacts.require("ERC20Mock");
const routerAbi = require("./abi/routerAbi");

contract("MobiusMarket", accounts => {
  xdescribe("MobiusMarket", () => {
    beforeEach(async () => {
      acc0 = accounts[0];
      acc1 = accounts[1];
      acc2 = accounts[2];
      rewardsTo = accounts[3];
      rescuer = accounts[4];
      govTreasury = accounts[5];
      devWallet = accounts[6];
      // prepare test architecture
      cusd = await ERC20.at(CUSD);
      lpToken = await ERC20.at(lpTokenAddress);
      router = new web3.eth.Contract(routerAbi, routerAddress);
      factory = await Factory.new();
      mobiusMarketTemplate = await MobiusMarket.new();
      marketReceipt = await factory.createMobiusMarket(
        mobiusMarketTemplate.address,
        DEFAULT_SALT,
        routerAddress,
        rescuer,
        CUSD,
        2
      );
      mobiusMarket = await factoryReceiptToContract(
        marketReceipt,
        MobiusMarket
      );
      // Initialize MPH
      mph = await MPHToken.new();
      await mph.initialize();
      vesting02 = await Vesting02.new();
      await vesting02.initialize(mph.address, "Vested MPH", "veMPH");
      mphMinter = await MPHMinter.new();
      await mphMinter.initialize(
        mph.address,
        govTreasury,
        devWallet,
        vesting02.address,
        DevRewardMultiplier,
        GovRewardMultiplier
      );
      await vesting02.setMPHMinter(mphMinter.address);
      await mph.transferOwnership(mphMinter.address);
      await mphMinter.grantRole(WHITELISTER_ROLE, acc0, { from: govTreasury });
      // Initialize MPHConverter
      foreignMPH = await ERC20Mock.new();
      converter = await MPHConverter.new();
      await converter.initialize(mphMinter.address);
      await converter.setForeignTokenWhitelist(foreignMPH.address, true);
      await converter.setForeignToNativeDailyConvertLimit(
        foreignMPH.address,
        dailyConvertLimit
      );
      await mphMinter.grantRole(CONVERTER_ROLE, converter.address, {
        from: govTreasury
      });
      await mph.approve(converter.address, INF, { from: acc0 });
      await mph.approve(converter.address, INF, { from: acc1 });
      await mph.approve(converter.address, INF, { from: acc2 });
      await foreignMPH.approve(converter.address, INF, { from: acc0 });
      await foreignMPH.approve(converter.address, INF, { from: acc1 });
      await foreignMPH.approve(converter.address, INF, { from: acc2 });

      // Set infinite MPH approval
      await mph.approve(mphMinter.address, INF, { from: acc0 });
      await mph.approve(mphMinter.address, INF, { from: acc1 });
      await mph.approve(mphMinter.address, INF, { from: acc2 });

      feeModel = await PercentageFeeModel.new(
        govTreasury,
        interestFee,
        earlyWithdrawFee
      );
      interestModel = await LinearDecayInterestModel.new(
        multiplierIntercept,
        multiplierSlope
      );
      lens = await DInterestLens.new();
      // Initialize the NFTs
      const nftTemplate = await NFT.new();
      const depositNFTReceipt = await factory.createNFT(
        nftTemplate.address,
        DEFAULT_SALT,
        "88mph Deposit",
        "88mph-Deposit"
      );
      depositNFT = await factoryReceiptToContract(depositNFTReceipt, NFT);
      const fundingMultitokenTemplate = await FundingMultitoken.new();
      const erc20WrapperTemplate = await ERC20Wrapper.new();
      const fundingNFTReceipt = await factory.createFundingMultitoken(
        fundingMultitokenTemplate.address,
        DEFAULT_SALT,
        "https://api.88mph.app/funding-metadata/",
        [CUSD, mph.address],
        erc20WrapperTemplate.address,
        true,
        "88mph Floating-rate Bond: ",
        "88MPH-FRB-",
        STABLECOIN_DECIMALS
      );
      fundingMultitoken = await factoryReceiptToContract(
        fundingNFTReceipt,
        FundingMultitoken
      );
      // Initialize the interest oracle
      const interestOracleTemplate = await EMAOracle.new();
      const interestOracleReceipt = await factory.createEMAOracle(
        interestOracleTemplate.address,
        DEFAULT_SALT,
        BigNumber(
          Math.log2(Math.pow(INIT_INTEREST_RATE + 1, 1 / YEAR_IN_SEC)) *
            PRECISION
        )
          .integerValue()
          .toFixed(),
        EMAUpdateInterval,
        EMASmoothingFactor,
        EMAAverageWindowInIntervals,
        mobiusMarket.address
      );
      interestOracle = await factoryReceiptToContract(
        interestOracleReceipt,
        EMAOracle
      );

      const dInterestTemplate = await DInterest.new();
      const dInterestReceipt = await factory.createDInterest(
        dInterestTemplate.address,
        DEFAULT_SALT,
        MaxDepositPeriod,
        MinDepositAmount,
        feeModel.address,
        interestModel.address,
        interestOracle.address,
        depositNFT.address,
        fundingMultitoken.address,
        mphMinter.address
      );
      dInterest = await factoryReceiptToContract(dInterestReceipt, DInterest);
      // Set MPH minting multiplier for DInterest pool
      await mphMinter.grantRole(WHITELISTED_POOL_ROLE, dInterest.address, {
        from: acc0
      });
      await mphMinter.setPoolDepositorRewardMintMultiplier(
        dInterest.address,
        PoolDepositorRewardMintMultiplier,
        { from: govTreasury }
      );
      await mphMinter.setPoolFunderRewardMultiplier(
        dInterest.address,
        PoolFunderRewardMultiplier,
        { from: govTreasury }
      );

      // Transfer the ownership of the money market to the DInterest pool
      await mobiusMarket.transferOwnership(dInterest.address);

      // Transfer NFT ownerships to the DInterest pool
      await depositNFT.transferOwnership(dInterest.address);
      await fundingMultitoken.grantRole(MINTER_BURNER_ROLE, dInterest.address);
      await fundingMultitoken.grantRole(DIVIDEND_ROLE, dInterest.address);
      await fundingMultitoken.grantRole(DIVIDEND_ROLE, mphMinter.address);

      // set infinite approval to pool
      await cusd.approve(dInterest.address, BigNumber(1000000 * 1e18), {
        from: acc0
      });
    });
    it("deposits and withdraws funds from the Mobius pool", async () => {
      let amount = BigNumber(1000 * 1e18); //1000 CUSD
      let vp = await router.methods.getVirtualPrice().call();
      console.log("VP: ", vp * 1);
      //check our contract LP token balance
      let bal = await lpToken.balanceOf(mobiusMarket.address);
      console.log("LP token balance before deposit: ", bal * 1);
      assert.equal(bal, 0);
      let stamp = await latestBlockTimestamp();
      await cusd.transfer(acc0, amount, { from: alice });
      console.log(
        "Acc0 balance before deposit: ",
        (await cusd.balanceOf(acc0)) / 1e18,
        " CUSD"
      );
      console.log("Depositing 1000 CUSD with 30 days maturity");
      await dInterest.deposit(amount, 30 * DAYS + stamp);
      console.log("Deposit info: ", await dInterest.getDeposit(1));
      vp = await router.methods.getVirtualPrice().call();
      await network.provider.send("evm_increaseTime", [30 * DAYS]);
      await network.provider.send("evm_mine");
      stamp = await latestBlockTimestamp();
      console.log("Simulate swap from other account to bump LP token price");
      await cusd.approve(routerAddress, BigNumber(100000 * 1e18), {
        from: alice
      });
      await router.methods
        .swap(0, 1, BigNumber(100000 * 1e18), 0, Date.now())
        .send({ from: alice });
      vp = await router.methods.getVirtualPrice().call();
      console.log("VP after swap: ", vp * 1);
      console.log(
        "Market LP token balance after deposit: ",
        (await lpToken.balanceOf(mobiusMarket.address)) / 1e18
      );
      console.log("Withdrawing...");
      await dInterest.withdraw(1, BigNumber(1003 * 1e18), false);
      console.log(
        "Acc0 balance after withdraw: ",
        (await cusd.balanceOf(acc0)) / 1e18,
        " CUSD"
      );
      console.log("Deposit info: ", await dInterest.getDeposit(1));
    });
  });
});
