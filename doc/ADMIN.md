# Administration

The package intentionally does not ship a web wallet UI. Use `lightning-cli` over the local Unix socket for node, peer, channel, invoice, and payment operations.

The package does not open channels, choose peers, manage liquidity, or pay invoices. Those are operator and financial decisions.

The package resolves `bitcoin-cli` from the installed Bitcoin Core resource
directory instead of assuming a particular upstream version. The service is
explicitly added to the `bitcoin_core` group, and lifecycle checks verify that
the service user can execute both `bitcoin-cli` and the bundled `pay` plugin.

The configuration panel also exposes the safe operator controls needed by a
web consumer such as Alby Hub: public announce address, node color, routing
base/proportional fees, minimum channel capacity, and gRPC. Fee values are
defaults for new channels; use Core Lightning's per-channel RPC commands when
changing an existing channel policy.

The panel does not accept or store a recovery phrase. CLN's mnemonic is the
node root secret, not a mutable setting. Export it with
`lightning-hsmtool getsecret`, and protect `hsm_secret`, `emergency.recover`,
and the latest database according to `doc/BACKUP.md`.

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

**Port auto-detection**: both `ports.p2p` and `ports.grpc` are real YunoHost port resources, provisioned (and bind-tested against other apps) at install time regardless of whether gRPC is enabled yet - the config-panel `p2p`/`grpc_port` getters read those resource-assigned values (`port_p2p`/`port_grpc` app settings) rather than the literal manifest defaults, so an admin normally never needs to manually pick a port. This is what let CLN's P2P listener move off `9735` automatically on this server, since `alby_hub`'s embedded LDK node already held it.

The one gap that auto-detection *can't* close: `port_p2p` and `port_grpc` are each checked against other apps independently, not against each other, so they could in principle still land on the same value. `ynh_cln_write_config` guards against this directly - if gRPC is enabled and its port equals the P2P port, it refuses to write the config and `ynh_die`s with a clear message rather than producing another silent conflict. If you hit that, set a different `grpc_port` via the config panel.
