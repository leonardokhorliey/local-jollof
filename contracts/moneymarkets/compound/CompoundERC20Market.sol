pragma solidity 0.5.17;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../IMoneyMarket.sol";
import "../../models/fee/IFeeModel.sol";
import "../../libs/DecMath.sol";
import "./imports/ICERC20.sol";
import "./imports/IComptroller.sol";


contract CompoundERC20Market is IMoneyMarket, Ownable {
    using DecMath for uint256;
    using SafeERC20 for ERC20;
    using Address for address;

    uint256 internal constant ERRCODE_OK = 0;

    ICERC20 public cToken;
    IComptroller public comptroller;
    IFeeModel public feeModel;
    ERC20 public stablecoin;

    constructor(address _cToken, address _comptroller, address _feeModel, address _stablecoin) public {
        // Verify input addresses
        require(
            _cToken != address(0) && _comptroller != address(0) && _feeModel != address(0) && _stablecoin != address(0),
            "CompoundERC20Market: An input address is 0"
        );
        require(
            _cToken.isContract() && _comptroller.isContract() && _feeModel.isContract() && _stablecoin.isContract(),
            "CompoundERC20Market: An input address is not a contract"
        );

        cToken = ICERC20(_cToken);
        comptroller = IComptroller(_comptroller);
        feeModel = IFeeModel(_feeModel);
        stablecoin = ERC20(_stablecoin);
    }

    function deposit(uint256 amount) external onlyOwner {
        require(amount > 0, "CompoundERC20Market: amount is 0");

        // Transfer `amount` stablecoin from `msg.sender`
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        // Deposit `amount` stablecoin into cToken
        stablecoin.safeIncreaseAllowance(address(cToken), amount);
        require(
            cToken.mint(amount) == ERRCODE_OK,
            "CompoundERC20Market: Failed to mint cTokens"
        );
    }

    function withdraw(uint256 amountInUnderlying) external onlyOwner {
        require(amountInUnderlying > 0, "CompoundERC20Market: amountInUnderlying is 0");

        // Withdraw `amountInUnderlying` stablecoin from cToken
        require(
            cToken.redeemUnderlying(amountInUnderlying) == ERRCODE_OK,
            "CompoundERC20Market: Failed to redeem"
        );

        // Transfer `amountInUnderlying` stablecoin to `msg.sender`
        stablecoin.safeTransfer(msg.sender, amountInUnderlying);
    }

    function supplyRatePerSecond(uint256 blocktime)
        external
        view
        returns (uint256)
    {
        return cToken.supplyRatePerBlock().decdiv(blocktime);
    }

    function totalValue() external returns (uint256) {
        uint256 cTokenBalance = cToken.balanceOf(address(this));
        // Amount of stablecoin units that 1 unit of cToken can be exchanged for, scaled by 10^18
        uint256 cTokenPrice = cToken.exchangeRateCurrent();
        return cTokenBalance.decmul(cTokenPrice);
    }

    function incomeIndex() external returns (uint256) {
        return cToken.exchangeRateCurrent();
    }

    function claimComp() external {
        comptroller.claimComp(address(this));
        ERC20 comp = ERC20(comptroller.getCompAddress());
        comp.safeTransfer(feeModel.beneficiary(), comp.balanceOf(address(this)));
    }
}
