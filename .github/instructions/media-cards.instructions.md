---
description: "Use when editing fixed-image cards, media card grids, or horizontal card carousels."
applyTo: "src/components/core/*Card*.tsx,src/components/core/*Card*.module.css,src/components/hass/**/*Card*.tsx,src/components/hass/**/*Card*.module.css"
---
# Fixed Image Cards And Carousels

- Keep image boxes dimensionally stable with an explicit aspect ratio; loading, missing images, and live image updates must not move surrounding content.
- Use `object-fit: cover`, decorative `alt=""` when adjacent text names the item, and a stable non-image fallback.
- Clamp overlong overlay titles to two lines and preserve readability with a bottom scrim and restrained text shadow.
- Eager-load only initially visible media. Offscreen images use lazy loading and asynchronous decoding.
- Generic display cards are noninteractive unless a real destination or action exists. Do not add no-op click handlers, buttons, links, tab stops, pointer cursors, press feedback, or selected styling.
- Horizontal card carousels use the shared clipped transform track, not a native
  overflow scrollbar; Safari can expose transient scroll indicators even when
  scrollbar CSS is present.
- Carousel page controls need accessible current-page state, keyboard navigation,
  boundary-wrapping touch swipes, compact visual spacing, and reduced-motion-safe
  transforms. Do not add autoplay or a carousel dependency.
- Preload mode renders inert geometry without `<img>` elements, effects, timers, observers, or service calls.
