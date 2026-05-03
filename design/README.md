# design/

Photoshop source files for the redesign's mechanical-motif visual elements. **Not served — git-tracked design source only.**

## Files

- `gear.psd` — editable source for the rotating-gear element (the brass-gear icon that lives in the header and 404 page)
- `nozzle.psd` — editable source for the steam-nozzle element (paired with the gear in the original mechanical motif)
- `mobileLogo.psd` — editable source for the mobile/condensed logo variant

## Origin

Lifted from `seanreardon.com/images/` (cPanel `public_html/images/`) on **2026-05-02** during the redesign asset migration. Per the project decision, PSDs live in this repo only — the server copies were deleted at the same time as this lift to centralize editable design source in version control. Rendered PNGs remain on the legacy server until the redesign cuts over (still referenced by the live PHP site).

## How they're used

The PSDs aren't directly referenced by the build. They're the editable source from which the rendered PNGs (in `src/assets/images/`) were derived. When the visual-direction plan kicks off:

- Open these in Photoshop / Photopea / Affinity Photo
- Modify the gears/nozzles for the modernized motif (size, color, animation states)
- Export updated PNGs back to `src/assets/images/`
- Commit both the PSD edit and the PNG export together

## Conventions

- Don't reference PSDs from the build pipeline — Astro/Vite can't process them, and PSDs are large
- Don't deploy `design/` to the server — it's repo-only by design
- If a new visual asset gets added, drop the PSD here and the rendered PNG in `src/assets/images/` with the same base name
