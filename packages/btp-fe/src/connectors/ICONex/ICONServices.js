import { IconUtil, IconConverter, IconBuilder } from 'icon-sdk-js';
const { IcxTransactionBuilder, CallTransactionBuilder } = IconBuilder;
const { serialize } = IconUtil;

import { ethers } from 'ethers';

import {
  ADDRESS_LOCAL_STORAGE,
  signingActions,
  rawTransaction,
  iconService,
  httpProvider,
  getCurrentChain,
} from 'connectors/constants';
import { chainConfigs, chainList } from 'connectors/chainConfigs';

import { requestICONexSigning, requestHanaSigning } from './events';
import Request, { convertToICX, convertToLoopUnit, makeICXCall } from './utils';
import store from 'store';
import { roundNumber } from 'utils/app';
import { wallets } from 'utils/constants';
export { transfer } from './transfer';

const { modal } = store.dispatch;
const ICONchain = chainConfigs.ICON || {};
export const serviceName = ICONchain.id;

/**
 * Get balance from an ICON address
 * @param {string} address The ICON address
 * @returns {string} balance in a user-friendly format
 */
export const getBalance = (address) => {
  // https://github.com/icon-project/icon-sdk-js/issues/26#issuecomment-843988076
  return iconService
    .getBalance(address)
    .execute()
    .then((balance) => {
      return convertToICX(balance);
    });
};

/**
 * Send a transaction to ICON network
 * @param {string} signature The signature for the payload
 */
export const sendTransaction = async (signature) => {
  try {
    if (!signature || !window[rawTransaction]) throw new Error('invalid send transaction params');

    const request = new Request('icx_sendTransaction', {
      ...window[rawTransaction],
      signature,
    });

    return await httpProvider.request(request).execute();
  } catch (err) {
    throw new Error(err.message || err);
  }
};

/**
 * Get transaction result
 * https://www.icondev.io/icon-node/goloop/json-rpc/jsonrpc_v3#icx_gettransactionresult
 * @param {string} txHash Transaction hash
 */
export const getTxResult = (txHash) => {
  try {
    return iconService
      .getTransactionResult(txHash)
      .execute()
      .then((rs) => {
        return rs;
      });
  } catch (err) {
    throw new Error(err.message);
  }
};

/**
 * Set approval for sending non-native token
 * @param {object} tx Transaction object
 */
export const setApproveForSendNonNativeCoin = async (tx, network) => {
  const { to, coinName, value } = tx;
  const bshAddress = await getBSHAddressOfCoinName(coinName);

  const transaction = {
    to: bshAddress,
  };

  const options = {
    builder: new CallTransactionBuilder(),
    method: 'approve',
    params: {
      spender: chainConfigs[network]?.ICON_BSH_ADDRESS,
      amount: ethers.utils.parseEther(value).toString(10),
    },
  };

  window[rawTransaction] = tx;
  window[signingActions.receiver] = to;
  window[signingActions.globalName] = signingActions.approve;
  signTx(transaction, options);
  return { transaction, options };
};

/**
 * Send non-native token which was approved
 */
export const sendNonNativeCoin = () => {
  const transaction = {
    to: ICONchain.BSH_ADDRESS,
  };

  const options = {
    builder: new CallTransactionBuilder(),
    method: 'transfer',
    params: {
      _to: `btp://${getCurrentChain().NETWORK_ADDRESS}/${window[signingActions.receiver]}`, // TODO: check network address
      _value: window[rawTransaction].data.params.amount,
      _coinName: 'DEV',
    },
  };

  window[signingActions.globalName] = signingActions.transfer;
  signTx(transaction, options);
  return { transaction, options };
};

export const sendNativeCoin = ({ value, to }, network) => {
  const transaction = {
    to: chainConfigs[network]?.ICON_BSH_ADDRESS,
    value,
  };

  const options = {
    builder: new CallTransactionBuilder(),
    method: 'transferNativeCoin',
    params: {
      _to: `btp://${chainConfigs[network]?.NETWORK_ADDRESS}/${to}`,
    },
  };

  signTx(transaction, options);
  return { transaction, options };
};

/**
 * Claim token which was failed to refunded automatically
 * @param {object} payload
 */
export const reclaim = async ({ coinName, value }) => {
  const transaction = {
    to: ICONchain.BSH_ADDRESS, // TODO: change to the proper ICON BSH Address
  };

  const options = {
    builder: new CallTransactionBuilder(),
    method: 'reclaim',
    params: {
      _coinName: coinName,
      _value: IconConverter.toHex(convertToLoopUnit(value)),
    },
  };

  signTx(transaction, options);
};

/**
 * DEPRECATED: Place a bid for token
 * @param {string} auctionName
 * @param {number} value
 * @param {string} fas FAS address
 */
