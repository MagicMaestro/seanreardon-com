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

## Locked palette quick-reference

These are the hex values you'll be using throughout. Keep this open in a side window while working.

### Brass primary (warm metal foundation)

```
brass-light:    #E8B95E   (highlight side, gradient lights, shine)
brass:          #C49539   (default surface — main brass tone)
brass-dark:     #8E6A21   (recessed/shadow, gradient depths)
brass-oxidized: #5F5028   (aged, atmospheric edges, oxidized states)
```

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

1. **Chrome silver → brass** in all gradient overlays. Replace gradient stops:
   - Old chrome stops typically: light silver (`#F0F0F0`) → mid silver (`#A0A0A0`) → dark silver (`#404040`)
   - New brass stops: `brass-light` (`#E8B95E`) → `brass` (`#C49539`) → `brass-dark` (`#8E6A21`)

2. **Blue accents → electrical cyan or brass-edge.** The original blue accents had two roles:
   - Decorative outline (replace with `brass-dark` for brass-edged surfaces)
   - Laser/signal energy (replace with `electric-cyan` and `electric-cyan-glow`)
   - Decide per-layer which role the original blue was playing.

3. **Glossy reflective → matte/dimensional brass.** If a layer has heavy gloss highlights from Bevel & Emboss, dial them back. Brass reflects diffusely; chrome reflects sharply. Adjust `Highlight Mode` opacity in Bevel & Emboss to ~50-65% (vs. typical 75-85% for chrome).

4. **Add subtle electrical glow** to surfaces that should feel "alive." Outer Glow with `electric-cyan-glow` at low opacity (15-25%) on key brass surfaces gives the era-blending energy without being heavy-handed.

5. **Drop shadows stay roughly the same** — pure black at 30-50% opacity for dimensional separation. They're not era-specific.

---

## gear.psd

### Layer construction

```
gear            (top, vector-or-raster shape with 5 effects)
  Effects:
    Bevel & Emboss
    Stroke
    Satin
    Gradient Overlay
    Outer Glow
backlighting    (blue glow underneath the gear)
Layer 2         (hidden, black backdrop)
Layer 1         (gear shape underneath)
Background      (hidden, white)
```

### Refinement steps

In the `REFINEMENT — working` group:

1. **Edit the `gear` layer's Gradient Overlay:**
   - Open Layer Style → Gradient Overlay
   - Click the gradient swatch to open the editor
   - Replace stops:
     - Position 0% (highlight): `#E8B95E`
     - Position 50% (mid): `#C49539`
     - Position 100% (shadow): `#8E6A21`
   - Style: Linear (or Reflected if you want a cylindrical brass shine)
   - Angle: 90° default; tweak to taste

2. **Edit Bevel & Emboss:**
   - Highlight Mode color → `#E8B95E` (brass-light)
   - Highlight opacity → 60% (down from default 75% for matte brass feel)
   - Shadow Mode color → `#5F5028` (brass-oxidized)
   - Shadow opacity → 50% (default is fine)
   - Style: Inner Bevel; Technique: Smooth or Chisel Hard depending on the look you want
   - Depth: ~100-150 (existing values may be fine)
   - Size: ~5-10px (existing may be fine; tune to taste)

3. **Edit Stroke:**
   - Color → `#8E6A21` (brass-dark)
   - Size: 1-2px (existing should be close)

4. **Edit Satin:**
   - Color → `#E8B95E` (brass-light) at low opacity (10-20%)
   - This adds the brass surface shimmer

5. **Edit Outer Glow:**
   - Color → `#66E8FF` (electric-cyan-glow)
   - Opacity → 20-30% (subtle)
   - Size → 15-25px (subtle halo, not dominant)

6. **Edit `backlighting` layer:**
   - This is the blue glow underneath. Either:
     - **Option A:** Hue/Saturation adjustment layer clipped to it, shift hue toward cyan (~+10°) or toward warm brass (~−40°). For the era-blending direction, **shift to electric-cyan** so the gear has a subtle cyan glow underneath, fitting the "electrical signal running through brass" thesis.
     - **Option B:** Replace it entirely — fill with `electric-cyan-glow` (`#66E8FF`) at low opacity with heavy Gaussian Blur

