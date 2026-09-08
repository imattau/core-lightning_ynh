# Recovery release gate

Recovery testing is required before stable publication.

Core Lightning documents these distinctions:

- `hsm_secret` is sufficient to recover on-chain funds, but not funds still in channels;
- `emergency.recover` can support static-channel recovery with peer cooperation and should be treated as a last resort;
- a database restore is only safe when it is known to be the latest state. An old snapshot can permanently lose channel funds.

For current CLN releases, also preserve the 12-word BIP39 mnemonic when one
was created during node setup; otherwise preserve `hsm_secret`. Keep
`emergency.recover` and the latest `lightningd.sqlite3` with the backup set.
The Alby Hub recovery phrase belongs to an embedded LDK wallet and does not
restore a CLN-backed wallet.

The test plan must cover a fresh node, an open channel, restart, stopped backup, restore of the newest backup, and emergency recovery from a deliberately damaged database. Never test this with meaningful mainnet funds.
