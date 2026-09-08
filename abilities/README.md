# Agent Abilities Registry

`abilities.json` is the canonical machine-readable capability inventory for tmsteph.com.

## Maintenance rules

- Update a capability when its access path, permission boundary, or health changes.
- Use `working` only after the real path has been verified recently.
- Use `partial` for session-dependent, incomplete, or not-recently-tested paths.
- Use `planned` for intended capabilities that are not operational yet.
- Keep credentials, tokens, employee IDs, private addresses, account numbers, and other secrets out of this public registry.
- Preserve approval boundaries in the `permission` field.
- Update the top-level `updated` date whenever the registry changes.

The HTML page is a renderer. The JSON is the source of truth.