# PSD Refinement Guide

Step-by-step guide for refining the four design source PSDs (`gear.psd`, `nozzle.psd`, `mobileLogo.psd`, `fullLogo.psd`) from their original chrome+blue Y2K-tech finish to the locked era-blending brass+electrical direction.

**Direction reference:** `~/.claude/plans/visual-direction.md` — full visual thesis, principles, and rationale.

**Workflow conventions** (already locked):
- Non-destructive: original layers preserved in `ORIGINAL — do not edit` group, locked
- Refinement happens in `REFINEMENT — working` group
- Save as date-stamped versions: `<asset>-YYYY-MM-DD.psd`
- Native resolution as max export size (no artificial upscaling)
- Don't export PNGs until refinement is complete

---

> ## Amendment — 2026-05-06
>
> Two material decisions on `fullLogo.psd` re-locked the diamond and the text-panel:
>
> - **Diamond → copper, not brass.** Sean confirmed an intentional drift during method-C overlay work — the `Brushed Copper` Smart Object layer above `Diamond` produces a brushed-copper artifact. The original brass spec for `Diamond` is superseded *for fullLogo and mobileLogo only*. Wordmark, gear, and nozzle stay brass.
> - **Text panel → verdigris bronze, not warm-dark substrate.** Deep brown-black bronze base + teal-green verdigris streaks (Variant B, default). A parallel Variant A adds subtle verdigris to the diamond's recesses too (one continuous bronze artifact reading); ships as a layer-state toggle in the PSD for side-by-side comparison.
>
> Concrete material expression of the patina/reclamation atmospheric layer in `~/.claude/plans/visual-direction.md` ("brass is patina'd because it's been used", "half-reclaimed by jungle vines and waiting in a temple to be discovered"). New copper and verdigris palette sections added below.
>
> **Deferred:** whether copper accents and/or verdigris atmosphere extend to `gear.psd` and `nozzle.psd` is held until `fullLogo.psd` is finished and reviewed in production context. Until that decision lands, gear/nozzle refinement proceeds per the existing brass + cyan spec.
>
> **Decision context:** post idea `012-verdigris-bronze-logo-decision.md` (in `portfolio-redesign-agent/post-ideas/`), plan `~/.claude/plans/okay-i-m-starting-a-mossy-narwhal.md`, feedback memory `feedback-design-distinctive-over-safe.md` (in `portfolio-redesign-agent/memory/`).

---

## Locked palette quick-reference

These are the hex values you'll be using throughout. Keep this open in a side window while working.

### Brass primary (warm metal foundation)

```
brass-light:    #E8B95E   (highlight side, gradient lights, shine)
brass:          #C49539   (default surface — main brass tone)
brass-dark:     #8E6A21   (recessed/shadow, gradient depths)
brass-oxidized: #5F5028   (aged, atmospheric edges, oxidized states)
```

### Copper (diamond — added 2026-05-06)

Used for `fullLogo.psd` `Diamond` + `Brushed Copper` layers (the brushed-copper artifact on the left of the wordmark) and the equivalent diamond shape in `mobileLogo.psd`. NOT used for gear, nozzle, wordmark, or SR letterforms — those stay brass.

```
copper-light:    #DA8A4A   (highlight side, polished sheen, lit edges)
copper:          #B5651D   (default surface — main copper tone, brushed face)
copper-dark:     #6B3A1A   (recessed/shadow, channel walls' shadow side, gradient depths)
copper-oxidized: #4A2812   (deepest aged-copper recess, atmospheric edge)
```

Tune against the actual PSD's current `Brushed Copper` layer values — these proposals are starting points. Sean's existing diamond color is the source of truth; these tokens document it for future cross-asset cohesion.

### Verdigris (bronze panel oxidation — added 2026-05-06)

Used for the `Verdigris Streaks` layer above the `Text Background` panel. Expresses the temples/ruins atmospheric layer concretely on the logo's primary surface.

```
verdigris:       #3D8579   (primary teal-green, default streak color)
verdigris-light: #5DA89C   (lighter streak edges where oxidation thins)
verdigris-deep:  #1F4D45   (deepest streak recesses, low-light pockets)
```

Verdigris streaks live ONLY on the panel for v1 (Variant B). Variant A — adding subtle verdigris on the diamond too — is captured as a layer-state experiment (see `fullLogo.psd` Phase 3 Step 8).

### Electrical accents

```
electric-cyan:      #00DDFF   (saturated brilliance — laser segments, signal traces)
electric-cyan-glow: #66E8FF   (lighter halo for diffusion, outer glows)
electric-cyan-deep: #0085C6   (deeper variant for under-glow / shadow side)

plasma:        #FF5A1A   (orange-red fire moments — sparing use)
plasma-glow:   #FF8A4A   (lighter halo)
ember:         #FFA01A   (yellow-orange flame highlight)
```

### Personality palette (sparing use, mostly 404 + easter eggs)

```
joker-green:      #6BFF1A
hulk-purple:      #9B30E5
```

### Foundation

```
bg:            #0d1117   (cool dark, page background)
bg-elevated:   #2A303C   (lifted surfaces, deco panels)
deco-cream:    #E8DFC8   (warm decorative inset surfaces)
```

---

## General refinement principles

The work is a **re-skinning, not a redraw.** Same geometry, fundamentally different finish. The mental shifts:

1. **Chrome silver → brass (or copper, for the diamond)** in all gradient overlays. Replace gradient stops with the per-asset palette:
   - Old chrome stops typically: light silver (`#F0F0F0`) → mid silver (`#A0A0A0`) → dark silver (`#404040`)
   - **Default — brass** (gear, nozzle, wordmark, mobile-logo SR letterforms): `brass-light` (`#E8B95E`) → `brass` (`#C49539`) → `brass-dark` (`#8E6A21`)
   - **Diamond only — copper** (`fullLogo.psd` `Diamond` + `Brushed Copper` layers, plus the equivalent diamond shape in `mobileLogo.psd`): `copper-light` (`#DA8A4A`) → `copper` (`#B5651D`) → `copper-dark` (`#6B3A1A`)

2. **Blue accents → electrical cyan or brass-edge.** The original blue accents had two roles:
   - Decorative outline (replace with `brass-dark` for brass-edged surfaces)
   - Laser/signal energy (replace with `electric-cyan` and `electric-cyan-glow`)
   - Decide per-layer which role the original blue was playing.

3. **Glossy reflective → matte/dimensional brass.** If a layer has heavy gloss highlights from Bevel & Emboss, dial them back. Brass reflects diffusely; chrome reflects sharply. Adjust `Highlight Mode` opacity in Bevel & Emboss to ~50-65% (vs. typical 75-85% for chrome).

4. **Add subtle electrical glow** to surfaces that should feel "alive." Outer Glow with `electric-cyan-glow` at low opacity (15-25%) on key brass surfaces gives the era-blending energy without being heavy-handed.

5. **Drop shadows stay roughly the same** — pure black at 30-50% opacity for dimensional separation. They're not era-specific.

---

## gear.psd

> **Amendment locked 2026-05-06 (evening); rotation timing revised 2026-05-07.** Direction: **brass primary + subtle copper accents + punched-up colors + slightly more dimensional depth** than the original spec. **No ornate detail (no rivets).** **No verdigris** — the gear is the home of the ambient rotation animation; verdigris would muddy under motion.
>
> **Rotation timing:** **2-3 seconds per revolution** (continuous, no interval). Revised 2026-05-07 from the original 30s "subliminal ambient" lock — 30s was too imperceptible to read as machine motion, while 2-3s reads as visible-ambient working gear without becoming aggressive UI animation. **At this rotation speed, perceptual motion-blur masks directional bevel falseness** that would otherwise be visible at slower speeds — so the calibrated deeper bevel works without rotation looking "false-lit."
>
> Calibrations apply *within* the existing brass + cyan electrical refinement steps below:
>
> - **Bump bevel highlight opacity** from 60% to **70-75%** for richer dimensional read
> - **Deepen bevel size** from 3-5 px to **5-7 px** (more pronounced relief)
> - **Outer Glow opacity** can come up from 25-40% to **35-50%** for slightly more "machine is alive" energy
> - **Two-material construction (locked 2026-05-07):** the gear ships as **brass outer ring (teeth) + copper inner ring (hub)**, implemented as separate layers each with their own radial Gradient Overlay. The original guide proposed "subtle copper accents painted on inner ring cuts and center hole rim" — that approach didn't land. Two distinct layers reads cleaner at every scale and gives a physically credible multi-metal material story (real gears often have brass teeth on copper/bronze hubs).
>   - **Outer ring layer** (the original `gear` layer): brass radial gradient (`#E8B95E` → `#C49539` → `#8E6A21`), all the original effects (Bevel, Stroke, Satin, Gradient Overlay, Outer Glow)
>   - **Inner ring layer** (separated; named `Layer 4` in the working file): copper radial gradient (`#DA8A4A` → `#B5651D` → `#6B3A1A`, slightly altered to taste), same effect stack as outer ring tuned to the smaller surface
>   - The brass-to-copper transition at the layer boundary can optionally get a thin copper-oxidized inner shadow (1-2 px, low opacity) to suggest a *seam* rather than a *gradient* — purely aesthetic tuning
>
> Everything else in the gear.psd refinement spec below proceeds unchanged — these are *calibrations on top of* the steps, not replacements.
>
> **Pattern note (2026-05-07):** the structural-restructuring instinct that produced this two-material gear (also visible in the masked-Outer-Glow on mobileLogo) is becoming a recurring craft move — when subtle additive effects don't land, separate the composition into distinct components and let materials/effects work inside the new structure. Worth carrying into nozzle work and beyond.

