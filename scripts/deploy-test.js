const BigNumber = require("bignumber.js");
const hre = require("hardhat");
const { artifacts } = require("hardhat");
const fs = require("fs");
const { accessSync, constants } = fs;
const requireNoCache = require("../deploy/requireNoCache");
const { ethers } = require("ethers");

const ERC20Wrapper = artifacts.require("ERC20Wrapper");

const PRECISION = 1e18;

const num2str = num => {
  return BigNumber(num)
    .integerValue()
    .toFixed();
};

const EMAUpdateInterval = 24 * 60 * 60;
const EMASmoothingFactor = BigNumber(2 * PRECISION).toFixed();
const EMAAverageWindowInIntervals = 30;

async function main() {
  const [account] = await hre.ethers.getSigners();

  const poolConfig = requireNoCache("../deploy-configs/get-pool-config");

  const networkConfig = requireNoCache("../deploy-configs/get-network-config");

  const protocolConfig = requireNoCache(
    "../deploy-configs/get-protocol-config"
  );

  console.log("Here");
  // const ERC20Wrapper = await hre.ethers.getContractFactory("ERC20Wrapper");
  // const erc20WrapperTemplate = await ERC20Wrapper.deploy();

  // console.log(`ERC20Wrapper is at ${erc20WrapperTemplate.address}`);
  // await erc20WrapperTemplate.deployed();

  // const FeeModel = await hre.ethers.getContractFactory("PercentageFeeModel");
  // const feeModel = await FeeModel.deploy(
  //     "0x940F80Cd7cA57a2565DAF3D79980f90A32233b80",
  //     BigNumber(
  //         0.2 * PRECISION
  //     ).toFixed(),
  //     BigNumber(
  //         0.005 * PRECISION
  //     ).toFixed()

  // );
  // console.log(`Fee Model is at ${feeModel.address}`);
  // await feeModel.deployed();

  // const InterestModel = await hre.ethers.getContractFactory(poolConfig.interestModel);
  // const interestModel = await InterestModel.deploy(

  //     num2str(
  //         0.5 * PRECISION
  //     ),
  //     num2str(
  //         (0.25/ 31556952) * PRECISION
  //     )

  // );
  // console.log(`Interest Model is at ${interestModel.address}`);
  // await interestModel.deployed();

  // const MoolaMarket = await hre.ethers.getContractFactory(poolConfig.moneyMarket);
  // const moolaMarket = await MoolaMarket.deploy();

  // await moolaMarket.deployed();

  // await moolaMarket.initialize(
  //     protocolConfig.lendingPoolAddressesProvider,
  //     poolConfig.moneyMarketParams.aToken,
  //     "0x1d80b14fc72d953eDfD87bF4d6Acd08547E3f1F6",
  //     account.address,
  //     "0x874069fa1eb16d44d622f2e0ca25eea172369bc1"
  // )

  // console.log(`Moola is at ${moolaMarket.address}`);

  // const InterestOracle = await hre.ethers.getContractFactory(poolConfig.interestOracle);
  // const interestOracle = await InterestOracle.deploy();

  // await interestOracle.deployed();

  // await interestOracle.initialize(
  //     num2str(
  //         Math.log2(Math.pow(0.1 + 1, 1 / 31556952)) * PRECISION
  //       ),
  //     EMAUpdateInterval,
  //     EMASmoothingFactor,
  //     EMAAverageWindowInIntervals,
  //     "0x78d82939c773491155bb0D705cc57bb38A5732E9"
  // )

  // console.log(`Interest Oracle is at ${interestOracle.address}`);

  // deploy
  // const Fmt = await hre.ethers.getContractFactory("FundingMultitoken");

  // const fmt2 = await Fmt.deploy();

  // await fmt2.deployed();

  // await fmt2.initialize(
  //     account.address,
  //   "https://api.88mph.app/funding-metadata/",
  //   ["0x874069fa1eb16d44d622f2e0ca25eea172369bc1"],
  //   "0x18e5862e536043dd8d8130637E8e9aAbc76FD68b", //oracle
  //   true,
  //   "JOllof Moola FMT",
  //   "Jollof-FRB",
  //   18
  // )

  // console.log(`Funding Multitoken is at ${fmt2.address}`);

  // const DepositNft = await hre.ethers.getContractFactory("NFT");
  // const depositNft = await DepositNft.deploy();

  // await depositNft.deployed();

  // await depositNft.initialize("Jollof Deposit NFT", "JLF-NFT");

  // console.log(`NFT is at ${depositNft.address}`);

  const DInterest = await hre.ethers.getContractFactory("DInterest");
  const dInterest = await DInterest.deploy();

  await dInterest.deployed();

  await dInterest.initialize(
    num2str(poolConfig.MaxDepositPeriod),
    num2str(poolConfig.MinDepositAmount),
    "0xb06849DC29a8565CFF104F536F6D94de6AD2Ad15", //fee
    "0xe64B2c9E18Fd0757e7505deE83346672d62f4a28", //interest
    "0xD62Ae21E83e13F09710D5CA82aD6cB637CB42488", //oracle
    "0x3857147C7b98e0dB26BE0f2bE1E56257633394Ca", //nft
    "0x425fD0Ca6F3Dc288f6Fd00C5985e89B2d72886FF" //fmt
  );

  console.log(`dInterest is at ${dInterest.address}`);

  console.log("bogus");
}

main()
  .then(e => {
    console.log("Done");
  })
  .catch(e => {
    console.log(e.message);
  });
