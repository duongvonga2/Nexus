```bash
# inconsistent version, name in code getRelayersProperties
# https://github.com/icon-project/btp/blob/goloop2moonbeam-iconloop/javascore/bmc/src/main/java/foundation/icon/btp/bmc/BTPMessageCenter.java
goloop rpc call --uri http://localhost:9080/api/v3/icon --method getRelayerManagerProperties --to cx26cdb2d9cf33dee078056532175a696b8a9fcc71

goloop rpc call --uri http://localhost:9080/api/v3/icon --method getRelayers --to cx26cdb2d9cf33dee078056532175a696b8a9fcc71

goloop rpc sendtx call --uri http://localhost:9080/api/v3/icon --method distributeRelayerReward --to cx26cdb2d9cf33dee078056532175a696b8a9fcc71 --key_store godWallet.json --key_password gochain --step_limit 10000000000 --nid 3

goloop rpc sendtx call --uri http://localhost:9080/api/v3/icon --method claimRelayerReward --to cx26cdb2d9cf33dee078056532175a696b8a9fcc71 --key_store godWallet.json --key_password gochain --step_limit 10000000000 --nid 3


goloop rpc txresult 0xfb0bb38bcf092398c7a333ae9f1f217d64db078fd428c63fd451fa1179b3bdee --uri http://localhost:9080/api/v3/icon
```