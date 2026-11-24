# OpenVietGIS CAD — downstream source
Derived from HakanSeven12/OpenCADStudio, GPL-3.0. All upstream copyright,
license, third-party notices and history remain intact. This downstream
branding candidate uses the OpenVietGIS mark and Vietnamese defaults.
The Rust/WASM release must be rebuilt and verified before distribution.
This source branch includes the earlier selection bridge; it is not the
source of the unchanged official v2026.46 WASM currently served.

## Branded release candidate
Default UI palette follows the OpenVietGIS header (#132d3a); Vietnamese
is the default language. Users can choose other language/theme settings.
The existing Ribbon command structure is retained. The geometry kernel
release profile uses optimization level 1 and 64 codegen units for a bounded
build candidate. Performance and DWG/DXF regression tests are required before
replacing the currently verified upstream binary.

Build (pinned Rust 1.100.0, Trunk 0.22.2, wasm-bindgen-cli 0.2.108):
```sh
rustup target add wasm32-unknown-unknown
CARGO_BUILD_JOBS=1 trunk build --release --locked --public-url /ovg-cad-2026.46/app/
```

Keep the application on a separate origin; use the existing sandboxed
relay. Do not remove the original licensing notices.
