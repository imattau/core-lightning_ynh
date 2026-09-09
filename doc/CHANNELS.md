# Channels

## YunoHost config panel

For the normal Alby Hub + CLN workflow, open the Core Lightning app's
YunoHost config panel and use **Peers & channels**:

1. Leave **Peer selection** on **Discovered** and choose a peer from the
   discovered list. Core Lightning supplies the peer's address through gossip
   or DNS.
2. In **On-chain funding**, click **Generate deposit address** and send
   on-chain Bitcoin to the
   displayed address.
3. Wait for the transaction to confirm in Core Lightning.
4. Click **Connect to peer** and confirm the success message.
5. Enter the channel amount in satoshis.
6. Leave **Public channel** disabled unless you intentionally want an
   announced routing channel.
7. Tick the explicit funding confirmation and click **Open channel**.
8. Use **Show channels** to monitor `OPENINGD`, confirmation-waiting, and
   `CHANNELD_NORMAL` states.

The amount is taken from Core Lightning's confirmed on-chain wallet balance,
not from an Alby Hub embedded wallet. A channel is usable by Alby Hub only
after the funding transaction reaches the required confirmation state.

If no peers are discovered, select **Manual** peer selection and enter the
peer's 66-character node ID, host, and P2P port. A fresh CLN node may need an
initial bootstrap peer before gossip can populate the discovered list.

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
