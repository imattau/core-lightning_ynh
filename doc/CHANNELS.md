# Channels

## YunoHost config panel

For the normal Alby Hub + CLN workflow, open the Core Lightning app's
YunoHost config panel and use **Peers & channels**:

1. Enter the peer's 66-character node ID, host, and P2P port.
2. Click **Connect to peer** and confirm the success message.
3. Enter the channel amount in satoshis.
4. Leave **Public channel** disabled unless you intentionally want an
   announced routing channel.
5. Tick the explicit funding confirmation and click **Open channel**.
6. Use **Show channels** to monitor `OPENINGD`, confirmation-waiting, and
   `CHANNELD_NORMAL` states.

The amount is taken from Core Lightning's confirmed on-chain wallet balance,
not from an Alby Hub embedded wallet. A channel is usable by Alby Hub only
after the funding transaction reaches the required confirmation state.

The panel deliberately does not provide close, invoice, payment, or liquidity
management actions yet. Those remain available through CLN's RPC for advanced
operators.

## Command-line equivalent

The equivalent low-level flow is:

```sh
lightning-cli getinfo
lightning-cli newaddr
lightning-cli connect NODE_ID HOST 9735
lightning-cli fundchannel NODE_ID AMOUNT_SATOSHIS
lightning-cli listfunds
```

Review the command and destination carefully before committing funds. No automatic channel opening or liquidity management is enabled.

When Alby Hub uses the CLN backend, its channel controls call Core Lightning
over gRPC; they do not create a second wallet or channel database. Verify the
external node with `lightning-cli getinfo`, `listpeerchannels`, and `listfunds`.
