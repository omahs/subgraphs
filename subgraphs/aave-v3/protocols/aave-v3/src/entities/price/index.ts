import {
  Address,
  BigDecimal,
  BigInt,
  dataSource,
  log,
} from "@graphprotocol/graph-ts";
import { Token, _PoolAddressesProvider } from "../../../../../generated/schema";
import { AaveOracle } from "../../../../../generated/templates/Pool/AaveOracle";
import {
  BIGDECIMAL_ZERO,
  BIGINT_TEN,
  BIGINT_ZERO,
  POOL_ADDRESSES_PROVIDER_ID_KEY,
  ZERO_ADDRESS,
} from "../../../../../src/utils/constants";
import { bigIntToBigDecimal } from "../../../../../src/utils/numbers";
import { getTokenById } from "../token";
import { getTokenUSDPrice } from "./univ3";

export function setPriceOracleAddress(
  poolAddressesProviderAddress: Address,
  priceOracleAddress: Address
): void {
  const poolAddressesProvider = new _PoolAddressesProvider(
    poolAddressesProviderAddress.toHexString()
  );
  const priceOracle = AaveOracle.bind(priceOracleAddress);
  poolAddressesProvider.priceOracleAddress = priceOracleAddress.toHexString();
  poolAddressesProvider.priceOracleCurrency = priceOracle
    .BASE_CURRENCY()
    .toHexString();
  poolAddressesProvider.priceOracleDecimals =
    priceOracle.BASE_CURRENCY_UNIT().toString().length - 1;
  poolAddressesProvider.save();
}

export function getAssetPrice(asset: Token): BigDecimal {
  const assetAddr = Address.fromString(asset.id);

  const poolAddressesProviderId = dataSource
    .context()
    .get(POOL_ADDRESSES_PROVIDER_ID_KEY);
  const poolAddressesProvider = _PoolAddressesProvider.load(
    poolAddressesProviderId != null
      ? poolAddressesProviderId.toString()
      : ZERO_ADDRESS
  )!;
  if (ZERO_ADDRESS != poolAddressesProvider.priceOracleCurrency) {
    log.error("Failed to fetch asset price, unexpected base currency: {}", [
      poolAddressesProvider.priceOracleCurrency!,
    ]);
    return BIGDECIMAL_ZERO;
  }
  const priceOracleAddress = Address.fromString(
    poolAddressesProvider.priceOracleAddress!
  );
  const decimals = poolAddressesProvider.priceOracleDecimals;
  const priceOracle = AaveOracle.bind(priceOracleAddress);
  const price = priceOracle.try_getAssetPrice(assetAddr);
  if (!price.reverted) {
    return bigIntToBigDecimal(price.value, decimals);
  }

  log.warning(
    "Failed to fetch asset price, contract call reverted. Price oracle: {}, asset: {}\n Falling back to uniswap v3",
    [priceOracleAddress.toHexString(), assetAddr.toHexString()]
  );

  let assetDecimals = BIGINT_TEN.pow(asset.decimals as u8).toBigDecimal();
  return getTokenUSDPrice(assetAddr, assetDecimals);
}

export function amountInUSD(amount: BigInt, token: Token): BigDecimal {
  if (amount == BIGINT_ZERO) {
    return BIGDECIMAL_ZERO;
  }
  if (token.underlyingAsset) {
    return amountInUSD(amount, getTokenById(token.underlyingAsset!));
  }

  return bigIntToBigDecimal(amount, token.decimals).times(getAssetPrice(token));
}
