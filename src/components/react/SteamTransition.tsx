/* ============================================================================
   SteamTransition — React island for the AI-search nozzle's steam animation
   ============================================================================
   Phase 3 §2 of decisions/ai-features-v1.md. Visible when the user clicks
   the nozzle: warm-tinted steam cloud emerges from the nozzle's tip, grows
   to fill the viewport, then dissipates. The future SearchModal (task #4)
   will materialize through the dissipating cloud — modal opacity ramps up
   during the steam's fade-out.

   This file is the React island. Always mounted (client:load in BaseLayout)
   so it can react instantly when the user clicks the nozzle, even before
   browser idle. Listens for nozzle.dataset.state changes via MutationObserver
   — when state goes to 'active', the steam triggers via a CSS class toggle.
   The CSS animation in SteamTransition.css has a 250ms delay so the steam
   only starts AFTER the nozzle's slide-to-mid-viewport completes.

   Why React island vs Astro inline script: per the architecture in
   decisions/ai-features-v1.md, the SearchModal (task #4) will live as a
   React island in this same `src/components/react/` directory. Keeping
   SteamTransition in React lets the two coordinate naturally — eventually
   the modal will render this component as a child and pass shared state
   for the activation timing.

   For now, this component is standalone — it reads the nozzle's DOM state
   directly. When SearchModal lands (task #4), this component will be
   rendered FROM SearchModal and the DOM-state listening will move to the
   parent. */

import { useEffect, useRef, useState } from 'react';
import './SteamTransition.css';

export default function SteamTransition() {
  const [isActive, setIsActive] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nozzle = document.querySelector<HTMLElement>('.site-nozzle');
    if (!nozzle) return;

    /* Watch the nozzle's data-state attribute. When it changes to 'active',
       fire the steam animation. When it goes back to 'resting', clear the
       active class so the next activation re-triggers the CSS animation
       (without this clear, re-clicking the nozzle wouldn't restart the
       animation because the class would already be present). */
    const observer = new MutationObserver(() => {
      const nextState = nozzle.dataset.state === 'active';
      if (nextState) {
        /* Read the nozzle's CURRENT tip position so the radial-gradient
           cloud (in SteamTransition.css) can be CENTERED at the tip — the
           bright core stays anchored to the nozzle throughout the radius
           expansion. Y is read from the nozzle's bounding rect; X is
           fixed at viewport horizontal center (50%) since the nozzle
           slides to mid-viewport before this fires. */
        const rect = nozzle.getBoundingClientRect();
        const tipY = rect.top + rect.height / 2;
        if (overlayRef.current) {
          overlayRef.current.style.setProperty('--nozzle-tip-y', `${tipY}px`);
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
    />
  );
}
