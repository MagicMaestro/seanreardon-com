/* ============================================================================
   SteamTransition — multi-stage steam animation for the AI search nozzle
   ============================================================================
   Phase 3 §2 of decisions/ai-features-v1.md + decisions/002 §4. Rewritten
   2026-05-22 iter 8 per Sean's detailed visual direction:

     - Stage 1 (0-250ms): Nozzle recesses (handled in Nozzle.astro, not here)
     - Stage 2 (250ms-2250ms, 2s): 2-3 small puffs emerge from the nozzle's
       tip and drift toward viewport center
     - Stage 3 (2250ms-5250ms, 3s): the dominant puff arrives at center and
       grows to cover the main content area. The growing fog has a smokey
       texture (multi-layer gradients + SVG feTurbulence/feDisplacementMap
       creating rolling fog with random highlights and shadows)
     - Stage 4 (5250ms-6250ms, 1s): the feature (SearchModal in task #4)
       fades in. Modal hasn't been built yet — placeholder for now

   Total click-to-modal-visible: ~6.25s. Long for a UI transition but Sean
   wants this art-piece quality for the AI feature's reveal — it's the
   site's most distinctive interactive moment.

   CSS variables set inline from JS at activation time:
     --nozzle-tip-x: viewport-x where the puffs originate
     --nozzle-tip-y: viewport-y where the puffs originate
     --drift-x: distance (in px) the puffs need to drift to reach viewport
       horizontal center (= 50vw - tipX)
     --drift-y: distance to viewport vertical center (= 50vh - tipY)

   The puff animations interpolate from (tipX, tipY) → (tipX + driftX, tipY
   + driftY) = viewport center. CSS keyframes use calc(-50% + var(--drift-x))
   in the transform so the puff converges on viewport center regardless of
   the nozzle's actual position.

   Stage 3's rolling-fog texture uses an inline SVG filter (id="steam-fog-
   filter") with feTurbulence + feDisplacementMap. The turbulence's
   baseFrequency is animated via SMIL <animate> so the noise pattern shifts
   over time, creating the "rolling" feel. The multi-layer radial-gradient
   background under the filter provides the highlight/shadow variation; the
   turbulence warps these into organic, asymmetric shapes. */

import { useEffect, useRef, useState } from 'react';
import './SteamTransition.css';

export default function SteamTransition() {
  const [isActive, setIsActive] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nozzle = document.querySelector<HTMLElement>('.site-nozzle');
    if (!nozzle) return;

    const observer = new MutationObserver(() => {
      const nextState = nozzle.dataset.state === 'active';
      if (nextState) {
        /* Read the nozzle's current tip position. tipX = right edge minus
           a small inset for the actual bronze cluster (the rotated PNG
           has transparent padding); tipY = vertical center of the nozzle
           box. Then compute the drift vector (tip → viewport center) so
           the puff animations know how far to travel. */
        const rect = nozzle.getBoundingClientRect();
        const tipX = rect.right - 4;
        const tipY = rect.top + rect.height / 2;
        const driftX = window.innerWidth / 2 - tipX;
        const driftY = window.innerHeight / 2 - tipY;
        if (overlayRef.current) {
          overlayRef.current.style.setProperty('--nozzle-tip-x', `${tipX}px`);
          overlayRef.current.style.setProperty('--nozzle-tip-y', `${tipY}px`);
          overlayRef.current.style.setProperty('--drift-x', `${driftX}px`);
          overlayRef.current.style.setProperty('--drift-y', `${driftY}px`);
        }
      }
      setIsActive(nextState);
    });

    observer.observe(nozzle, { attributes: true, attributeFilter: ['data-state'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={overlayRef}
      className={`steam-transition${isActive ? ' is-active' : ''}`}
      aria-hidden="true"
    >
      {/* SVG filter definitions — hidden via CSS (width/height 0). The
          feTurbulence + feDisplacementMap chain warps the steam-fog element's
          gradients into organic, rolling fog shapes. The SMIL <animate> on
          baseFrequency shifts the noise pattern over time, creating the
          "rolling" feel — the fog's highlights and shadows reorganize
          continuously while the fog is visible. */}
      <svg className="steam-svg-defs" aria-hidden="true">
        <defs>
          <filter id="steam-fog-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.008 0.012"
              numOctaves="2"
              seed="7"
              result="noise"
            >
              {/* Palindrome values (A→B→A) ensure the loop forward and
                  rewind play at IDENTICAL speed. Duration extended from 8s
                  to 12s per Sean iter 10: the edge clipping still moved
                  too fast even after the iter-9 slowdown. At 12s = 6s
                  forward + 6s rewind, the rolling texture changes feel
                  like a slow continuous drift rather than active churning.
                  calcMode="spline" + keySplines applies ease-in-out cubic-
                  bezier to each segment so the turning points (peak B and
                  return to A) feel smooth, not abrupt. */}
              <animate
                attributeName="baseFrequency"
                values="0.008 0.012;0.013 0.016;0.008 0.012"
                dur="12s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.42 0 0.58 1; 0.42 0 0.58 1"
              />
            </feTurbulence>
            {/* Displacement scale reduced from 80 to 53 (≈ 2/3) per Sean
                iter 9: the edge-clipping patterns were too pronounced.
                The fog still has clear rolling texture but the warping is
                more restrained, reads as drifting rather than churning. */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="53"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Stage 2: drift puffs. Three small radial-gradient circles that
          spawn at the nozzle's tip and travel to viewport center over 2s.
          Slightly staggered start times (250 / 350 / 450ms delay) so they
          emerge sequentially, like discrete puffs from the nozzle. */}
      <div className="steam-puff steam-puff--1" />
      <div className="steam-puff steam-puff--2" />
      <div className="steam-puff steam-puff--3" />

      {/* Stage 3: main rolling fog. Starts as a small ~40px puff at
          viewport center (where the drift puffs converge), grows over 3s
          to fill the viewport. The SVG turbulence filter warps the
          multi-layer gradient into rolling fog texture. */}
      <div className="steam-fog" />
    </div>
  );
}
