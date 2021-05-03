// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.3;

import {
    SafeERC20Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {
    ERC20Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {
    AddressUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {Rescuable} from "../../libs/Rescuable.sol";
import {IMoneyMarket} from "../IMoneyMarket.sol";
import {DecMath} from "../../libs/DecMath.sol";
import {Vault} from "./imports/Vault.sol";

contract YVaultMarket is IMoneyMarket, OwnableUpgradeable, Rescuable {
    using DecMath for uint256;
    using SafeERC20Upgradeable for ERC20Upgradeable;
    using AddressUpgradeable for address;

    Vault public vault;
    ERC20Upgradeable public override stablecoin;

    function initialize(address _vault, address _stablecoin)
        external
        initializer
    {
        __Ownable_init();

        // Verify input addresses
        require(
            _vault.isContract() && _stablecoin.isContract(),
            "YVaultMarket: An input address is not a contract"
        );

        vault = Vault(_vault);
        stablecoin = ERC20Upgradeable(_stablecoin);
    }

    function deposit(uint256 amount) external override onlyOwner {
        require(amount > 0, "YVaultMarket: amount is 0");

        // Transfer `amount` stablecoin from `msg.sender`
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        // Approve `amount` stablecoin to vault
        stablecoin.safeIncreaseAllowance(address(vault), amount);

        // Deposit `amount` stablecoin to vault
        vault.deposit(amount);
    }

    function withdraw(uint256 amountInUnderlying)
        external
        override
        onlyOwner
        returns (uint256 actualAmountWithdrawn)
    {
        require(
            amountInUnderlying > 0,
            "YVaultMarket: amountInUnderlying is 0"
        );

        // Withdraw `amountInShares` shares from vault
        uint256 sharePrice = vault.getPricePerFullShare();
        uint256 amountInShares = amountInUnderlying.decdiv(sharePrice);
        if (amountInShares > 0) {
            vault.withdraw(amountInShares);
        }

        // Transfer stablecoin to `msg.sender`
        actualAmountWithdrawn = stablecoin.balanceOf(address(this));
        if (actualAmountWithdrawn > 0) {
            stablecoin.safeTransfer(msg.sender, actualAmountWithdrawn);
        }
    }

    function claimRewards() external override {}

    function totalValue() external view override returns (uint256) {
        uint256 sharePrice = vault.getPricePerFullShare();
        uint256 shareBalance = vault.balanceOf(address(this));
        return shareBalance.decmul(sharePrice);
    }

    function incomeIndex() external view override returns (uint256) {
        return vault.getPricePerFullShare();
    }

    function setRewards(address newValue) external override {}

    /**
        Rescuable
     */
    function _authorizeRescue(address token, address /*target*/)
        internal
        view
        override
    {
        require(token != address(vault), "YVaultMarket: no steal");
        require(msg.sender == owner(), "YVaultMarket: not owner");
    }

    uint256[48] private __gap;
}
