# Channels

Basic operator flow:

```sh
lightning-cli getinfo
lightning-cli newaddr
lightning-cli connect NODE_ID HOST 9735
lightning-cli fundchannel NODE_ID AMOUNT_SATOSHIS
lightning-cli listfunds
lightning-cli close NODE_ID
```

Review the command and destination carefully before committing funds. No automatic channel opening or liquidity management is enabled.
