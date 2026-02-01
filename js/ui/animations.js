// Animations Module
// Anime.js wrappers for game animations
//
// Key design: animations that target elements about to be destroyed by re-render
// must clone the element into a fixed overlay so the animation survives DOM replacement.

const getAnime = () => window.anime;

// Create/get a fixed overlay container for animation clones
function getOverlay() {
  let overlay = document.getElementById('animation-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'animation-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5000;overflow:hidden;';
    document.body.appendChild(overlay);
  }
  return overlay;
}

// Clone an element into the overlay at its current screen position
function cloneToOverlay(el) {
  const rect = el.getBoundingClientRect();
  const clone = el.cloneNode(true);
  clone.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    margin: 0;
    pointer-events: none;
    z-index: 5001;
  `;
  // Remove any selected state styles that might interfere
  clone.classList.remove('selected');
  getOverlay().appendChild(clone);
  return clone;
}

export const Animations = {
  // Card lifts, rotates slightly, fades up and out (400ms)
  // Returns immediately - caller doesn't need to wait
  playCard(cardElement) {
    const anime = getAnime();
    if (!anime || !cardElement) return;

    const clone = cloneToOverlay(cardElement);
    // Hide original immediately so user sees the clone animating
    cardElement.style.opacity = '0';

    anime({
      targets: clone,
      translateY: -80,
      rotate: '8deg',
      opacity: [1, 0],
      scale: [1, 0.7],
      duration: 450,
      easing: 'easeOutQuad',
      complete: () => clone.remove()
    });
  },

  // Card flies toward discard area, shrinks and fades (500ms)
  buyCard(cardElement) {
    const anime = getAnime();
    if (!anime || !cardElement) return;

    const clone = cloneToOverlay(cardElement);
    cardElement.style.opacity = '0';

    anime({
      targets: clone,
      translateX: -250,
      translateY: -120,
      scale: [1, 0.2],
      opacity: [1, 0],
      duration: 500,
      easing: 'easeInQuad',
      complete: () => clone.remove()
    });
  },

  // Target player card pulses red (600ms)
  // This targets a persistent element (player sidebar), so no clone needed
  attackFlash(playerElement) {
    const anime = getAnime();
    if (!anime || !playerElement) return;

    // Save original box-shadow to restore
    const original = getComputedStyle(playerElement).boxShadow;

    anime.timeline()
      .add({
        targets: playerElement,
        boxShadow: '0 0 50px rgba(239, 68, 68, 0.9)',
        duration: 200,
        easing: 'easeInQuad'
      })
      .add({
        targets: playerElement,
        boxShadow: '0 0 50px rgba(239, 68, 68, 0.9)',
        duration: 200,
      })
      .add({
        targets: playerElement,
        boxShadow: original || '0 0 15px rgba(239, 68, 68, 0.3)',
        duration: 200,
        easing: 'easeOutQuad'
      });
  },

  // Objective scales up then disappears (600ms)
  scoreObjective(objectiveElement) {
    const anime = getAnime();
    if (!anime || !objectiveElement) return;

    const clone = cloneToOverlay(objectiveElement);

    anime({
      targets: clone,
      scale: [1, 1.2, 0],
      opacity: [1, 1, 0],
      translateY: [0, -10, -80],
      duration: 600,
      easing: 'easeInBack',
      complete: () => clone.remove()
    });
  },

  // Number scales up with elastic bounce (500ms)
  // Targets a stat element that persists (targeted update doesn't replace it)
  statPulse(element) {
    const anime = getAnime();
    if (!anime || !element) return;

    // Ensure element has display inline-block for transform to work
    element.style.display = 'inline-block';
    element.style.transformOrigin = 'center';

    anime({
      targets: element,
      scale: [1, 1.5, 1],
      duration: 500,
      easing: 'easeOutElastic(1, .5)',
      complete: () => {
        element.style.transform = '';
      }
    });
  },

  // Resource number glows gold (600ms)
  resourceGlow(element) {
    const anime = getAnime();
    if (!anime || !element) return;

    element.style.display = 'inline-block';

    anime({
      targets: element,
      scale: [1, 1.4, 1],
      duration: 600,
      easing: 'easeOutElastic(1, .5)',
      complete: () => {
        element.style.transform = '';
      }
    });
  },

  // "YOUR TURN" banner with elastic scale-in, hold, fade-out
  newTurn() {
    const anime = getAnime();
    if (!anime) return;

    const banner = document.getElementById('turn-banner');
    const text = banner?.querySelector('.turn-banner-text');
    if (!banner || !text) return;

    banner.style.display = 'flex';
    // Reset state
    text.style.opacity = '0';
    text.style.transform = 'scale(0.5)';

    anime.timeline({
      complete: () => {
        banner.style.display = 'none';
        text.style.opacity = '0';
        text.style.transform = 'scale(0.5)';
      }
    })
    .add({
      targets: text,
      scale: [0.5, 1],
      opacity: [0, 1],
      duration: 600,
      easing: 'easeOutElastic(1, .6)'
    })
    .add({
      targets: text,
      opacity: 1,
      duration: 1000
    })
    .add({
      targets: text,
      opacity: [1, 0],
      scale: [1, 1.15],
      duration: 400,
      easing: 'easeInQuad'
    });
  },

  // Feed item enhanced slide-in (300ms)
  feedItemSlideIn(element) {
    const anime = getAnime();
    if (!anime || !element) return;

    anime({
      targets: element,
      translateX: [40, 0],
      opacity: [0, 1],
      duration: 300,
      easing: 'easeOutQuad'
    });
  }
};
