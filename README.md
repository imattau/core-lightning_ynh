# Core Lightning for YunoHost

`core-lightning_ynh` packages a systemd-managed Core Lightning node using a local `bitcoin-core_ynh` installation as its Bitcoin backend.

This is an early packaging skeleton. Mainnet support is intentionally conservative: the package keeps RPC on a Unix socket, runs as a dedicated service user, exposes only the Lightning P2P port, and treats key/channel-state backup as a release gate.

## Current status

- amd64 and arm64 upstream release archives are wired into the manifest.
- Mainnet and local Bitcoin Core are the only supported configuration.
- The package refuses to install until `bitcoin-core_ynh` provides its dedicated CLN RPC credential. Bitcoin Core's broad cookie is not copied to the CLN user.
- A mainnet Core Lightning startup test should wait until Bitcoin Core has finished initial block download. Bitcoin Core's RPC can be reachable while it is still syncing, but CLN must independently catch up to the Bitcoin chain. Use Bitcoin Core regtest for fast installation and integration tests.
- Regtest two-node, pruning, destructive restore, attestation, and catalog publication remain to be implemented.

The Nostr Catalog is the intended distribution catalog for this project; the
official YunoHost catalog is not a publication target. Its declaration
requirements are documented in
[`doc/CATALOG.md`](doc/CATALOG.md). The repository already includes the
reusable static-security workflow, but publication must wait for the release
gates and a public, committed repository ref.

## First commands

After Bitcoin Core has synchronized, use the local RPC socket as the package user. The
`--lightning-dir` value is the CLN base directory; Core Lightning adds the
`bitcoin` network directory below it:

```sh
sudo -u core_lightning lightning-cli --lightning-dir=/home/yunohost.app/core_lightning getinfo
sudo -u core_lightning lightning-cli --lightning-dir=/home/yunohost.app/core_lightning listpeers
```

Read `doc/BACKUP.md` and `doc/RECOVERY.md` before funding the node.

## Backend readiness and testing

Check Bitcoin Core before diagnosing a CLN startup failure:

```sh
bitcoin-cli -conf=/etc/bitcoin_core/bitcoin.conf getblockchaininfo
```

For a real mainnet node, wait until `initialblockdownload` is false and the
chain is near the current network tip. During IBD, Bitcoin Core may answer RPC
requests while Core Lightning is still unable to become operational. A package
install test that times out during CLN RPC startup is therefore inconclusive
until backend synchronization is complete.

Use Bitcoin Core regtest for fast CI and two-node CLN tests. Mainnet tests
should use negligible funds and should only begin after the regtest and
pruned-backend cases pass.
