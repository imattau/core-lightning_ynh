# Core Lightning YunoHost package guidance

## Backend readiness

Core Lightning depends on the local `bitcoin-core_ynh` service. A reachable
Bitcoin Core RPC endpoint is not enough to prove that CLN can start: Bitcoin
Core may still be in initial block download while answering RPC requests.

Before treating a mainnet CLN install or startup timeout as a package defect,
check `getblockchaininfo` and wait until `initialblockdownload` is false and
the chain is near the network tip. Use Bitcoin Core regtest for fast package
installation and two-node integration tests.

## Test safety

- Do not open channels, pay invoices, or fund a mainnet test node.
- Use regtest for channel, payment, restart, backup, and restore tests.
- Treat `hsm_secret`, the CLN database, and channel-recovery files as financial
  state.
- Keep the CLN RPC on its Unix socket; never expose administrative RPC over the
  Lightning P2P port.