7. **`Layer 1` (the gear shape underneath):**
   - If it's chrome-tinted in the rasterization, apply Hue/Saturation adjustment layer (clipped):
     - Hue: shift toward warm (-30 to -45)
     - Saturation: +20-30 (brass is warmer-saturated than chrome)
     - Lightness: -10 (slightly darker mid-tone)

### What "done" looks like

The gear should read as a **brass mechanical gear with a subtle cyan electrical glow underneath**, sitting in the same composition as before. Not chrome with blue accents.

---

## nozzle.psd

### Layer construction

```
cutter      (hidden)
Layer 4     (hidden)
top         (visible, no effects in panel)
base        (Effects: Stroke)
Layer 1     (Effects: Satin, Gradient Overlay)
Background  (hidden, white)
```

### Refinement steps

In the `REFINEMENT — working` group:

1. **Edit `Layer 1`'s Gradient Overlay:**
   - Replace stops with brass gradient (same as gear):
     - 0%: `#E8B95E`
     - 50%: `#C49539`
     - 100%: `#8E6A21`

2. **Edit `Layer 1`'s Satin:**
   - Color → `#E8B95E` (brass-light) at 15% opacity

3. **Edit `base` Stroke:**
   - Color → `#8E6A21` (brass-dark)
   - Size: 1-2px

4. **`top` layer has no visible effects** — apply the same Bevel & Emboss + Gradient Overlay pattern from the gear if you want the top to also have brass dimension. Or leave it as a flat brass color (`#C49539` fill) if the geometry already provides depth.

5. **Optional: add Outer Glow to `Layer 1` or `top`** with `electric-cyan-glow` at low opacity if you want the nozzle to glow subtly. Probably less important than the gear's glow — nozzles are functional/passive elements.

### What "done" looks like

The nozzle reads as a **brass steam nozzle**, dimensional, slightly burnished, no blue accent.

---

## mobileLogo.psd (the diamond `SR` mark)

### Layer construction

```
SR             (top, the SR letters — rasterized)
Layer 1        (middle layer, hexagonal interior — rasterized)
Layer 0 copy   (base diamond shape — rasterized)
Layer 0        (hidden, source duplicate)
```

This is the **trickiest of the four** because everything is mostly rasterized with finish baked in. There are no editable layer effects to swap chrome→brass on.

### Refinement steps

In the `REFINEMENT — working` group, two viable approaches:

**Approach A — Hue/Saturation shift (fast, less control):**

1. Group `Layer 0 copy`, `Layer 1`, `SR` into a sub-group called `mark`
2. Add an adjustment layer above the group, clipped to it (Layer → Create Clipping Mask):
   - **Hue/Saturation:**
     - Hue: -30 to -45 (shift cyan/blue toward warm brass)
     - Saturation: +15 to +25
     - Lightness: -5 to -10
3. Add a second clipped adjustment layer:
   - **Color Balance** or **Selective Color** to fine-tune the brass tone:
     - Push midtones toward yellow + slight red
     - Pull blue out of shadows
4. Add a clipped **Color Lookup** adjustment if you want a quick brass-toned LUT, or a **Gradient Map** with brass-light → brass → brass-dark stops

**Approach B — Convert to smart object + multiple adjustments (slower, more control):**

1. Select `Layer 0 copy`, `Layer 1`, `SR`
2. Right-click → Convert to Smart Object
3. Apply Hue/Saturation, Curves, Color Balance as layer styles or smart filters on the smart object
4. The advantage: you can double-click the smart object to edit the original layers, and adjustments are non-destructive

**Either way:** the `SR` letters specifically need contrast against the diamond background. After the brass shift, check the SR letterforms read clearly. If they blur into the diamond, add a subtle inner shadow or stroke to them in `brass-dark`.

5. **Optional cyan accents:** the original diamond had blue laser/highlight lines through the hexagonal sub-divisions. If you want to recreate those:
   - Add a new layer above the diamond
   - Paint thin lines in `electric-cyan` (`#00DDFF`) along the hexagonal seams
   - Apply Outer Glow with `electric-cyan-glow` to the line layer
   - Adjust opacity to taste (40-70%)

