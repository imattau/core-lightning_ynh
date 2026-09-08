# Administration

The package intentionally does not ship a web wallet UI. Use `lightning-cli` over the local Unix socket for node, peer, channel, invoice, and payment operations.

The package does not open channels, choose peers, manage liquidity, or pay invoices. Those are operator and financial decisions.

Removal is deliberately conservative: the package checks `listfunds` and
refuses to remove itself while local wallet or channel funds are reported.

## gRPC (for local consumer apps)

RPC over TCP is opt-in and off by default. Enabling `grpc_enabled` in the config panel turns on CLN's built-in gRPC plugin, bound to `127.0.0.1:<grpc_port>` (default `9736`). This is never opened in the firewall — it is reachable only from this host, and only to holders of the auto-generated client certificate.

On first startup with gRPC enabled, CLN generates `ca.pem`, `client.pem`, and `client-key.pem` under `$data_dir/bitcoin/`. The package then grants the `core_lightning` unix group read access to exactly those three files (`ynh_cln_fix_grpc_cert_perms` in `_common.sh`) — `hsm_secret` and everything else in that directory stays `0600`, owner-only. A consumer app on the same server (e.g. Alby Hub) gets access by joining the `core_lightning` group and reading its `CLN_LIGHTNING_DIR` from that same path.
