const env = require('@nomiclabs/buidler')
const BigNumber = require('bignumber.js')

async function main () {
  const PercentageFeeModel = env.artifacts.require('PercentageFeeModel')
  const feeModel = await PercentageFeeModel.new()
  console.log(`Deployed FeeModel at address ${feeModel.address}`)

  const CompoundERC20Market = env.artifacts.require('CompoundERC20Market')
  const cTokenAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643' // cDAI Mainnet
  const comptrollerAddress = '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b' // Comptroller Mainnet
  const stablecoinAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F' // DAI Mainnet
  const market = await CompoundERC20Market.new(cTokenAddress, comptrollerAddress, feeModel.address, stablecoinAddress)
  console.log(`Deployed CompoundERC20Market at address ${market.address}`)

  const LinearInterestModel = env.artifacts.require('LinearInterestModel')
  const IRMultiplier = BigNumber(0.75 * 1e18).integerValue().toFixed() // Minimum safe avg interest rate multiplier
  const interestModel = await LinearInterestModel.new(IRMultiplier)
  console.log(`Deployed LinearInterestModel at ${interestModel.address}`)

  const NFT = env.artifacts.require('NFT')
  const depositNFT = await NFT.new('88mph Compound-Pool Deposit', '88mph-Compound-Deposit')
  console.log(`Deployed depositNFT at address ${depositNFT.address}`)
  const fundingNFT = await NFT.new('88mph Compound-Pool Long Position', '88mph-Compound-Long')
  console.log(`Deployed fundingNFT at address ${fundingNFT.address}`)

  const DInterest = env.artifacts.require('DInterest')
  const YEAR_IN_SEC = 31556952 // Number of seconds in a year
  const MinDepositPeriod = 90 * 24 * 60 * 60 // 90 days in seconds
  const MaxDepositPeriod = 3 * YEAR_IN_SEC // 3 years in seconds
  const MinDepositAmount = BigNumber(10 * 1e18).toFixed() // 10 stablecoins
  const MaxDepositAmount = BigNumber(10000 * 1e18).toFixed() // 10000 stablecoins
  const dInterestPool = await DInterest.new(MinDepositPeriod, MaxDepositPeriod, MinDepositAmount, MaxDepositAmount, market.address, stablecoinAddress, feeModel.address, interestModel.address, depositNFT.address, fundingNFT.address)
  console.log(`Deployed DInterest at address ${dInterestPool.address}`)

  await market.transferOwnership(dInterestPool.address)
  console.log(`Transferred AaveMarket's ownership to ${dInterestPool.address}`)

  await depositNFT.transferOwnership(dInterestPool.address)
  console.log(`Transferred depositNFT's ownership to ${dInterestPool.address}`)

  await fundingNFT.transferOwnership(dInterestPool.address)
  console.log(`Transferred fundingNFT's ownership to ${dInterestPool.address}`)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