### Layer construction (as observed in the working PSD)

```
REFINEMENT — working
  gear                (top, visible, 5 effects)
    Effects:
      Bevel & Emboss  [Style: Emboss | Highlight: WHITE 50% Pin Light | Depth: 750%]
      Stroke
      Satin           [Color: BLACK 50% Overlay]
      Gradient Overlay [B&W ramp, Blend: Hue, Style: Radial, Scale: 150%]
      Outer Glow
  backlighting copy   (visible — the active blue halo)
  backlighting        (hidden — original backup)
  Layer 2             (hidden, black backdrop)
  Layer 1             (visible — baked-in chrome gear underneath; bleeds through edges)
ORIGINAL — do not edit  (locked group preserving the source)
Background            (hidden, white)
```

**The chrome look has FOUR sources, not one.** Just changing gradient stops won't shift the finish. All of these contribute and need to change together:

- (a) **`Layer 1` chrome bleed-through** at tooth gaps and inner edges
- (b) **WHITE Pin Light bevel highlight** at 50% — the bright shine
- (c) **BLACK Overlay satin** at 50% — the chrome shadow ridges
- (d) **Hue-blend gradient overlay** with a B&W ramp — this carries no color, so swapping stops alone does nothing until the blend mode changes

### Refinement steps (work top-down through the effects panel)

#### Step 1 — Address `Layer 1` chrome bleed BEFORE touching effects

The `gear` layer's effects don't fully obscure `Layer 1` underneath. The chrome you see at tooth gaps and the inner ring is bleed-through from `Layer 1`'s rasterized chrome.

- **Option A (preferred):** Hide `Layer 1`. The top `gear` shape should provide all the visible body. If this leaves visible transparency in the silhouette, fall back to Option B.
- **Option B:** Keep `Layer 1` visible, but add a clipped Hue/Saturation adjustment above it (Layer → Create Clipping Mask):
  - Hue: −35, Saturation: +20, Lightness: −15
  - This warm-shifts the baked-in chrome toward brass so any bleed-through reads as warm metal, not cool chrome.

#### Step 2 — Bevel & Emboss (the largest chrome contributor)

Open `gear` Layer Style → Bevel & Emboss. Currently:
- Style: Emboss | Technique: Smooth | Depth: **750%** | Size: 1px
- Highlight Mode: **Pin Light, WHITE, 50%**
- Shadow Mode: Normal, BLACK, 50%

Change to:
- **Style: Emboss** (keep — Inner Bevel would alter the silhouette)
- **Depth: 150-250%** (750% creates the harsh chrome shine; brass wants softer dimension)
- **Size: 3-5px** (gentler edge)
- **Highlight Mode: Screen** (not Pin Light) | Color: `#E8B95E` (brass-light) | Opacity: 60%
- **Shadow Mode: Multiply** | Color: `#5F5028` (brass-oxidized) | Opacity: 60%
- Texture sub-panel: leave the noise pattern at 26% / +3 for now — adds subtle brass grain

#### Step 3 — Satin (currently a chrome contributor; flip it to brass shimmer)

Open Satin sub-panel. Currently:
- Blend Mode: **Overlay** | Color: **BLACK** | Opacity: 50%
- Distance: 1px | Size: 1px | Anti-aliased + Invert: ✓

Change to:
- **Blend Mode: Soft Light** (gentler than Overlay)
- **Color: `#E8B95E`** (brass-light) — black→brass-light is the key flip from "chrome shadow ridges" to "brass surface shimmer"
- **Opacity: 15-25%**
- Distance/Size: keep at 1px/1px
- Invert: try both — brass typically reads better with Invert OFF; toggle to taste

#### Step 4 — Gradient Overlay (blend mode is the issue, not just stops)

Open Gradient Overlay sub-panel. Currently:
- **Blend Mode: Hue** ← B&W gradient + Hue blend = no color contribution
- Style: Radial | Angle: 0° | Scale: 150% | Align with Layer: ✓
- Gradient: black-to-white grayscale ramp

