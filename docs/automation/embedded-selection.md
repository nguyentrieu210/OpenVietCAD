# OpenVietGIS CAD selection bridge (candidate source integration)

The web build (`?embed=1`) exposes an **optional** `selection` capability in its
existing `ocs:ready` message, without changing the 2026.46 save/dirty handshake.
Only the direct same-origin parent iframe can issue `opencadstudio-host` commands.
The outer OpenVietGIS relay uses a separate origin and a fresh channel; this
native engine never receives GIS project IDs, tokens, or API endpoints.

## Messages

- After `ocs:loaded`, native engine announces `ocs:selection` with
  `{name: <active drawing basename>, handle: <uppercase DXF hex> | null}`.
  Null represents clear **or multiple** selected entities; it never pretends
  to know which multi-selection item maps to a GIS object. Announcement is
  deduplicated and pinned to the same loaded tab/document, not sent before load.
- Host may issue `ocs:select` with `{name, handle}`. The native command accepts
  only 1–16 ASCII hex digits representing a nonzero u64 handle, requires the
  active loaded tab and matching basename, and selects **one existing visible
  entity in the current space**. Hidden, reference-only, off-scale and unknown
  entities are rejected. No document edit, save, automatic zoom or export.
- Web host/relay must check origin, source iframe, negotiated capability, and
  bounded handle before forwarding. The GIS application separately revalidates
  handle → source feature against project-scoped, version-pinned conversion
  provenance before showing GIS or 3D actions.
- Older 2026.46 binary distributions lack the selection capability and should
  retain manual handle lookup. Do not advertise it unless this source change
  is rebuilt and independently reviewed.

## Verification / release gate

Run `cargo test --locked --lib embedded_handle_parser_rejects_invalid_or_ambiguous_handles`,
`cargo test --locked --lib embedded_host_selects_only_one_resident_visible_entity_without_edit`,
`cargo check --locked --target wasm32-unknown-unknown --bin OpenCADStudio`.
Use a pinned `trunk build --release` from the same reviewed source before any
staging validation in a real browser; then review release manifest, license,
CSP, origin/cookie isolation and test actual click-to-handle selection with a
known DXF imported through PostGIS. No production deployment is implied.

## Verification record — 2026-11-23
- On the isolated `feature/034-cad-native-selection` branch,
  `cargo check --locked --target wasm32-unknown-unknown --bin OpenCADStudio`
  **passed**, `dev` profile in 9m17s. The build reported upstream warnings,
  no feature-specific compile errors.
- Standalone Rust tests extracted from the checked-in handle parser and
  single-selection formatter passed 3/3. The scene-selection unit test was
  added to source but has **not** been executed as part of a full test harness.
- Browser proof of the actual rebuilt engine is **not yet available**. The
  `trunk build --release` attempt was terminated intentionally when concurrent
  geometry compilers exhausted swap on the shared CAD VPS. Staging scripts
  and synthetic DXF harness were created under `/tmp/ovg-034-*`, but no release
  bundle was published and no service was modified.
- Before release: use a dedicated build runner with ample memory, run native
  scene unit tests, generate a self-contained WASM bundle from this commit,
  execute the local two-origin Chromium test, review license/provenance/CSP,
  then approve deployment separately.