### What "done" looks like

The SR diamond mark reads as **brass with hexagonal sub-divisions and electric-cyan laser-line accents through the sub-division seams**. Geometry preserved, finish completely re-skinned.

---

## fullLogo.psd (the wordmark + tagline + diamond)

### Layer construction (REFINEMENT — working group)

```
Layer 3                       (top — rasterized chrome lettering, DELETE during refinement)
Software designer + developer (editable text — your new tagline)
SeanReardon.com               (editable text)
Laser Text Segment2           (Effects: Inner Glow, Outer Glow)
Laser
Layer 1 copy
Diamond copy
Behind Laser
Diamond                       (Effects: Bevel & Emboss, Gradient Overlay)
Text BG Border
Text Background               (Effects: Bevel & Emboss, Gradient Overlay)
Behind Text Background
Laser Text Segment Under Text (Effects: Inner Glow, Outer Glow)
Behind Laser Text Segment
Temporary                     (Effects: Outer Glow)
```

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

6. **Edit `Diamond` layer effects:**
   - **Bevel & Emboss:** highlight `#E8B95E` at 65%, shadow `#5F5028` at 50%
   - **Gradient Overlay:** brass stops (`#E8B95E` → `#C49539` → `#8E6A21`)

7. **Edit `Diamond copy`:** if visible, mirror the changes from `Diamond`

8. **Edit `Text Background` (the dark plate behind the wordmark):**
   - **Bevel & Emboss:** highlight `#A89C88` at 30% (subtle warm gray); shadow black at 50%
   - **Gradient Overlay:** instead of brass, this should be a subtle dark gradient — `#1F1B17` (warm-dark) → `#0F0E0C` (deep). The plate is the SUBSTRATE the brass sits ON. Keep it dark and recessed.

9. **Edit `Text BG Border`:** thin brass-dark border around the plate

#### Phase 4 — refine the laser/electrical layers

10. **Edit `Laser Text Segment2`:**
    - **Inner Glow:** `#00DDFF` (electric-cyan) at 60% opacity
    - **Outer Glow:** `#66E8FF` (electric-cyan-glow) at 40% opacity, 20-40px size

11. **Edit `Laser` layer:** if it's a colored line, recolor to `#00DDFF`. If it's a shape with effects, apply Inner Glow + Outer Glow as above.

12. **Edit `Behind Laser` and `Behind Laser Text Segment`:** these are likely the deeper-glow halo layers under the laser elements. Recolor any blue tones to `#0085C6` (electric-cyan-deep) for the under-glow.

13. **Edit `Laser Text Segment Under Text`:**
    - Same as Laser Text Segment2 — Inner Glow `#00DDFF`, Outer Glow `#66E8FF`

14. **Edit `Temporary` layer:** check what this is doing. If it's an outer-edge glow, recolor to `electric-cyan-glow`. If it's a stray layer no longer needed, hide or delete.

#### Phase 5 — polish

15. **Step back and review the whole composition.** Compare with the ORIGINAL group's visibility toggle — does the new version maintain the same "weight" and balance as the old? Adjust gradient angles, glow intensity, bevel depth as needed.

16. **The Deco-cream surface decision** — for v1 the wordmark sits on the dark page background. If we ever want the wordmark on a light surface (e.g., printed materials, light-mode toggle), the brass + dark-plate construction still works on cream because the plate provides its own dark substrate. No change needed for v1.

### What "done" looks like

The full wordmark reads as **brass `SeanReardon.com` with brass `Software designer + developer` tagline beneath, sitting on a dark recessed plate, with electric-cyan laser accents flanking, alongside a brass diamond with cyan-laser hexagonal sub-divisions**. The Y2K-tech chrome+blue is fully replaced by era-blending brass+electrical.

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

- **Visual direction plan:** `~/.claude/plans/visual-direction.md`
- **Anti-references (what to avoid):** `~/.claude/plans/visual-anti-references.md`
- **Locked palette tokens:** `src/styles/global.css` (top of file, `:root` block)
- **Workflow conventions:** `design/README.md`
