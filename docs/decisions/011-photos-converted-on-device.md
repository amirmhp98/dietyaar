# 011 — Photos are converted and downscaled on the device; the server accepts JPEG, PNG, WebP

**Decision.** The browser converts HEIC/HEIF with `heic-to` and downscales every image with a
canvas to a 2048 px maximum edge at JPEG quality 0.85 before upload. `POST /api/uploads` accepts
JPEG, PNG and WebP by magic bytes, rejects HEIC with `415`, limits bodies to 10 MB, and re-encodes
with `sharp` (JPEG 82, max edge 2048, metadata stripped, `limitInputPixels: 40e6`, at most two
concurrent decodes per process).

**Why.** Prebuilt `sharp` has no HEIC decoder and adding one bloats the image. Device-side
downscaling keeps real uploads under 1 MB regardless of the unknown Darkube ingress body limit,
saves Supabase egress, and strips location metadata before the bytes leave the phone.

**Consequences.** Upload is a route handler, not a server action (server actions cap bodies at
2 MB). The upload button needs JavaScript; there is no no-JS fallback. Photo logging as a whole is
behind `PHOTO_LOGGING_ENABLED`. See `tech-spec.md` § 11.
