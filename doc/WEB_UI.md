# Core Lightning web UI

The package is moving toward a dedicated, responsive web interface for the
Core Lightning node. The YunoHost config panel remains appropriate for static
package settings, but wallet funding, peer discovery, channel opening, QR
codes, and recovery flows need a stateful application UI.

## Design direction

The UI follows Alby Hub's information hierarchy: a left navigation rail,
large balance cards, short action paths, compact status pills, and a calm
light surface with a yellow Lightning accent. On small screens the rail
becomes a bottom navigation bar, cards stack into one column, and tables
become touch-friendly cards.

The current `web/` directory is a self-contained responsive UI prototype. It deliberately
uses no external fonts, icon CDN, or runtime JavaScript dependency so the final
package can remain self-contained.

The local API is also present in `web/server.py`. It serves the UI from
localhost and supports node status, wallet/channel readout, peer readout,
health checks, address generation, discovered-peer lookup, peer connection,
channel opening, and a guarded recovery-phrase reveal. Channel opening and
recovery display require explicit confirmation and return structured errors.

## Package integration

The package now adds:

- a localhost-only web service beside `lightningd`;
- a YunoHost-assigned web port and `resources.permissions.main` app tile;
- an admins-only protected permission by default;
- a restricted API translating approved UI operations to CLN RPC;
- no browser access to the Unix RPC socket or gRPC certificates;
- no recovery phrase in logs, URLs, browser storage, or app settings.

The phrase is rendered only after the user confirms the risk. It is kept in
page memory, with no local-storage or operation-output fallback.

The API should expose only the operations needed by the UI: node status,
wallet balances, address generation, peer discovery, peer connection,
channel opening, channel listing, and guarded recovery display. Spending
operations must always require an explicit confirmation and return structured
errors suitable for the UI.

## Mobile acceptance criteria

- usable from a 320px-wide viewport without horizontal scrolling;
- navigation collapses to a drawer and bottom tab bar;
- all controls have touch targets of at least 44px;
- QR codes and addresses remain readable and copyable;
- channel and peer lists become stacked cards;
- important confirmations remain visible above the mobile action bar;
- layout remains usable at 200% browser zoom and in landscape orientation;
- reduced-motion and keyboard navigation are supported.
