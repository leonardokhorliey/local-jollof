// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

// interfaces
import {ERC20Mock} from "./ERC20Mock.sol";
import {PRBMathUD60x18} from "prb-math/contracts/PRBMathUD60x18.sol";

import "hardhat/console.sol";

contract MobiusPoolMock {
    using PRBMathUD60x18 for uint256;

    ERC20Mock public lpToken;
    ERC20Mock public stablecoin;
    uint256 internal _virtualPrice;
    uint256 internal constant PRECISION = 1e27;

    constructor(address _lpToken, address _stablecoin) {
        lpToken = ERC20Mock(_lpToken);
        stablecoin = ERC20Mock(_stablecoin);
        _virtualPrice = 1100 * 10**15; // 1 cUSD LP = 1.1 cUSD
    }

    function addLiquidity(
        uint256[] memory amounts,
        uint256 minAmount,
        uint256 deadline
    ) external returns (uint256) {
        uint256 amountToMint = amounts[0].div(_virtualPrice);
        lpToken.mint(msg.sender, amountToMint);
        stablecoin.transferFrom(msg.sender, address(this), amounts[0]);
        return 0;
    }

    function removeLiquidityOneToken(
        uint256 amount,
        uint8 index,
        uint256 minAmount,
        uint256 deadline
    ) external returns (uint256) {
        uint256 amountToTransfer =
            amount.mul(PRECISION).mul(_virtualPrice).div(PRECISION);
        //substract 1 to mitigate rounding error
        if (amount > lpToken.balanceOf(msg.sender)) amount -= 1;
        lpToken.burn(msg.sender, amount);
        stablecoin.transfer(msg.sender, amountToTransfer);
        return amountToTransfer;
    }

    function getVirtualPrice() external view returns (uint256) {
        return _virtualPrice;
    }

    function getTokenIndex(address token) external view returns (uint8) {
        return 0;
    }

    function getLpToken() external view returns (address) {
        return address(lpToken);
    }

    function setVirtualPrice(uint256 _price) external {
        _virtualPrice = _price;
    }
}
