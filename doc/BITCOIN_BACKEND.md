# Bitcoin Core backend contract

The package is deliberately local-backend-only in v1. It expects the YunoHost app id `bitcoin_core`, network mainnet, RPC on `127.0.0.1:8332`, and a service-specific credential that CLN can use with:

```ini
bitcoin-rpcconnect=127.0.0.1
bitcoin-rpcport=8332
bitcoin-rpcuser=...
bitcoin-rpcpassword=...
```

The current `bitcoin-core_ynh` package provisions a dedicated credential in `/etc/bitcoin_core/core-lightning.rpc`, and renders it into Bitcoin Core's localhost RPC configuration. The file is root-readable only; the CLN installer reads it while running as root and writes the credential into CLN's root-owned configuration.

Bitcoin Core does not provide method-level RPC ACLs, so this is service-scoped authentication rather than fine-grained authorization. The package must never add the CLN user to the Bitcoin data group or copy Bitcoin's broad cookie into CLN.
