# Core Lightning for YunoHost

`core-lightning_ynh` packages a systemd-managed Core Lightning node using a local `bitcoin-core_ynh` installation as its Bitcoin backend.

This is an early packaging skeleton. Mainnet support is intentionally conservative: the package keeps RPC on a Unix socket, runs as a dedicated service user, exposes only the Lightning P2P port, and treats key/channel-state backup as a release gate.

## Current status

- amd64 and arm64 upstream release archives are wired into the manifest.
- Mainnet and local Bitcoin Core are the only supported configuration.
- The package refuses to install until `bitcoin-core_ynh` provides its dedicated CLN RPC credential. Bitcoin Core's broad cookie is not copied to the CLN user.
- Regtest two-node, pruning, destructive restore, attestation, and catalog publication remain to be implemented.

The Nostr Catalog is the intended distribution catalog for this project; the
official YunoHost catalog is not a publication target. Its declaration
requirements are documented in
[`doc/CATALOG.md`](doc/CATALOG.md). The repository already includes the
reusable static-security workflow, but publication must wait for the release
gates and a public, committed repository ref.

## First commands

After installation, use the local RPC socket as the package user:

```sh
sudo -u core_lightning lightning-cli --lightning-dir=/home/yunohost.app/core_lightning/bitcoin getinfo
sudo -u core_lightning lightning-cli --lightning-dir=/home/yunohost.app/core_lightning/bitcoin listpeers
```

Read `doc/BACKUP.md` and `doc/RECOVERY.md` before funding the node.
