# Backup

Core Lightning state is not interchangeable with a Bitcoin Core blockchain backup.

At minimum protect all of the following from the package data directory:

- `hsm_secret` (or the v25.12+ mnemonic represented by it): required for on-chain funds;
- `emergency.recover`: static channel backup, updated as channels change;
- `lightningd.sqlite3`: live channel state, required for normal channel operation and closure.

The package stops `lightningd` before backup and **does not restart it automatically afterward**. This is deliberate, not an oversight: YunoHost only archives the declared paths *after* the backup script returns, so restarting first would let a freshly-active lightningd rewrite `$data_dir` (sqlite3 db/journal, gossip store) while the archive is still being built - racing the backup against a live database and risking a torn, unreadable snapshot (this was hit in practice: a `FileNotFoundError` on `lightningd.sqlite3-journal` mid-archive, and separately, restored archives that failed to start with no error output at all - consistent with a corrupted database from exactly this race). Start the service manually (`yunohost service start core_lightning`) once a backup completes.

Secure key backups must be kept separately from ordinary YunoHost backups. Anyone who obtains `hsm_secret` may be able to steal funds. A YunoHost backup is not a guarantee of Lightning fund recovery.
