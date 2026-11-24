# R048 CAD stability capability inventory
Baseline source 2bc3537346ff2a844039685186a1b32da7149d6f; live workflow 45347995900.
The registry src/modules/registry.rs contains 12 built-in module groups. A listed module or command is not browser acceptance.

| Area | Source evidence | Qualification |
|---|---|---|
| Draw/modify | src/modules/draw | Open: create line/polyline/circle, edit, snap, undo/redo, compare saved geometry |
| Parametric | src/modules/parametric; tests/parametric_constraints_solve.rs | Open browser fixture |
| Model and surface | src/modules/model, src/modules/surface; tests/presspull_curved_boundary.rs | Open: primitive, extrusion, Boolean, independent output |
| Insert/block | src/modules/insert, src/modules/block_editor; tests/block_hatch_export.rs | Open browser fixture |
| Annotation/text/table | src/modules/annotate, text_editor, table_cell | Open browser fixture |
| View/manage/layout | src/modules/view, manage, layout; tests/zoom_extents_coverage.rs | Open browser fixture |
| Native DWG and DXF | ci/ovg/smoke.cjs | Prior synthetic open/save PASS in GitHub and live, not all versions or commands |
| Host selection | src/io/host_bridge.rs | Advertised selection capability; prior event observed, two-way handle acceptance open |
| Read-only and save IDs | src/io/host_bridge.rs, ci/ovg/relay.js | Negative tests and revoked rights open |
| Incremental entity mutation | src/io/host_bridge.rs | Not advertised; do not claim realtime CAD entity edits |
| Desktop plugins/printing/headless | README.md | Desktop-specific; not claimed for embedded WASM |

The current main WASM has 124604137 code-section bytes vs 73653200 in the old official binary; data sections 37203500 vs 35430896. The bounded solidcore profile is a plausible contributor, not proven causal without an isolated A/B build. Do not change numerical optimization blindly.

## Transport candidate
Precompress original WASM into deterministic gzip sidecars; verify decompressed SHA-256. Only use in a release-specific static location with nginx gzip_static on, gzip_vary on and correct application/wasm MIME. Immutable caching is safe only for immutable release paths, not /relay.html. Production config unchanged here. Validate actual browser and compare cold/warm performance before rollout.

Measured on loopback with actual 2bc3537 artifact and Chromium software GPU: 188634517 raw bytes / 59439256 gzip bytes for the two unique WASM assets. Cold main WASM network transfer 52960521 bytes; warm main WASM transfer zero with persistent browser profile and explicit 1 GiB cache budget. DXF and DWG open/save succeeded; no page errors or external/failed requests. Default ephemeral browser cache previously missed the large WASM, so cache retention cannot be guaranteed on every device. Worker transfer is not measured by frame resource timings. See evidence JSON; timings are single samples, not p95 or production WAN measurements. Compiler cache is configured with bounded save and pinned actions; its effectiveness requires a real CI run. No engine or production changes.

## Additional actual-WASM acceptance
On the pinned 2bc3537 artifact, isolated standalone control commands LINE, CIRCLE, closed PLINE, MOVE and BOX passed. Structured undo/redo changed entity counts correctly. Independent ASCII DXF group-code comparison verified line endpoints, moved circle center/radius, four polygon vertices and closed bit. The 3D BOX was present and measured bounds [20,30,40] to [26,35,44] matched. The plain UNDO command returned completion before an immediate count changed; this does not establish a UI defect or qualification. Direct interactive mouse, snapping, other edit/3D commands, 3D file roundtrip remain open.

The real two-origin relay selected explicit handle 2A and returned 2A, rejected unknown FFFFFFFFFFFFFFFF, permitted save for writable session and emitted no save in read-only session during bounded observation. No dirty event, page error or external request. This qualifies only host selection/ack and read-only relay save guard, not full GIS linkage, fine-grained server authorization, manual click or all read-only mutation paths. Tests use standalone automation only on loopback; production embed automation remains disabled. CI runs both scripts on future candidates; CI not yet executed on this branch.

## Expanded acceptance and shell runtime branding
Actual WASM: ROTATE 90 degrees, SCALE 2, OFFSET 2, TRIM at intersection and EXTEND to boundary pass numeric checks. Endpoint snap and world-coordinate viewport pick pass (not physical device gestures). DWG 2018 containing the BOX was saved and reopened; entity count and 3D bounds identical. Shell branding (title, splash logo, theme-color, accent, locale) is now runtime JSON + JS applied to compiled HTML, without Rust build. Three isolated browser locale scenarios pass: fresh Vietnamese default, explicit English, system English; existing theme/name preference is not overwritten. Canvas-internal Rust theme/ribbon still compiled; not claiming complete runtime UI customization. Test excludes external logo path. Brand smoke is shell-only; existing engine regression still required. CI gates compressed unique WASM size <= 65 MB and <=70% raw. No production changes.
