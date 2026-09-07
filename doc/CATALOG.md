# Nostr Catalog checklist

This project is intended for publication through the Nostr Catalog, not the
official YunoHost application catalog. No YunoHost `apps.toml` entry,
YunoHost-Apps organization transfer, or official catalog pull request is
required for this publication path.

The local `nostr_catalog_ynh` publisher creates a signed declaration for this
package. The declaration binds the app to:

- app id: `core_lightning`;
- package version;
- the canonical public package-repository URL and exact Git commit;
- the SHA256 of the exact `manifest.toml`;
- the SHA256 of the repository tree at that commit.

Therefore the repository must be public, committed, and immutable at the
published ref before the declaration is created. The publisher uses the
package repository URL and Git ref; `[upstream].code` is the Core Lightning
upstream project and is not the package repository.

## Required pre-publication checks

1. Publish the package repository and select a stable commit or release ref.
2. Run the reusable static-security workflow successfully.
3. Confirm manifest validation, package linting, ShellCheck, and lifecycle
   tests pass on the supported architectures.
4. Publish the signed declaration from the Nostr Catalog Publisher panel.
5. If the catalog trust policy requires `package_check`, publish an attestation
   from a protected workflow using a dedicated verifier key.

Never commit the catalog publisher private key or CI verifier private key, and
never reuse either identity for the other role.

The package is not ready for publication until Bitcoin Core service-to-service
authentication, regtest, pruning, backup/recovery, and removal-safety gates
are complete.
