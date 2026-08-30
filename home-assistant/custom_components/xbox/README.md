# Temporary Xbox dependency shim

This custom integration intentionally shadows Home Assistant Core's built-in
`xbox` integration while continuing to execute the built-in 2026.8 integration
code. It pins `python-xbox==0.2.1`, matching
[home-assistant/core#180295](https://github.com/home-assistant/core/pull/180295)
and fixing
[home-assistant/core#179798](https://github.com/home-assistant/core/issues/179798).
It also locally permits a successful SmartGlass command response whose
`destination` is `null`, which Xbox Network currently returns for this console.
That response shape is not covered by python-xbox 0.2.1's narrower fix for
missing fields inside a non-null destination object.

Remove this entire `custom_components/xbox` directory once the installed stable
Home Assistant release includes PR #180295 (or otherwise requires
`python-xbox>=0.2.1`). Keeping the shim after that point could hide later
built-in Xbox manifest or loader changes.

The Python files are deliberately thin wrappers. Internal implementation
continues to come from `homeassistant.components.xbox`; the local manifest,
translations, and icons preserve the directly loaded custom-integration
surface.

When this workaround is intentionally released, copy this directory to
`/config/custom_components/xbox` and restart Home Assistant. This repository
change does not perform either operation.