export const placeBid = (auctionName, value, fas) => {
  const transaction = {
    to: fas || 'cxe3d36b26abbe6e1005eacf7e1111d5fefbdbdcad', // default FAS addess to our server
    value,
  };

  const options = {
    builder: new CallTransactionBuilder(),
    method: 'bid',
    params: {
      _tokenName: auctionName,
    },
  };

  window[signingActions.globalName] = signingActions.bid;
  signTx(transaction, options);
};

/**
 * Request ICON wallet to sign a transaction
 * @param {object} transaction
 * @param {onject} options
 */
export const signTx = (transaction = {}, options = {}) => {
  const { from = localStorage.getItem(ADDRESS_LOCAL_STORAGE), to, value } = transaction;
  const { method, params, builder, nid, timestamp } = options;

  if (!modal.isICONexWalletConnected()) {
    return;
  }

  modal.openModal({
    icon: 'loader',
    desc: 'Waiting for confirmation in your wallet.',
  });

  const txBuilder = builder || new IcxTransactionBuilder();

  let tx = txBuilder
    .from(from)
    .to(to)
    .stepLimit(IconConverter.toBigNumber(ICONchain.STEP_LIMIT))
    .nid(IconConverter.toBigNumber(nid || ICONchain.NETWORK_ADDRESS?.split('.')[0]))
    .nonce(IconConverter.toBigNumber(1))
    .version(IconConverter.toBigNumber(3))
    .timestamp(timestamp || new Date().getTime() * 1000);

  if (value) {
    tx = tx.value(convertToLoopUnit(value));
  }

  if (method) {
    tx = tx.method(method).params(params);
  }

  tx = tx.build();

  const rawTx = IconConverter.toRawTransaction(tx);

  window[rawTransaction] = rawTx;
  const transactionHash = serialize(rawTx);

  if (store.getState().account.wallet === wallets.hana) {
    requestHanaSigning(rawTx);
  } else {
    requestICONexSigning({
      from,
      hash: transactionHash,
    });
  }

  return transactionHash;
};

/**
 * Returns BTP fee
 * @return {string} unit: 1/10000
 * ref: https://github.com/icon-project/btp/blob/iconloop/javascore/nativecoin/src/main/java/foundation/icon/btp/nativecoin/NativeCoinService.java#L40
 */
export const getBTPfee = async (id, network) => {
  const fee = await makeICXCall({
    to: chainConfigs[network]?.ICON_BSH_ADDRESS || chainConfigs[id]?.ICON_BSH_ADDRESS,
    dataType: 'call',
    data: {
      method: 'feeRatio',
    },
  });

  return IconConverter.toNumber(fee);
};

/**
 * Get BSH address of non-native token
 * In ICON network, every non-native token has their own BSH address
 * @param {string} coinName Token's name, ex: ICX, DEV,
 * @returns {string} BSH address corresponding to the coinName
 */
export const getBSHAddressOfCoinName = async (coinName, ICONBSHAddress) => {
  try {
    const payload = {
      dataType: 'call',
      to: ICONBSHAddress,
      data: {
        method: 'coinAddress',
        params: {
          _coinName: coinName,
        },
      },
    };

    return await makeICXCall(payload);
  } catch (err) {
    console.log('getBSHAddressOfCoinName err', err);
  }
};

/**
 * Get balance of non-native token
 * @param {object} payload
 * @returns {string} non-native token balance or refundable balance in a user-friendly format
 */
export const getBalanceOf = async ({ address, refundable = false, symbol = 'DEV' }) => {
  try {
    const {
      methods: { getBalanceOf = {} },
    } = getCurrentChain();

    // TODO: check refundable balance for ICX_H ICX_B
    const customPayload = getBalanceOf?.payload || {};
    const chain = chainList.find(({ COIN_SYMBOL }) => COIN_SYMBOL === symbol);
    console.log('🚀 ~ file: ICONServices.js ~ line 305 ~ getBalanceOf ~ chain', chain);
    console.log('🚀 ~ file: ICONServices.js ~ line 298 ~ getBalanceOf ~ symbol', symbol);

    if (!chain) {
      console.log('relevant chain not found');
      return 0;
    }
    const ICONBSHAddress = chain.ICON_BSH_ADDRESS;

    const bshAddressToken =
      customPayload.symbol === symbol && customPayload.to
        ? customPayload.to
        : await getBSHAddressOfCoinName(symbol, ICONBSHAddress);

    if (!bshAddressToken) throw new Error('BSH address not found');

    delete customPayload.symbol;

    const payload = {
      dataType: 'call',
      to: bshAddressToken,
      data: {
        method: 'balanceOf',
        params: {
          _owner: address,
        },
      },
      ...customPayload,
    };

    if (refundable) {
      payload.to = ICONBSHAddress;
      payload.data.params._coinName = symbol;
    }

    const balance = await makeICXCall(payload);

    return refundable
      ? convertToICX(balance.refundable)
      : roundNumber(ethers.utils.formatEther(balance), 6);
  } catch (err) {
    console.log('getBalanceOf err', err);
    return 0;
  }
};
