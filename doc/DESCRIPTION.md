Core Lightning is a self-hosted Lightning Network node for YunoHost.

It uses a local `bitcoin-core_ynh` installation as its Bitcoin backend, runs
under a dedicated Unix user, stores Lightning state in a persistent data
directory, exposes Lightning P2P networking on TCP 9735, and keeps its
administrative RPC on a local Unix socket.

The package does not provide a web wallet interface and does not make
financial decisions for the operator: it does not automatically open
channels or choose a peer, manage liquidity, or pay invoices. Its YunoHost
config panel can display gossip-discovered peers for the operator to select.

Before using real funds, read the package backup and recovery documentation.
Lightning key material and channel state require more care than an ordinary
re-downloadable blockchain dataset.
