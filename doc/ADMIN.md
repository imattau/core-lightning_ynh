# Administration

The package intentionally does not ship a web wallet UI. Use `lightning-cli` over the local Unix socket for node, peer, channel, invoice, and payment operations.

The package does not open channels, choose peers, manage liquidity, pay invoices, or expose RPC over TCP. Those are operator and financial decisions.
