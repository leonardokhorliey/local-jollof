// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.3;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "../IMoneyMarket.sol";
import "../../libs/DecMath.sol";
import "./imports/HarvestVault.sol";
import "./imports/HarvestStaking.sol";

contract HarvestMarket is IMoneyMarket, OwnableUpgradeable {
    using DecMath for uint256;
    using SafeERC20Upgradeable for ERC20Upgradeable;
    using AddressUpgradeable for address;

    HarvestVault public vault;
    address public rewards;
    HarvestStaking public stakingPool;
    ERC20Upgradeable public override stablecoin;

    function init(
        address _vault,
        address _rewards,
        address _stakingPool,
        address _stablecoin
    ) external initializer {
        __Ownable_init();

        // Verify input addresses
        require(
            _vault.isContract() &&
                _rewards.isContract() &&
                _stakingPool.isContract() &&
                _stablecoin.isContract(),
            "HarvestMarket: An input address is not a contract"
        );

        vault = HarvestVault(_vault);
        rewards = _rewards;
        stakingPool = HarvestStaking(_stakingPool);
        stablecoin = ERC20Upgradeable(_stablecoin);
    }

    function deposit(uint256 amount) external override onlyOwner {
        require(amount > 0, "HarvestMarket: amount is 0");

        // Transfer `amount` stablecoin from `msg.sender`
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        // Approve `amount` stablecoin to vault
        stablecoin.safeIncreaseAllowance(address(vault), amount);

        // Deposit `amount` stablecoin to vault
        vault.deposit(amount);

        // Stake vault token balance into staking pool
        uint256 vaultShareBalance = vault.balanceOf(address(this));
        vault.approve(address(stakingPool), vaultShareBalance);
        stakingPool.stake(vaultShareBalance);
    }

    function withdraw(uint256 amountInUnderlying)
        external override
        onlyOwner
        returns (uint256 actualAmountWithdrawn)
    {
        require(
            amountInUnderlying > 0,
            "HarvestMarket: amountInUnderlying is 0"
        );

        // Withdraw `amountInShares` shares from vault
        uint256 sharePrice = vault.getPricePerFullShare();
        uint256 amountInShares = amountInUnderlying.decdiv(sharePrice);
        if (amountInShares > 0) {
            stakingPool.withdraw(amountInShares);
            vault.withdraw(amountInShares);
        }

        // Transfer stablecoin to `msg.sender`
        actualAmountWithdrawn = stablecoin.balanceOf(address(this));
        if (actualAmountWithdrawn > 0) {
            stablecoin.safeTransfer(msg.sender, actualAmountWithdrawn);
        }
    }

    function claimRewards() external override {
        stakingPool.getReward();
        ERC20Upgradeable rewardToken = ERC20Upgradeable(stakingPool.rewardToken());
        rewardToken.safeTransfer(rewards, rewardToken.balanceOf(address(this)));
    }

    function totalValue() external view override returns (uint256) {
        uint256 sharePrice = vault.getPricePerFullShare();
        uint256 shareBalance = vault.balanceOf(address(this)) + stakingPool.balanceOf(address(this));
        return shareBalance.decmul(sharePrice);
    }

    function incomeIndex() external view override returns (uint256) {
        return vault.getPricePerFullShare();
    }

    /**
        Param setters
     */
    function setRewards(address newValue) external override onlyOwner {
        require(newValue.isContract(), "HarvestMarket: not contract");
        rewards = newValue;
        emit ESetParamAddress(msg.sender, "rewards", newValue);
    }
}
