# Isolated nginx transport check — 2026-11-24
No production config changed. Nginx 1.26.3 unprivileged www-data worker on loopback 4282, immutable test release path. First run exposed 0600 gzip sidecars (EACCES, raw fallback); corrected generator public-asset mode 0644, verified in unit test. Runtime branding assets also 0644.

- gzip negotiation: 200, application/wasm, Content-Encoding gzip, length 52960221, Vary Accept-Encoding.
- identity negotiation: 200, length 162057306, no content encoding.
- engine: public, max-age=31536000, immutable; stable relay: no-store; branding JSON: no-cache.
- nginx config check PASS. Separate isolated process stopped. Existing production package source/web tarballs, COMMIT, LICENSE, THIRD_PARTY checksums PASS.
- Not a production rollout or full rollback drill. Apply immutable cache only to version-pinned engine paths; do not cache mutable relay or brand config indefinitely. Release-specific CSP/origin protections must remain.
