import { IconUtil, IconConverter, IconBuilder } from 'icon-sdk-js';
const { CallTransactionBuilder } = IconBuilder;
const { serialize } = IconUtil;

import { signingActions } from 'connectors/constants';
import { chainConfigs } from 'connectors/chainConfigs';

import * as ICONService from '../ICONServices';
import { transfer } from '../transfer';
import { convertToLoopUnit } from '../utils';

jest.mock('store', () => {
  return {
    dispatch: {
      modal: {
        isICONexWalletConnected: jest.fn().mockImplementation(() => true),
        openModal: jest.fn(),
      },
    },
    getState: jest.fn().mockImplementation(() => ({ account: {} })),
  };
});

describe('ICONService', () => {
  test('signTx', () => {
    const transactions = { from: 'alice', to: 'bob', value: 1 };
    const options = {
      builder: new CallTransactionBuilder(),
      method: 'transfer',
      params: { _coinName: 'DEV' },
      nid: '0x58eb1c',
      timestamp: '123',
    };

    const txBuilder = new CallTransactionBuilder();

    const tx = txBuilder
      .from(transactions.from)
      .to(transactions.to)
      .stepLimit(IconConverter.toBigNumber(chainConfigs.ICON?.STEP_LIMIT))
      .nid(IconConverter.toBigNumber(options.nid))
      .nonce(IconConverter.toBigNumber(1))
      .version(IconConverter.toBigNumber(3))
      .timestamp(options.timestamp)
      .value(convertToLoopUnit(transactions.value))
      .method(options.method)
      .params(options.params)
      .build();

    const rawTx = IconConverter.toRawTransaction(tx);
    const hash = serialize(rawTx);

    const result = ICONService.signTx(transactions, options);

    expect(result).toBe(hash);
  });

  describe('transfer', () => {
    test('send native coin', () => {
      const mock_sendNativeCoin = jest.spyOn(ICONService, 'sendNativeCoin').mockImplementation();

      transfer({}, true);

      expect(mock_sendNativeCoin).toBeCalledTimes(1);
      expect(window[signingActions.globalName]).toBe(signingActions.transfer);
    });

    test('send token', () => {
      const mock_setApproval = jest
        .spyOn(ICONService, 'setApproveForSendNonNativeCoin')
        .mockImplementation();

      transfer(null, null, null, false);

      expect(mock_setApproval).toBeCalledTimes(1);
    });
  });
});
