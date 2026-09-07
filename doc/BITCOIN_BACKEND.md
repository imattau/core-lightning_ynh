# Bitcoin Core backend contract

The package is deliberately local-backend-only in v1. It expects the YunoHost app id `bitcoin_core`, network mainnet, RPC on `127.0.0.1:8332`, and a service-specific credential that CLN can use with:

```ini
bitcoin-rpcconnect=127.0.0.1
bitcoin-rpcport=8332
bitcoin-rpcuser=...
bitcoin-rpcpassword=...
```

The current `bitcoin-core_ynh` package in this workspace enables RPC but relies on Bitcoin Core cookie authentication and does not yet provision a restricted CLN credential. This package therefore stops with a clear error instead of adding the CLN user to the Bitcoin data group or copying a broad cookie into another service's configuration.

The required follow-up is a small service-to-service authentication contract in `bitcoin-core_ynh`: create an `rpcauth` entry or equivalent credential for `core_lightning`, expose it through a protected app action or setting, and rotate it safely on removal.
