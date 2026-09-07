# Backup

Core Lightning state is not interchangeable with a Bitcoin Core blockchain backup.

At minimum protect all of the following from the package data directory:

- `hsm_secret` (or the v25.12+ mnemonic represented by it): required for on-chain funds;
- `emergency.recover`: static channel backup, updated as channels change;
- `lightningd.sqlite3`: live channel state, required for normal channel operation and closure.

The package stops `lightningd` before copying state because copying SQLite while it is active can produce an unusable snapshot. This is a conservative offline snapshot, not a zero-downtime backup system.

Secure key backups must be kept separately from ordinary YunoHost backups. Anyone who obtains `hsm_secret` may be able to steal funds. A YunoHost backup is not a guarantee of Lightning fund recovery.