Change to:
- **Blend Mode: Normal** (or Multiply if you want the brass to interact with layers below — try Normal first)
- **Style: Radial** (keep — matches the gear's circular form; Linear at 90° would fight the symmetry)
- Replace stops with brass:
  - 0% (center, brightest): `#E8B95E` (brass-light)
  - 50% (mid): `#C49539` (brass)
  - 100% (outer rim, recessed): `#8E6A21` (brass-dark)
- Scale: 150% is fine; tune to control highlight-vs-shadow balance
- Angle: 0° (irrelevant for radial)

#### Step 5 — Stroke

Open Stroke sub-panel.
- **Color:** `#8E6A21` (brass-dark)
- Size: 1-2px (existing should be close)

#### Step 6 — Outer Glow (the cyan electrical accent)

Open Outer Glow sub-panel.
- **Color:** `#66E8FF` (electric-cyan-glow)
- **Blend Mode:** Screen
- **Opacity:** 25-40% (subtle but present — replaces the role the heavy blue backlight halo played in the original)
- **Size:** 15-25px
- Spread: 0-5%

#### Step 7 — Reconcile the TWO backlighting layers

The PSD has both `backlighting` (hidden, original) and `backlighting copy` (visible, active). Apply changes to the visible one; leave the hidden one as a backup.

Two viable approaches for `backlighting copy`:

- **Option A (lighter touch):** Add a clipped Hue/Saturation adjustment above it:
  - Hue: +5 to +10 (push from indigo-blue toward true cyan)
  - Saturation: −15 (atmospheric, not Y2K-loud)
  - Lightness: 0
- **Option B (full replace):** Hide `backlighting copy`, create a new layer in its slot, fill with `electric-cyan-glow` (`#66E8FF`) at 30-50% opacity, apply heavy Gaussian Blur (40-80px), set blend mode to Screen.

**Don't kill the glow entirely.** The era-blending direction wants electrical cyan under brass — just less neon, more atmospheric.

#### Step 8 — Verify against the ORIGINAL

Toggle the `ORIGINAL — do not edit` group on/off to A/B compare. The refined version should:

- Read **warm brass**, not cool chrome, in the gear body
- Have a **subtle** cyan halo (not the dominant blue cloud of the original)
- Preserve all geometric detail (teeth, inner cuts, center hole)
- Show **no chrome bleed-through** at tooth gaps or inner edges

If chrome still bleeds through → revisit Step 1 (Layer 1).
If brass reads orange-gold rather than brass → drop the brass-light gradient stop from `#E8B95E` to `#D4AC4A`.
If finish reads too matte/dead → bump Bevel & Emboss highlight opacity from 60% to 70%.
If the cyan halo overpowers the brass → drop Outer Glow opacity to 15-20%, and/or use Step 7 Option A (subtle hue shift) instead of Option B (full replace).

### What "done" looks like

The gear reads as a **brass mechanical gear with a subtle cyan electrical glow underneath**, in the same composition as the original. Not chrome with blue accents.

---

## nozzle.psd

> **Amendment locked 2026-05-06 (evening); steam-puff timing clarified 2026-05-07.** Direction: **brass primary + copper accents + verdigris streaks (Layer Comps for two-version output)**. Two PNG exports for `<picture>` art direction at the site level — simple version (no verdigris) for small screens, detailed version (with verdigris) for larger screens.
>
> **Steam-puff motion (handled at the build/animation layer, NOT in the PSD):** **puff duration 2-6 seconds** (animation length per cycle), **every 15-20 seconds** (interval between puffs). Episodic, not continuous. Distinguishes animation length from interval-between-animations per the visual-direction.md motion calibration revised 2026-05-07.
>
> **PSD construction:**
> 1. **Refine to brass + copper accents** per the existing nozzle.psd refinement steps below, with these calibrations:
>    - Add copper accents on the **`top` funnel rim** (catch-light copper at the lit edge)
>    - Shift the **`base` Stroke** from `brass-dark` (`#8E6A21`) to **`copper-dark`** (`#6B3A1A`) — bridges brass body to copper detail
>    - Optionally bump highlight opacity slightly for the punched-up steampunk register
> 2. **Add a `Verdigris Streaks` layer** clipped to whichever layer carries the panel-equivalent material (likely `Layer 1`). Same setup as fullLogo Step 8: Darken blend mode at 60% opacity, paint with `#5DA89C` (verdigris-light) leading, organic mask edges, concentrated at recesses and edges.
> 3. **Save two Layer Comps:** "Simple" (verdigris hidden) and "Detailed" (verdigris visible). `Window → Layer Comps`, follow the same workflow as fullLogo Variant A/B.
> 4. **Export both versions** at native resolution to `src/assets/images/nozzle-simple.png` and `nozzle-detailed.png`.
>
> Verdigris intensity stays per the locked fullLogo Step 8 spec — no aggressive punching-up needed; the dual-version output is the calibration. Steam-puff motion is a separate concern handled when the asset is wired into the site.

### Layer construction (as observed in the working PSD)

```
REFINEMENT — working
  cutter      (hidden — utility/scratch layer)
  top         (visible, NO layer effects — top funnel of the nozzle)
  base        (visible, fx: Stroke)
    Effects:
      Stroke    [Color: BLACK | Position: Inside | Opacity: 32% | Size: 1px]
  Layer 1     (visible, fx: Satin + Gradient Overlay)
    Effects:
      Satin            [Color: BLACK 50% Overlay]
      Gradient Overlay [B&W ramp | Blend: Pin Light | Style: Radial | Scale: 150% | Opacity: 85%]
ORIGINAL — do not edit  (hidden, locked)
Background  (hidden, white)
```

(The `Layer 4` mentioned in earlier docs isn't present in the current REFINEMENT working group — disregard.)

**The nozzle's chrome look has THREE sources** — fewer than the gear, but two of them mirror the gear's pattern:

- (a) **Pin Light gradient overlay** on `Layer 1` at 85% with a B&W ramp — like the gear's Hue-blend issue, the blend mode means stops won't carry brass tone reliably until you change it
- (b) **BLACK Overlay satin** on `Layer 1` — same chrome shadow-ridge contributor as the gear
- (c) **Possibly baked chrome in `top` and `base`** — `top` has no effects and `base` only has a thin stroke, so any chrome those layers display is rasterized into their pixels. Confirm via the diagnostic in Step 4.

### Refinement steps (work bottom-up: Layer 1 first)

In the `REFINEMENT — working` group:

#### Step 1 — `Layer 1` Gradient Overlay (primary chrome contributor)

Open `Layer 1` Layer Style → Gradient Overlay. Currently:
- **Blend Mode: Pin Light** | **Opacity: 85%**
- Style: Radial | Angle: 90° | Scale: 150% | Align with Layer: ✓
- Gradient: black-to-white grayscale ramp

Change to:
- **Blend Mode: Normal** (or Multiply if you want brass to interact with what's beneath — try Normal first)
- **Opacity: 100%** (with a color-carrying blend mode, full opacity is fine; tune down if it dominates)
- **Style: Radial** (keep — matches the nozzle's curved form)
- Replace stops with brass:
  - 0% (center, brightest): `#E8B95E` (brass-light)
  - 50% (mid): `#C49539` (brass)
  - 100% (outer, recessed): `#8E6A21` (brass-dark)
- Scale: 150% is fine; tune to taste
- Angle: 90° is fine (not strictly meaningful for radial)

#### Step 2 — `Layer 1` Satin (flip from chrome ridge to brass shimmer)

Open Satin sub-panel. Currently:
- Blend Mode: **Overlay** | Color: **BLACK** | Opacity: 50%
- Angle: 90° | Distance: 1px | Size: 1px | Anti-aliased + Invert: ✓

Change to:
- **Blend Mode: Soft Light** (gentler than Overlay)
- **Color: `#E8B95E`** (brass-light) — black→brass-light is the key flip
- **Opacity: 15-25%**
- Distance/Size: keep at 1px/1px
- Invert: try both — brass typically reads better with Invert OFF; toggle to taste

#### Step 3 — `base` Stroke

Open `base` Layer Style → Stroke. Currently:
- Color: **BLACK** | Position: Inside | Blend Mode: Normal | Opacity: 32% | Size: 1px

Change to:
- **Color: `#8E6A21`** (brass-dark)
- Keep everything else: Position Inside, Blend Normal, Opacity 32%, Size 1px

#### Step 4 — Diagnose and (if needed) treat baked chrome in `top` and `base`

After Steps 1-3, look at the nozzle. If `top` and `base` regions read as **brass** matching `Layer 1`, skip to Step 5. If they still read as **chrome**, those layers have chrome baked into their pixels and need their own treatment.

**Diagnostic:** temporarily hide `Layer 1`. Whatever you see in the `top` and `base` regions is what those layers contribute on their own. If they show chrome, Step 4 applies; if they're shape-only or transparent, you can skip.

If chrome remains in top/base, pick an approach:

- **Approach A (preferred — adjustment layers, fast):**
  1. Group `top` and `base` into a sub-group called `top-base`.
  2. Add a Hue/Saturation adjustment layer above the sub-group, clipped to it (Layer → Create Clipping Mask):
     - Hue: −35, Saturation: +20, Lightness: −10
  3. If still cool, add a clipped Color Balance:
     - Midtones: yellow +15, red +5
     - Shadows: blue −10

- **Approach B (more control — direct layer effects):**
  1. Apply Bevel & Emboss + Gradient Overlay to `top` mirroring the gear's brass treatment:
     - Bevel & Emboss: Style Emboss, Highlight Screen `#E8B95E` 60%, Shadow Multiply `#5F5028` 60%, Depth ~150%, Size 3-5px
     - Gradient Overlay: Normal blend, Radial, brass stops (`#E8B95E` → `#C49539` → `#8E6A21`)
  2. Apply the same to `base` (alongside the brass stroke from Step 3).

Approach A is usually sufficient — the nozzle is a passive supporting element, not the focal point. Approach B gives more dimensional brass but is more work for a piece that doesn't carry the design.

#### Step 5 — Optional Outer Glow on `Layer 1`

If you want a subtle electrical-cyan halo matching the gear's energy:
- Add Outer Glow on `Layer 1`: Color `#66E8FF` (electric-cyan-glow) | Blend Mode Screen | Opacity 15-25% | Size 10-20px | Spread 0-5%

Skip if it competes with the gear visually — the gear is the energy carrier; the nozzle is supporting.

#### Step 6 — Verify against the ORIGINAL

Toggle the `ORIGINAL — do not edit` group on/off to A/B compare. The refined version should:
- Read **warm brass**, not cool chrome, across the entire nozzle (top + base + Layer 1)
- Maintain the dimensional curves of the original (Satin shimmer + radial brass gradient)
- Show **no chrome remaining** in `top` or `base` regions — if it does, revisit Step 4

If brass reads orange-gold rather than brass → drop the brass-light gradient stop from `#E8B95E` to `#D4AC4A`.
If the nozzle reads flat/uniform → bump Bevel & Emboss highlight opacity (Approach B) or add Curves contrast (Approach A) on top/base.

### What "done" looks like

The nozzle reads as a **brass steam nozzle, dimensional, slightly burnished**, with a uniform brass tone across `top`, `base`, and `Layer 1`, and no blue accent.

---

## mobileLogo.psd (the diamond `SR` mark)

> **Locked 2026-05-07.** Direction: **copper diamond + brass SR letterforms + cyan laser through channel walls + amplified Outer Glow on SR, masked to the SR segment.** No verdigris (at favicon/mobile-header scale, verdigris detail muddies; the mobileLogo's job is to read clean and immediate). The hyped-up steampunk calibrations (punched-up colors, ambient motion, decrepit textures) do not apply at this scale.

The PSD now mirrors `fullLogo.psd`'s diamond construction — the diamond + channel walls + brushed copper + supporting layers were duplicated from fullLogo on 2026-05-07, rotated ~180° (Y-channel pointing right rather than left), and the leftmost diamond point trimmed slightly for proportional balance at the smaller scale. This keeps cross-asset cohesion automatic — same material values, same channel geometry, same cyan laser treatment.

The original rasterized SR-on-diamond construction (Layer 0 / Layer 0 copy / Layer 1 / SR rasterized pattern documented in earlier guide versions) was deleted from the PSD on 2026-05-07. Sean has external date-stamped backups for nostalgia / reference. The PSD is fully committed to the new construction.

### Layer construction (current state 2026-05-07)

```
SR                                   (text layer — Bevel & Emboss, Gradient Overlay,
                                       *amplified* Outer Glow + layer mask constraining
                                       the effect to the SR segment)
Diamond group (lifted from fullLogo, rotated):
  Laser                              (Effects: Bevel & Emboss, Inner Glow, Outer Glow)
  Channel Walls                      (Effects: Bevel & Emboss)
  Brushed Copper's Emboss Shadows    (extracted)
  Brushed Copper's Emboss Highlights (extracted)
  Verdigris Streaks (Diamond)        (HIDDEN — not used at this scale)
  Brushed Copper's Gradient Fill     (extracted)
  Brushed Copper                     (Smart Object derived from Diamond + brushed texture)
  Diamond                            (base shape with copper amendment applied)
```

### The contrast trick (the key insight from 2026-05-07 iteration)

Brass SR on copper diamond has weak natural contrast — both warm metals at similar value. Don't try to fix with substrate swaps (dark plates, polished segments, cyan-tinted backgrounds, brass partitions). Those break the unified material vocabulary on a small mark and read as overcompensated.

Instead, **amplify the SR's existing Outer Glow** to a much larger Size and **mask the effect to the SR segment only**. The result: SR appears self-illuminated, with a warm halo rimming it, contained naturally within the segment shape. Single effect, single mask, no new layers. The contrast comes from *focal illumination* (SR is the brightest, warmest spot) rather than substrate value contrast.

### Refinement steps

#### Phase 1 — confirm the diamond construction lifted cleanly

The diamond should already be in copper (matching fullLogo's lock) since it was duplicated from there. Verify:
- `Diamond` layer's Bevel/Gradient effects use copper stops (`#DA8A4A` / `#B5651D` / `#6B3A1A`)
- `Brushed Copper` Smart Object retains its texture and copper coloring
- Channel walls' cyan glow renders correctly through

If anything's off, refer back to fullLogo Phase 3 Step 6 (Diamond + Brushed Copper layers) for the locked values.

#### Phase 2 — set up the SR text layer

1. **Typeface:** Mostra Nuova, Heavy weight (matches fullLogo wordmark family)
2. **Size:** scaled to fit comfortably within the SR segment (the segment bounded by two channel walls + diamond perimeter)
3. **Fill color:** `#C49539` (brass) — gets layered with effects below
4. **Position:** centered within the SR segment — not too close to channel-wall edges

#### Phase 3 — apply layer styles to SR

Right-click SR → Blending Options:

- **Bevel & Emboss:**
  - Style: Inner Bevel, Technique: Chisel Hard
  - Depth: 150-200%
  - Size: 5-10 px
  - Highlight: Screen, `#E8B95E` (brass-light), opacity 60%
  - Shadow: Multiply, `#5F5028` (brass-oxidized), opacity 50%
- **Gradient Overlay:**
  - Stops: `#E8B95E` (0%) → `#C49539` (50%) → `#8E6A21` (100%)
  - Linear, 90°, Normal blend, 100% opacity
- **Outer Glow (the amplified contrast effect — the key dial):**
  - Color: warm tone — try `#DA8A4A` (copper-light) or `#E8B95E` (brass-light) and pick what reads best against the specific copper substrate
  - Blend Mode: Screen
  - Opacity: 60-80%
  - **Size: cranked up significantly — try 60-100 px depending on SR point size.** This is the slider that creates the "self-illuminated" look. Default Outer Glow sizes (10-25 px) won't produce this effect.
  - Spread: 0-5%
  - Technique: Softer
- **Inner Shadow, Drop Shadow:** **DISABLED.** These were tried during iteration to compensate for weak contrast against unmasked copper; not needed once the masked Outer Glow approach is in place.

#### Phase 4 — mask the Outer Glow to the SR segment

The Outer Glow at 60-100 px will spread well beyond the segment boundaries by default. The mask is what makes this approach work — it constrains the glow to the segment shape so it reads as "lit chamber" rather than "blurry SR everywhere."

1. Select the **Polygonal Lasso tool** (`L`, then `Shift+L` to cycle if needed). Anti-alias on, feather 0.
2. Trace the SR segment shape — the triangular slice bounded by two channel walls + a section of the diamond perimeter. Click points along: the inside edge of channel wall 1 → diamond perimeter → inside edge of channel wall 2 → close at the channel-wall intersection.
3. With the selection active and the **SR layer** selected: click the **Add Layer Mask** button at the bottom of the Layers panel
4. The mask now constrains the SR layer (and its Outer Glow effect) to the SR segment shape only. The Outer Glow that previously bled outside the segment is now contained.

If the mask boundary looks too crisp where it cuts off the glow at the channel-wall edges:
- Click the mask thumbnail → Properties panel → **Feather** slider → **1-3 px**

This softens the cutoff without changing the segment shape.

### What "done" looks like

The mobileLogo reads as **a copper diamond divided by cyan-laser channel walls, with brass SR letterforms in one segment glowing as if self-lit by warm energy contained within that chamber**. Strong focal contrast at all scales — SR is the brightest, warmest spot, eye lands there immediately. Material vocabulary stays unified (only copper + brass + electrical-cyan; no foreign substrates introduced). The "machine is alive" calibration expressed at the asset level.

### Paths explored and rejected during 2026-05-07 iteration

Documented here so the dead-ends don't get re-walked:

- **Recessed-bevel underplate.** A separate Underplate layer with Inner Bevel (Direction: Down) tried to create a sunken plate beneath the SR. Stacked 5+ effects on Underplate plus Inner Shadow + Drop Shadow on SR. Worked partially at large scale; lost detail at favicon scale. Over-engineered.
- **Dark bronze SR-segment substrate.** The segment was filled with the fullLogo's dark bronze (`#2A1810` → `#0F0908`). Strong contrast but read as a "dead patch" — broke the unified copper material vocabulary on a mark meant to be a single material at this scale.
- **Polished copper / brass partition / cyan-illuminated copper segment.** Three additional substrate-variant approaches. Each was a layer-and-effect rebuild within the "change the substrate to fix the contrast" frame. None landed before the focal-illumination approach replaced the entire frame.

The lesson: when iterations produce more layers but no resolution, step back and ask if the framework is right. The answer can be amplifying an existing effect rather than adding new structure. (See post idea `014-over-engineering-bias-mobile-logo.md` for the retrospective on this pattern.)

---

## fullLogo.psd (the wordmark + tagline + diamond)

### Layer construction (REFINEMENT — working group, current state 2026-05-06)

```
Software Designer + Developer  (editable text — Effects: Gradient Overlay, Drop Shadow)
SeanReardon.com                (editable text — Effects: Bevel & Emboss, Gradient Overlay, Outer Glow)
Laser Text Segment2            (Effects: Bevel & Emboss, Inner Glow, Outer Glow)
Laser                          (Effects: Bevel & Emboss, Inner Glow, Outer Glow)
Channel Walls                  (Effects: Bevel & Emboss — the Y-shape ridges inside the diamond)
Brushed Copper                 (Effects: Bevel & Emboss, Gradient Overlay — Smart Object derived from Diamond)
Diamond                        (Effects: Bevel & Emboss, Gradient Overlay)
Text Background                (Effects: Bevel & Emboss, Gradient Overlay)
ORIGINAL — do not edit         (locked group — preserves source state)
Background                     (hidden, white)
```

> **Layer cleanup note (2026-05-06):** the original PSD had additional layers that have since been removed during refinement: `Layer 3` (rasterized chrome — deleted per Phase 1), `Layer 1 copy`, `Diamond copy`, `Behind Laser`, `Text BG Border`, `Behind Text Background`, `Laser Text Segment Under Text`, `Behind Laser Text Segment`, and `Temporary`. Their effects either weren't load-bearing or have been consolidated into the remaining layers. The refinement steps below address the current 8-layer reality.

This is the most complex but also the most rewarding because it has editable text + named layers.

### Refinement steps

In the `REFINEMENT — working` group:

#### Phase 1 — clear out the rasterized lettering

1. **Delete `Layer 3`.** It's the rasterized chrome lettering that's currently obscuring the editable text. Once layer styles land on the editable text in Phase 2, this baked-in version is redundant.

#### Phase 2 — style the editable text layers

2. **Set typeface for `SeanReardon.com`:**
   - Open Character panel, select the layer
   - Font: **Mostra Nuova**, weight: 400 or 700 (try both, pick the impact level that fits)
   - Size: scale to match the previous wordmark's visual size
   - Fill color: `#C49539` (brass) — this gets layered with effects, so the base color matters less

3. **Set typeface for `Software designer + developer`:**
   - Font: **IBM Plex Sans**, weight: 600 (medium-bold for legibility under the wordmark)
   - Size: substantially smaller than the wordmark (10-15% of wordmark size, give or take)
   - Fill color: `#C49539` (brass) for consistency, or `#E8B95E` (brass-light) for slightly more presence
   - Tracking (letter spacing): consider +50 to +100 for that Deco/industrial feel under the heavy display
   - Position centered or left-aligned beneath the wordmark, matching the original layout

4. **Apply layer styles to `SeanReardon.com`:**
   - **Bevel & Emboss:**
     - Highlight: `#E8B95E` at 60%
     - Shadow: `#5F5028` at 50%
     - Style: Inner Bevel; Technique: Chisel Hard for crisp Deco letterforms
     - Size: 5-10px depending on letter weight
   - **Gradient Overlay:**
     - Stops: `#E8B95E` (0%) → `#C49539` (50%) → `#8E6A21` (100%)
     - Style: Linear
     - Angle: 90°
   - **Optional: Outer Glow** in `electric-cyan-glow` at 15% opacity, 20-30px size — subtle electrical halo

5. **Apply layer styles to `Software designer + developer`:**
   - Lighter touch than the wordmark — this is supporting text, not the headline
   - **Gradient Overlay** only: same brass stops as wordmark
   - Skip Bevel & Emboss (the small size doesn't need 3D dimension)
   - **Optional: Drop Shadow** at low opacity for slight separation from background

#### Phase 3 — refine the diamond + background plate

6. **Edit `Diamond` + `Brushed Copper` layers (amended 2026-05-06 — now copper, not brass).**

   The PSD now contains a `Brushed Copper` Smart Object layer above the original `Diamond` layer. Together they produce the brushed-copper diamond locked as the diamond's material identity. The original brass spec for `Diamond` is superseded — both layers now use copper.

   **`Diamond` Bevel & Emboss — current settings vs. change-to:**

   | Field | Currently | Change to |
   |---|---|---|
   | Style | Emboss | **Emboss** (keep — preserves silhouette) |
   | Technique | Smooth | **Smooth** (keep — right for the diamond's broad surface) |
   | Depth | **750%** | **150-250%** (start at 180; 750% is the chrome shine) |
   | Direction | Up | **Up** (keep) |
   | Size | 12 px | **12-15 px** (keep, or bump if bevel reads thin) |
   | Soften | 0 px | **0 px** (keep) |
   | Angle | 90° | **90°** (keep) |
   | Altitude | 30° | **30°** (keep) |
   | Use Global Light | ✓ | **✓** (keep) |
   | Gloss Contour | default linear | **default linear**, **tick Anti-aliased** for cleaner edges |
   | **Highlight Mode** | **Pin Light, color** | **Screen** (the chrome trap fix) |
   | Highlight color | — | **`#DA8A4A`** (copper-light); bump to `#FFC68F` if it collides with the gradient |
   | Highlight Opacity | 50% | **65%** |
   | **Shadow Mode** | **Normal, color** | **Multiply** (lets shadow tint with copper underneath) |
   | Shadow color | — | **`#4A2812`** (copper-oxidized) |
   | Shadow Opacity | 50% | **50%** (keep) |

   **Order of operations** (live-preview the changes):
   1. Drop **Depth** first (750 → 180) — calms the chrome shine immediately
   2. **Highlight Mode** dropdown: Pin Light → **Screen**
   3. **Highlight color**: set to `#DA8A4A`, opacity 65%
   4. **Shadow Mode** dropdown: Normal → **Multiply**
   5. **Shadow color**: set to `#4A2812`, opacity 50%
   6. Tick **Gloss Contour Anti-aliased**

   **`Diamond` Gradient Overlay:**
   - Stops: `#DA8A4A` (0%) → `#B5651D` (50%) → `#6B3A1A` (100%)
   - Style: Linear or Radial (Radial works well for the diamond's geometric form; try both)
   - Blend Mode: Normal
   - Angle: 90° (Linear) or irrelevant (Radial)

   **`Brushed Copper` Smart Object layer (added in current PSD; document for replicability):**
   - Smart Object derived from the `Diamond` layer's silhouette — preserves diamond geometry, carries the brushed-copper texture and color
   - Bevel & Emboss: same settings as `Diamond` above (copper highlight + copper-oxidized shadow), but tune **Depth 100-150%** (subtler — the underlying `Diamond` layer carries primary dimension)
   - Gradient Overlay: copper stops as above
   - Brushed surface: applied via Smart Filter (Filter Gallery → Sketch / Brush Strokes) OR via blended brushed-noise pattern at low opacity
   - **Brushing direction:** vertical OR diagonal — must match the `Text Background` panel's brushing direction (cross-element cohesion lever; same material logic across both halves)

   **Troubleshooting:**
   - Diamond reads orange-gold rather than copper → drop the highlight color from `#DA8A4A` to `#C97834` (warmer, less yellow)
   - Diamond reads too red/desaturated → bump the gradient mid stop from `#B5651D` to `#C46A22`
   - Bevel disappears against the gradient → highlight is colliding with the gradient's `#DA8A4A` stop; bump highlight to `#FFC68F`
   - Brushed texture overpowers the dimension → drop `Brushed Copper` layer opacity to 70-85%
   - Diamond competes with the wordmark for attention → drop highlight opacity from 65% to 55%
   - Diamond reads too matte/flat → bump highlight opacity from 65% to 75%

7. **Edit `Channel Walls` layer (the Y-shape ridges inside the diamond).**

   The `Channel Walls` layer carves the Y-shaped channels into the diamond face — the geometric divisions that the cyan laser sits in. Currently has Bevel & Emboss only. The walls represent cuts INTO the copper, so their bevel highlights and shadows should read as recessed-into-copper rather than as a separate material.

   **Bevel & Emboss:**

   | Field | Value |
   |---|---|
   | Style | **Inner Bevel** (channels are recessed; not surface relief) |
   | Technique | **Smooth** |
   | Depth | **150-250%** (matches diamond's bevel depth for visual continuity) |
   | Direction | **Down** (channels go *into* the copper, not protrude) |
   | Size | 5-10 px (tune to channel width) |
   | Soften | 0 px |
   | Angle | **90°** (matches global light) |
   | Altitude | **30°** |
   | Use Global Light | **✓** |
   | **Highlight Mode** | **Screen** |
   | Highlight color | **`#DA8A4A`** (copper-light — the lit edge of the channel walls) |
   | Highlight Opacity | 50% |
   | **Shadow Mode** | **Multiply** |
   | Shadow color | **`#4A2812`** (copper-oxidized — the deep recess of the channel) |
   | Shadow Opacity | 65% (deeper than the diamond face shadows; the channels are darker by definition) |

   **Why these values:** the channels are recessed cuts into the same copper material. Same color family as `Diamond`/`Brushed Copper`, but **higher shadow opacity** to make the recess read as cut-deep. The cyan laser sits *inside* these channels (Laser layer above) — the walls give it physical context to glow within.

   **Troubleshooting:**
   - Channels read as raised ridges instead of recessed cuts → switch Direction from Up to **Down**, OR swap Highlight and Shadow colors
   - Channels disappear against the diamond face → bump Shadow Opacity from 65% to 75%; the recess depth needs to read clearly
   - Channels feel disconnected from the diamond's material → confirm Highlight color is `#DA8A4A` (matching diamond), not a neutral gray

8. **Edit `Text Background` (amended 2026-05-06 — now verdigris bronze, not warm-dark substrate).**

   The panel material has shifted: **deep brown-black bronze base + teal-green verdigris streak layer**. Replaces the warm-dark `#1F1B17` → `#0F0E0C` substrate spec previously locked. The verdigris expresses the patina/reclamation atmospheric layer concretely on the logo's primary surface.

   The panel still does *not* compete with the wordmark — the brass wordmark remains the brightest, sharpest element. Verdigris adds material character, not chroma at the wordmark's expense.

   **Layer structure (panel becomes two layers):**
   1. `Text Background` — the bronze base (modified from the previous Text Background; this step)
   2. **`Verdigris Streaks`** — new layer above `Text Background`, masked to the panel silhouette (sub-step within this step)

   **`Text Background` (bronze base) — Bevel & Emboss:**

   | Field | Currently | Change to |
   |---|---|---|
   | Style | Emboss | **Emboss** (keep) |
   | Technique | Smooth | **Smooth** (keep) |
   | Depth | 750% (or 75% if previously corrected) | **75-100%** (substrate dimension; not hero) |
   | Direction | Up | **Up** (keep) |
   | Size | 8 px (or 3-5 if previously corrected) | **3-5 px** (gentle bevel) |
   | Soften | 0 px | **0 px** (keep) |
   | Angle | 90° | **90°** (keep — same lit-from-above direction as the diamond) |
   | Altitude | 30° | **30°** (keep) |
   | Use Global Light | ✓ | **✓** (keep) |
   | Gloss Contour | default linear | **default linear** |
   | **Highlight Mode** | varies | **Screen** |
   | Highlight color | varies | **`#A98762`** (warm bronze highlight — slightly warmer than the previous `#A89C88` substrate value) |
   | Highlight Opacity | varies | **35%** (subtle; brass wordmark stays brightest) |
   | **Shadow Mode** | varies | **Multiply** |
   | Shadow color | varies | **`#1F0E08`** (deep bronze shadow) |
   | Shadow Opacity | varies | **55%** |

   **`Text Background` Gradient Overlay (warm bronze, NOT brass):**

   | Field | Value |
   |---|---|
   | Blend Mode | **Normal** |
   | Opacity | **100%** |
   | Stops | **0%: `#2A1810`** (deep warm brown) → **100%: `#0F0908`** (near-black bronze) |
   | Style | **Linear** |
   | Angle | **90°** (light at top, deep at bottom — same lit-from-above as diamond) |
   | Scale | 100% |

   The warmer bronze hexes (not the previous neutral warm-dark) place the panel in the same color world as the copper diamond — bronze and copper share alloy DNA, so the eye reads them as one material family.

   **`Text Background` brushed surface — step by step:**

   The bronze gradient alone reads as flat. Adding subtle directional noise gives the surface life and lets it catch light like real metal. Two ways to do it; pick one.

   **Option 1 — Smart Filter on the layer (simpler, non-destructive):**
   1. Right-click `Text Background` in the Layers panel → **Convert to Smart Object** (lets the filters below stay editable later)
   2. Filter → Noise → **Add Noise** — Amount **2-5%**, Distribution **Gaussian**, **Monochromatic** ✓
   3. Filter → Blur → **Motion Blur** — Angle matching the `Brushed Copper` layer's brushing direction on the diamond (vertical = 90°, diagonal = 45°), Distance **8-12 px**
   4. Result: subtle directional noise that reads as brushed metal

   **Option 2 — Separate texture layer (more control, easier to dial):**
   1. Create a new layer above `Text Background` (Layers panel → New Layer button, or `Ctrl/Cmd+Shift+N`)
   2. With the new layer selected, right-click → **Create Clipping Mask** — this constrains the layer's visibility to the `Text Background` shape beneath it (anything outside the panel won't show)
   3. Edit → **Fill** → Contents **50% Gray** (or use foreground gray `#808080`)
   4. Filter → Noise → **Add Noise** — Amount **8-12%**, Gaussian, Monochromatic
   5. Filter → Blur → **Motion Blur** — same angle as the diamond's brushing, Distance **10-15 px**
   6. In the Layers panel top: blend mode → **Soft Light** or **Overlay**, opacity → **3-8%**

   The brushing direction must match the diamond's `Brushed Copper` layer — same material logic across both halves of the logo. If the diamond brushes vertically, the panel brushes vertically. This is a small detail that does disproportionate work for cohesion.

   **`Verdigris Streaks` layer — step by step:**

   This is a new layer above `Text Background` carrying the teal-green oxidation marks. Discrete steps:

   **a) Create the layer:**
   1. Select `Text Background` in the Layers panel
   2. Click the **New Layer** button at the bottom of the Layers panel (or `Ctrl/Cmd+Shift+N`)
   3. Name the new layer **`Verdigris Streaks`**
   4. Confirm it sits directly above `Text Background` in the stack (drag if needed)

   **b) Clip it to the panel shape** (this is what "masked to panel silhouette" means — the verdigris will only appear where `Text Background` has pixels, never outside the panel):
   1. With `Verdigris Streaks` selected, right-click the layer → **Create Clipping Mask** (or Layer menu → Create Clipping Mask, shortcut `Ctrl/Cmd+Alt+G`)
   2. The layer thumbnail now shows a small downward arrow ↓, indicating it's clipped to `Text Background` below
   3. Anything painted on `Verdigris Streaks` is now visible only inside the panel silhouette — the boundary is automatic, no manual mask needed

   **c) Set the layer's blend mode and opacity (locked 2026-05-06):**
   1. With `Verdigris Streaks` selected, at the top of the Layers panel:
      - **Blend mode** dropdown (default "Normal") → **Darken**
      - **Opacity** slider → **60%** (tune ±10% to taste)
   2. **Why Darken:** it takes the darker per-channel value between the verdigris layer and the bronze beneath. This mimics how real oxidation crystals appear on dark metal — visible on lit/raised areas (where bronze is brighter than green → green wins the comparison), invisible in deep recesses (where bronze is already darker than green → bronze wins). Mathematically right for the material; produces the splotchy, organic distribution that reads as accidental aging rather than painted decoration.
   3. **Why NOT Multiply or Color Burn on dark substrates** (this was the original recommendation; it was wrong):
      - **Multiply** math is `result = (top × bottom) / 255` per channel. When bronze's green channel is near zero, multiplied teal also goes near zero. You get dark patches with no visible green. Multiply works for verdigris on *light* substrates (polished brass, light bronze) but mathematically cannot produce visible green on dark bronze.
      - **Color Burn** is even more aggressive darkening; same problem, worse.
      - **Normal at moderate opacity** is a viable fallback if Darken's tonal contrast feels wrong for your specific PSD — but reads as paint-on-top rather than oxidation-formed-in. Less convincing as physical patina.
      - **Subtract** produces a striking deep-red effect (oxidation reads as rust rather than verdigris). Different aesthetic, not verdigris — captured as a separate variant; see Variant C below if you want to explore that direction.

   **d) Pick the verdigris colors** (use as foreground colors as you paint):

   **For dark substrates** (bronze panel, copper diamond — the default for this PSD):
   - Primary: **`#5DA89C`** (verdigris-light) — leads, because Darken needs the verdigris value lighter than the bronze for the green to win the per-channel comparison
   - Accent strokes: **`#3D8579`** (verdigris)
   - Deepest recesses (sparingly): **`#1F4D45`** (verdigris-deep) — only where verdigris would physically pool darker

   **For light substrates** (if you ever apply verdigris to a polished/light element later):
   - Primary: **`#3D8579`** (verdigris)
   - Lighter streak edges: **`#5DA89C`** (verdigris-light)
   - Deepest streak cores: **`#1F4D45`** (verdigris-deep)

   **e) Paint the streaks** with the Brush tool (`B`):
   - Brush type: a soft round brush, or a textured natural-media brush for more organic edges
   - Size: **30-100 px** (vary as you go — smaller for fine streaks, larger for broader oxidation patches)
   - Hardness: **low (10-30%)** — verdigris doesn't have hard edges
   - Opacity: **15-30%** — build up gradually rather than placing one strong stroke
   - Flow: **20-40%** — same logic, soft buildup

   **Where to paint** (densest → least dense):
   1. **Densest:** along the panel's edges (top, bottom, sides) — moisture pools at edges first
   2. **Dense:** in the corners and around the wordmark's bevel shadow (where light doesn't reach as easily)
   3. **Medium:** where the cyan laser strikes the panel surface — this is the **cohesion lever**: cool teal verdigris and cool cyan laser blend instead of fighting, unifying the lighting story across both halves of the logo
   4. **Light:** scattered across the panel face for organic variation
   5. **Sparse or none:** the center of the panel — keep this area clear so the brass wordmark sits on relatively clean bronze

   Vary brush size, opacity, and stroke direction as you paint. Verdigris doesn't occur in patterns — random-looking is correct. If your streaks start forming rows or geometric shapes, you're being too neat; loosen up.

   **f) Refine with a layer mask** (optional but recommended):

   If a streak comes out too strong or in the wrong place:
   1. With `Verdigris Streaks` selected, click the **Add Layer Mask** button at the bottom of the Layers panel (rectangle-with-circle icon)
   2. Click the mask thumbnail to make the mask active for editing (a small frame appears around it)
   3. Paint with **black** to hide, **white** to reveal — a soft black brush at low opacity gradually fades a streak; full-black hides it cleanly
   4. This sculpts the verdigris non-destructively without redoing the paint

   **g) Squint test:**

   Zoom out, squint at the logo. The brass wordmark `SeanReardon.com` must remain the brightest, sharpest element. If your eye lands on a verdigris streak first instead of the wordmark, the streak is too strong:
   - Drop layer opacity by 10-15%, OR
   - Paint black on the layer mask to fade the offending streak specifically

   **Variant A + Variant C combined — dual verdigris (locked 2026-05-07):**

   The 2026-05-07 build locked **both verdigris layers visible simultaneously**:
   - **`Verdigris Streaks (Diamond)`** — Darken blend mode at 60% opacity (the green patina layer; originally Variant A, locked 2026-05-06)
   - **`Verdigris Streaks (Diamond) — Subtract Mode`** — Subtract blend mode at 60% opacity (the red-rust layer; originally documented as Variant C alternate, now active alongside Variant A)

   Together they produce a copper artifact aged through multiple oxidation states simultaneously: green verdigris patina (carbonate oxidation, Darken layer) plus deep red-brown rust patches (sulfide/sulfate oxidation, Subtract layer). Reads as **a copper artifact discovered in the thick of the jungle** — heavily weathered, archaeological, full temple-ruins aesthetic. This is the locked production direction.

   Real ancient bronze artifacts show both oxidation tones (Statue of Liberty closeups, Roman coins, weathered church bells) — so the dual-state expression reads as authentically aged rather than designed.

   The `ORIGINAL — do not edit` group inside the PSD was deleted on 2026-05-07; Sean has external date-stamped backups for nostalgia/reference. The PSD is fully committed to the dual-verdigris state.

   **Documented for reference (no longer active alternates):**

   - **Variant B (diamond stays clean copper, panel-only verdigris):** initially proposed as the lower-risk default. Superseded by Variant A then Variant A+C.
   - **Variant A alone (Darken-only):** locked 2026-05-06, expanded to A+C combined on 2026-05-07.

   Photoshop's **Layer Comps** feature (`Window → Layer Comps`) saves layer-visibility states inside one PSD if you ever want to compare against the rejected variants. Currently no Layer Comp toggling needed — both verdigris layers stay visible in production.

   **Variant B — diamond stays clean copper (rejected; documented for reference):**
   - `Verdigris Streaks` visible, clipped only to `Text Background`
   - Diamond stays clean copper
   - Reads as two parts deliberately joined by the laser channel — was the conservative default before A locked

   **Variant A — diamond gets Darken-mode verdigris (rolled into A+C combined):**
   1. Duplicate the `Verdigris Streaks` layer (`Ctrl/Cmd+J`)
   2. Rename the duplicate `Verdigris Streaks (Diamond)`
   3. Move it directly above `Brushed Copper` in the layer stack
   4. Right-click → **Create Clipping Mask** to clip it to `Brushed Copper` (so it only shows on the diamond)
   5. Click the **Add Layer Mask** button, then `Ctrl/Cmd+I` to invert it to fully black (everything hidden)
   6. With **white** at low opacity (~15-20%), paint very subtle streaks only in the recesses where the channel walls meet the brushed copper face and around the diamond's outer bevel edges — keep these much subtler than the panel streaks
   7. Reads as one continuous bronze artifact aged together — higher cohesion, but risks muddying the copper warmth

   **Save both as Layer Comps to toggle between them:**
   1. `Window → Layer Comps` to open the panel
   2. With `Verdigris Streaks (Diamond)` set to hidden (Variant B state), click **Create New Layer Comp** → name it "Variant B" → check "Visibility" only → OK
   3. Toggle `Verdigris Streaks (Diamond)` visible (Variant A state), click **Create New Layer Comp** again → name "Variant A" → OK
   4. Click between the two comp rows to flip the diamond's verdigris on and off — the rest of the logo stays the same

   **Decision criterion:** pick the variant that looks more *intentional*, not necessarily the more cohesive one. Cohesion can read as boring; intentional asymmetry can read as confident. (For 2026-05-06 build: cohesion won — Variant A locked.)

   **Variant C — Subtract blend mode (alternate aesthetic, not locked):**

   Discovered during 2026-05-06 blend-mode experiments. Same `Verdigris Streaks (Diamond)` layer construction, but blend mode → **Subtract** at ~60% opacity. Mathematically subtracting teal from bronze pulls out the green and blue channels, leaving a deep red-brown that reads as **rust on iron** or **blood on weathered bronze** rather than copper oxidation. Coherent ancient-cursed-artifact aesthetic — Indiana Jones meets the temple where something went wrong. Documented as a Layer Comp ("Variant C — Rust") rather than active because it's a substantial pivot from the patina direction. Candidate for the 404 page or as a hidden state somewhere if a "rusted" version of the logo would land.

   **Troubleshooting:**

   - **Verdigris doesn't show even though paint is on the layer and clipping is correct** → the base layer's Gradient Overlay (or other layer styles) is rendering on top of the clipped verdigris. By default Photoshop's **"Blend Clipped Layers as Group"** setting is ON, which causes base-layer effects to render *over* clipped layers.
     - **Fix path A (try first):** double-click `Text Background` → Blending Options → Advanced Blending → uncheck **"Blend Clipped Layers as Group"**.
     - **Fix path B (bulletproof if A doesn't work):** right-click `Text Background`'s **Effects** sublayer → **Create Layers** (extracts each effect to its own layer; Photoshop forces all-or-nothing here). Then group [`Text Background` + extracted Gradient Overlay layer + `Verdigris Streaks`], and re-apply Bevel & Emboss as a *group* layer style (right-click the group → Blending Options). The group's bevel computes on the combined alpha and renders correctly above all the clipped layers. This is what the 2026-05-06 build used.
   - **Verdigris reads as dark patches with no green color** → blend mode is Multiply or Color Burn, which can only darken. On a dark substrate, multiplied teal goes near-zero in the green channel and produces dark patches with no visible color. Switch to **Darken** (the locked default per 2026-05-06).
   - **Verdigris is barely visible** → the verdigris paint colors aren't lighter than the bronze beneath. Darken needs the verdigris pixels to be lighter than the bronze at the per-channel level for the green to win. Lead painting with **`#5DA89C`** (verdigris-light), not `#3D8579`.
   - Panel reads as flat chrome again → bump bronze brushed-noise opacity from 3% to 6-8%; the surface needs visible texture to catch light.
   - Verdigris streaks compete with wordmark for attention → drop `Verdigris Streaks` layer opacity to 50% or below; thin the streak mask in the center of the panel.
   - Verdigris reads as a deliberate decorative pattern → re-mask with rougher/more organic edges; verdigris doesn't occur in clean shapes.
   - Verdigris reads cool-blue rather than teal-green → confirm primary color is `#5DA89C` or `#3D8579`, not `#3D8FAA` or similar (which slides toward cyan).
   - Panel and diamond don't feel like one material family → confirm both have brushed surfaces matching direction; bump bronze gradient warmth toward the diamond's warmth (drop bronze gradient mid value from `#1F100A` to `#241510`).
   - Plate edges look too crisp/digital → drop Bevel Size to 2px.

#### Phase 4 — refine the laser/electrical layers

9. **Edit `Laser Text Segment2`.**

    The existing layer often has unconventional blend modes — Inner Glow on **Difference**, Outer Glow on **Subtract** — which produce inconsistent laser color across different surfaces (cross brass vs. plate vs. transparency = different visible color). Plus the colors are stale Y2K saturated blue, not electric cyan. Both need fixing.

    **Inner Glow — current settings vs. change-to:**

    | Field | Currently | Change to |
    |---|---|---|
    | **Blend Mode** | **Difference** | **Screen** (deterministic, brightens cleanly) |
    | Opacity | 35% | **60%** |
    | Noise | 0% | **0%** (keep) |
    | Color radio | Color (solid) | **Color** (keep — gradient adds complexity you don't need) |
    | Color | dark/blue | **`#00DDFF`** (electric-cyan) |
    | Method | Smooth | **Smooth** (keep) |
    | Technique | Precise | **Precise** (keep — right for crisp laser-line edges) |
    | Source | Edge | **Edge** (keep — defines the laser core) |
    | Choke | 18% | **10-18%** (keep at 18 for tight, lower for soft) |
    | Size | 7 px | **5-10 px** (keep) |
    | Contour | default linear | **default linear** (keep) |
    | Anti-aliased | unchecked | **check** for cleaner glow edge |
    | Range | 50% | **50%** (keep) |
    | Jitter | 0% | **0%** (keep) |

    **Outer Glow — current settings vs. change-to:**

    | Field | Currently | Change to |
    |---|---|---|
    | **Blend Mode** | **Subtract** | **Screen** |
    | Opacity | 35% | **40%** |
    | Noise | 0% | **0%** (keep) |
    | Color radio | Color | **Color** (keep) |
    | Color | Y2K blue | **`#66E8FF`** (electric-cyan-glow) |
    | Method | Smooth | **Smooth** (keep) |
    | Technique | Precise | **Softer** (more diffuse atmospheric halo) |
    | **Spread** | **40%** | **0-10%** (high spread = harsh outline; low = soft bloom) |
    | **Size** | **10 px** | **25-35 px** (atmospheric halo, not tight outline) |
    | Contour | default linear | **default linear** (keep) |
    | Anti-aliased | unchecked | **check** for cleaner halo |
    | Range | 50% | **50%** (keep) |
    | Jitter | 0% | **0%** (keep) |

    **The spread + size relationship (the most important conceptual fix):** glow halos should feel like atmospheric light — large + soft + low-opacity. The chrome-era construction had small + tight + high-opacity, which reads as hard Y2K neon outline. Target large size with low spread so 95% of the halo is soft fade, not solid color.

    **Order of operations** (open both Inner and Outer Glow panels at once for cumulative preview):
    1. Inner Glow Blend Mode: Difference → **Screen**
    2. Inner Glow Color: → `#00DDFF`
    3. Inner Glow Opacity: 35 → **60**
    4. Inner Glow Anti-aliased: tick
    5. Outer Glow Blend Mode: Subtract → **Screen**
    6. Outer Glow Color: → `#66E8FF`
    7. Outer Glow Size: 10 → **30** (drag slider, watch halo bloom)
    8. Outer Glow Spread: 40 → **5** (halo immediately softens)
    9. Outer Glow Technique: Precise → **Softer** (if halo still feels harsh)
    10. Outer Glow Opacity: 35 → **40**
    11. Outer Glow Anti-aliased: tick

    **Troubleshooting:**
    - Cyan overpowers the brass → drop Outer Glow opacity to 25-30%
    - Halo feels pixelated → confirm Anti-aliased is checked on both glows
    - Laser color shifts across different surfaces → confirm Blend Mode is Screen on both (Difference/Subtract are the only blend modes that cause this)
    - Laser reads more blue than cyan → confirm Inner Glow color is `#00DDFF` not `#0099FF` or `#0066FF`

10. **Edit `Laser` layer.** Currently has **Bevel & Emboss + Inner Glow + Outer Glow** (three effects).

    - **Inner Glow + Outer Glow:** apply the same specifications as `Laser Text Segment2` above — the laser layers should match each other for a unified glow story across the whole composition. Same colors (`#00DDFF` inner, `#66E8FF` outer), same blend mode (Screen), same spread/size relationship.
    - **Bevel & Emboss (light touch — adds subtle dimension to the laser line, doesn't dominate):**
      - Style: **Inner Bevel**
      - Depth: **50-100%**
      - Size: **2-4 px**
      - Highlight Mode: **Screen**, color **`#66E8FF`** (electric-cyan-glow), opacity **30%**
      - Shadow Mode: **Multiply**, color **`#0085C6`** (electric-cyan-deep), opacity **40%**

    The bevel keeps the laser line dimensional rather than flat — important where the laser sits in the diamond's `Channel Walls` grooves and should catch light like a real lit element rather than a stuck-on graphic.

#### Phase 5 — polish

11. **Step back and review the whole composition.** Compare with the ORIGINAL group's visibility toggle — does the new version maintain the same "weight" and balance as the old? Adjust gradient angles, glow intensity, bevel depth as needed.

12. **The Deco-cream surface decision** — for v1 the wordmark sits on the dark page background. If we ever want the wordmark on a light surface (e.g., printed materials, light-mode toggle), the brass + bronze-plate construction still works on cream because the plate provides its own dark substrate. No change needed for v1.

### What "done" looks like

The full wordmark reads as **brass `SeanReardon.com` with brass `Software designer + developer` tagline beneath, sitting on a heavily weathered bronze panel showing both teal-green verdigris patina AND deep red-brown rust patches (multi-stage oxidation), with electric-cyan laser accents flanking, alongside a brushed-copper diamond similarly weathered with both oxidation tones**. The Y2K-tech chrome+blue is fully replaced by era-blending **brass-and-copper-on-aged-bronze** with electrical-cyan accents — the patinated/reclaimed atmospheric layer fully landed: a copper artifact discovered in the thick of the jungle, energy still running through it. *(Amended 2026-05-06; verdigris dual-state — Variant A + Variant C — locked 2026-05-07.)*

---

## Order of operations

Suggested order across the four PSDs:

1. **`nozzle.psd` first.** Smallest scope, fewest layers, shortest distance from chrome to brass. Good warm-up.
2. **`gear.psd` second.** Five effects to swap, but well-organized. Establishes the brass + electrical-glow vocabulary you'll reuse.
3. **`fullLogo.psd` third.** Most rewarding — editable text + named layers + amplifying the existing Laser layers.
4. **`mobileLogo.psd` last.** Trickiest because of the rasterization. Saving for last means you've already established the brass tone and electrical-cyan choices in the other three; you'll know exactly what color values you're aiming for.

Each PSD probably takes 30-90 minutes once you're warmed up. The full set: a focused half-day, plus iteration time as you compare against each other.

---

## When refinement is done

For each PSD:

1. Save the date-stamped version (whatever today's date is)
2. **Don't export PNGs yet.** Hold for a final review pass — having all four refined PSDs side-by-side will reveal any tonal inconsistencies that need correcting.
3. After review pass: **Export PNGs at native resolution** to `src/assets/images/` (overwriting `gear.png`, `nozzle.png`, `mobileLogo.png`, `SR_logo.png`).
4. **Commit both the new PSDs and the updated PNGs together** (per the existing `design/README.md` convention).

---

## If something gets stuck

Common stuck points:

- **"The brass color looks wrong" / "It looks orange not brass"** — likely the Gradient Overlay's stops are too saturated. Try `#D4AC4A` for the mid stop instead of `#C49539` and see if it reads more like brass than gold-orange.
- **"The bevel highlight is too shiny / chrome-looking"** — Bevel & Emboss highlight opacity is too high. Drop it to 50% or lower.
- **"The cyan glow is fighting the brass for attention"** — outer glow opacity is too high. Try 15-20% instead of 30-40%.
- **"The diamond mark just looks tinted, not refinished"** — Hue/Saturation alone is insufficient; add a Gradient Map adjustment with brass stops to fully replace the chrome ramp.

---

## Cross-reference

- **Visual direction plan:** `~/.claude/plans/visual-direction.md` (amended 2026-05-06 — copper + verdigris added to brand palette)
- **Anti-references (what to avoid):** `~/.claude/plans/visual-anti-references.md`
- **Locked palette tokens:** `src/styles/global.css` (top of file, `:root` block)
- **Workflow conventions:** `design/README.md`
- **Verdigris/copper amendment context (2026-05-06):**
  - Plan: `C:\Users\seanr\.claude\plans\okay-i-m-starting-a-mossy-narwhal.md`
  - Post idea: `post-ideas/012-verdigris-bronze-logo-decision.md` (in `portfolio-redesign-agent/`)
  - Feedback memory: `memory/feedback-design-distinctive-over-safe.md` (in `portfolio-redesign-agent/`)
  - Process log entry: `process-log/redesign-conversation-log.md` 2026-05-06 entry (in `portfolio-redesign-agent/`)
