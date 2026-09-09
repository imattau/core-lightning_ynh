# gRPC backend contract (for local consumer apps)

This package can optionally expose CLN's built-in gRPC plugin for other apps on the same YunoHost server to use as a Lightning backend (e.g. Alby Hub). It is off by default and never firewall-exposed.

CLN's bundled `cln-grpc` plugin does **not** stay dormant on its own just because no `grpc-port` is configured — it self-activates on a built-in default port regardless. To make "off by default" actually true, the package writes `disable-plugin=cln-grpc` whenever `grpc_enabled` is false.

## Enabling it

Set `grpc_enabled = true` (and optionally a non-default `grpc_port`) via the config panel. The service restarts and, on the next successful startup, CLN generates its gRPC TLS material if it does not already exist.

## What a consumer app gets

- **Address**: `127.0.0.1:<grpc_port>` (default `9736`).
- **Cert directory**: `$data_dir/bitcoin/` — contains `ca.pem`, `client.pem`, `client-key.pem` after the first grpc-enabled startup. This is CLN's mainnet network subdirectory; `hsm_secret` and other node-critical files live in the same directory but are deliberately left `0600` root:`core_lightning`-group-owned-but-not-group-readable — only the three cert files are group-readable.
- **Access mechanism**: plain unix group, not ACLs. The consumer app's install/upgrade script must run `usermod -aG core_lightning "$consumer_app_user"` and, if it uses systemd sandboxing (`ProtectSystem=strict` or similar), explicitly allowlist `$data_dir/bitcoin` via `ReadOnlyPaths=`.

## What this package guarantees

- The gRPC endpoint is bound to loopback only and is never added to the firewall.
- Only `ca.pem`, `client.pem`, and `client-key.pem` are ever made group-readable; every other file under `$data_dir` (including `hsm_secret`) stays owner-only.
- Permission fix-up (`ynh_cln_fix_grpc_cert_perms`) runs after every install, upgrade, restore, and config-panel change to `grpc_enabled`/`grpc_port`, so it self-heals if CLN regenerates certs.

The config-panel operational status reports whether the CLN RPC, Bitcoin RPC,
and gRPC certificates are usable. A consumer should not be considered ready
just because the gRPC port is configured.

## Port auto-detection, and its one gap

`grpc_port` is not just a literal default - the config-panel getter reads the actual YunoHost-assigned `port_grpc` resource value, which is conflict-checked against other apps at install time (same mechanism as `port_p2p`). This is why gRPC's port doesn't normally need manual attention even when another app (e.g. a Lightning wallet's own embedded node) already holds `9735`, CLN's own default P2P port.

The one thing this can't self-resolve: `port_p2p` and `port_grpc` are each checked independently against *other* apps, not against each other, so they could still coincide. `ynh_cln_write_config` refuses to write a config where they're equal - it `ynh_die`s with a clear message instead of producing another collision. If you hit that, pick a different `grpc_port` via the config panel.

## What this package does not guarantee

- It does not manage the consumer app's group membership or systemd sandbox exceptions — that is the consumer package's responsibility.
- It does not support the CLN hold-invoice plugin's separate gRPC listener; only the main gRPC plugin is wired up.
