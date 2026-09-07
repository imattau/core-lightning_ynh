# Testing roadmap

The stable gate is a Bitcoin Core regtest plus two CLN nodes. It must cover install, RPC health, wallet funding, channel open, payment, restart, stopped backup, restore, and close.

Separate cases must run with pruned Bitcoin Core and verify recovery/rescan behavior. Mainnet smoke testing should use negligible funds only after the regtest and pruning cases pass.
