// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {
    AddressUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {MoneyMarket} from "../MoneyMarket.sol";
import {ISwap} from "./interfaces/ISwap.sol";

contract MobiusMarket is MoneyMarket {
    using SafeERC20 for ERC20;
    using AddressUpgradeable for address;

    uint16 internal constant REFERRALCODE = 20; // Aave referral program code

    ERC20 public override stablecoin;
    ERC20 public lpToken;
    ISwap public mobiusSwap;
    uint8 public tokenIndex;
    uint256 public swapLength;

    function initialize(
        address _mobiusSwap,
        address _rescuer,
        address _stablecoin,
        uint256 _swapLength
    ) external initializer {
        __MoneyMarket_init(_rescuer);

        // Verify input addresses
        require(
                _mobiusSwap.isContract() &&
                _stablecoin.isContract(),
            "MobiusMarket: An input address is not a contract"
        );

        mobiusSwap = ISwap(_mobiusSwap);
        stablecoin = ERC20(_stablecoin);

        tokenIndex = mobiusSwap.getTokenIndex(address(stablecoin));
        lpToken = ERC20(mobiusSwap.getLpToken());
        swapLength = _swapLength;
    }

    function deposit(uint256 amount) external override onlyOwner {
        require(amount > 0, "MobiusMarket: amount is 0");
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);
        stablecoin.safeIncreaseAllowance(address(mobiusSwap), amount);
        uint256[] memory amounts = new uint256[](swapLength);
        amounts[tokenIndex] = amount;

        mobiusSwap.addLiquidity(amounts, 0, block.timestamp + 1);
    }

    function withdraw(uint256 amount)
        external
        override
        onlyOwner
        returns (uint256 amountWithdrawn)
    {
        require(amount > 0, "MobiusMarket: amount is 0");
        
        lpToken.safeIncreaseAllowance(address(mobiusSwap), amount);
        amountWithdrawn = (mobiusSwap.removeLiquidityOneToken(
            amount, tokenIndex, 0, block.timestamp + 1
        ));
        stablecoin.safeTransfer(msg.sender, amountWithdrawn);
    }

    function claimRewards() external override {}

    // /**
    //     Param setters
    //  */
    function setRewards(address newValue) external override onlyOwner {}

    /**
        @dev IMPORTANT MUST READ
        This function is for restricting unauthorized accounts from taking funds
        and ensuring only tokens not used by the MoneyMarket can be rescued.
        IF YOU DON'T GET IT RIGHT YOU WILL LOSE PEOPLE'S MONEY
        MAKE SURE YOU DO ALL OF THE FOLLOWING
        1) You MUST override it in a MoneyMarket implementation.
        2) You MUST make `super._authorizeRescue(token, target);` the first line of your overriding function.
        3) You MUST revert during a call to this function if a token used by the MoneyMarket is being rescued.
        4) You SHOULD look at how existing MoneyMarkets do it as an example.
     */
    function _authorizeRescue(address token, address target)
        internal
        view
        override
    {
        super._authorizeRescue(token, target);
        require(token != address(lpToken), "MobiusMarket: no steal");
    }

    function _totalValue(
        uint256 /*currentIncomeIndex*/
    ) internal view override returns (uint256) {
        return lpToken.balanceOf(address(this)) * _incomeIndex();
    }

    function _incomeIndex() internal view override returns (uint256 index) {
        index = mobiusSwap.getVirtualPrice();
        require(index > 0, "MobiusMarket: BAD_INDEX");
    }
}
