---
description: "Use when editing React UX code, dashboard pages, reusable components, or CSS modules. Covers shared description text and UX primitive conventions."
applyTo: "src/pages/**/*.tsx,src/components/**/*.tsx,src/pages/**/*.module.css,src/components/**/*.module.css"
---
# React UX Instructions

- Use the shared `<Description />` control from `src/components/core/Description.tsx` for descriptive UX copy in React components and page files.
- Do not add page-local paragraph wrappers or ad hoc description CSS when `<Description />` can represent the copy.
- Keep descriptive text close to the source configuration or page constants when it is source-derived, but render it through `<Description />`.
- For ported Home Assistant room pages, page body/source section cards should use the same standard `<GlassTile />` treatment as the Home page Quick Links by default. Reserve compact cards for header/status rails, dense modal internals, and explicit row-style controls where the source YAML is also compact.
- Do not add visual press/click feedback to dashboard cards, glass tiles, modal cards, dropdown options, toggles, or entity controls. Avoid `:active` scale transforms, press animations, transient background flashes, opacity changes, or similar interaction-only visual effects. Persistent state indicators such as selected, checked, active, on/off, disabled, unavailable, or HA state-derived colors are still expected.
- Do not rely on browser-default blue focus outlines for inputs, textareas, selects, or custom picker shells. Use an app-native neutral/glass focus treatment such as subtle white border/outline or component-specific non-blue focus styling.
