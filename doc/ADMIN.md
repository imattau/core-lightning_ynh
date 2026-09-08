# Administration

The package intentionally does not ship a web wallet UI. Use `lightning-cli` over the local Unix socket for node, peer, channel, invoice, and payment operations.

The package does not open channels, choose peers, manage liquidity, or pay invoices. Those are operator and financial decisions.

Removal is deliberately conservative: the package checks `listfunds` and
refuses to remove itself while local wallet or channel funds are reported.

## gRPC (for local consumer apps)

RPC over TCP is opt-in and off by default. This is not automatic in CLN
itself: the bundled `cln-grpc` plugin self-activates on its own built-in
default port even with no `grpc-port` line present, so the package
explicitly writes `disable-plugin=cln-grpc` whenever `grpc_enabled` is
false. Enabling `grpc_enabled` in the config panel drops that disable line
and turns on the plugin instead, bound to `127.0.0.1:<grpc_port>` (default
`9736`). This is never opened in the firewall — it is reachable only from
this host, and only to holders of the auto-generated client certificate.

On first startup with gRPC enabled, CLN generates `ca.pem`, `client.pem`, and `client-key.pem` under `$data_dir/bitcoin/`. The package then grants the `core_lightning` unix group read access to exactly those three files (`ynh_cln_fix_grpc_cert_perms` in `_common.sh`) — `hsm_secret` and everything else in that directory stays `0600`, owner-only. A consumer app on the same server (e.g. Alby Hub) gets access by joining the `core_lightning` group and reading its `CLN_LIGHTNING_DIR` from that same path.

**Port collision note**: the P2P listener (`ports.p2p`, default `9735`) and gRPC (`ports.grpc`, default `9736`) are adjacent by default. If another app on this server already holds `9735`, YunoHost's port-conflict avoidance moves P2P to the next free port, which can land exactly on gRPC's own default and collide with it. If you enable `grpc_enabled` and CLN fails to start, check the P2P port actually assigned (`yunohost app config get core_lightning node.settings.p2p`) and pick a `grpc_port` that doesn't overlap it.
