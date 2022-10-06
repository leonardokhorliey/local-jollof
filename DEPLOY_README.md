# Deployment guide

## Set parameters

1. Ensure the network config file `deployment-configs/networks/[networkName].json` has the correct global parameters
2. Ensure the pool config file `deployment-configs/pools/[networkName]/[poolName].json` has the correct pool-scope parameters
   - Can just copy a config file from another pool. Need to make sure that `EMAInitial`, `stablecoin`, `moneyMarketParams`, and `MinDepositAmount` are updated correctly, as well as the pool names.
3. Ensure the protocol config file `deployment-configs/protocols/[networkName]/[moneyMarketName].json` has the correct protocol specific addresses
   - Even if the protocol doesn't have protocol specific addresses, the file still must be created, with `{}` as the content.

## Deploy DInterest pool

Put the array of configs (in the format of `deployment-configs/config.json`) of the pools you want to deploy in `scripts/multideploy-configs.json`. The list of configs should be in the following format:

```json
[
    {
        "network": "celo",
        "pool": "moola-cusd",
        "protocol": "moola"
    },
    {
        "network": "celo",
        "pool": "mobius-cusd1",
        "protocol": "mobius"
    },
    ...
]
```

Note that the configs must have the same network field. Then, execute the following script:

```bash
scripts/multideploy.sh [networkName]
```

## Configs

### Network

Change values to your own. Keep isEthereum false or it will try to use mphToken from "mph" field (which will break the deployment if the deployer isn't mph owner).

### Protocol

Moola's config has to have `lendingPoolAddressesProvider` field which should be address of Moola's `LendingPoolAddressesProvider` contract (`0xD1088091A174d33412a968Fa34Cb67131188B332` in CELO). Mobius's can be empty, but don't remove it.

### Pool

Contains pool-specific variables, change it to your own.

`stablecoin` - address of stablecoin for staking.
`aToken` (only Moola) - address of aToken for this pool
`swap` (only Mobius) - address of swap where stablecoin trades
`swapLength` (only Mobius) - number of stablecoins in swap.

### Output subgraph config

Once new pools have been deployed, they should be added to the subgraph for indexing. To generate the configs automatically, `scripts/output-subgraph.js` is used.

First, put the list of pool configs in `scripts/output-subgraph-configs.json` in the following format:

```json
{
    "network": "avalanche",
    "pool": "aave-dai",
    "protocol": "aave",
    "decimals": 18
  },
  {
    "network": "avalanche",
    "pool": "aave-usdc",
    "protocol": "aave",
    "decimals": 6
  },
  ...
```

where `decimals` is the number of decimals used by the underlying deposit token. Then, run:

```bash
npx hardhat run scripts/output-subgraph.js
```

The config will be output to stdout.

## Notes

### LinearDecayInterestModel

The interest amount as a function of the deposit length is a quadratic function that peaks at `t_mid = interestRateMultiplierIntercept / (2 * interestRateMultiplierSlope)`. In order to ensure the interest amount monotonically increases, we must have `t_max <= t_mid`, which means `interestRateMultiplierSlope <= interestRateMultiplierIntercept / (2 * t_max)`.
