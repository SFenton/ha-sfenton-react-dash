# Modal layout inventory

`e2e/responsive-modal-inventory.spec.ts` is the executable source of truth. It
currently reconciles 31 physical `ModalSheet` callsites, two sheet-style
`OptionPickerDialog` consumers, 35 primary review surfaces, and 54 distinct
landscape intents. Every listed surface has shared outer geometry for portrait,
568x320, 667x375, 734x343, mirrored 852x393, tablet, and desktop.

This document tracks **content adaptation**, not outer-frame coverage.

## Dedicated adaptations

These families declare modal-specific landscape/tier structure or have
state-specific executable layout contracts:

- Quick Links, Rooms, and Security detail flows
- camera/media split views and media remotes
- DoneTick create/edit task forms
- inventory filter, details, and sorting flows
- recipe detail, filter, sorting, and ingredient detail flows
- Humidifier, Wake Light, Vacuum, Weather, and Light More Info
- Home/Security tile grids and Guest Presence Security
- Admin presence overrides, Eight Sleep, and advanced Thermostat

## Shared-generic layouts

These are intentionally simple enough to use the shared single-column modal
layout today. They remain inventory-tested in all required profiles:

- Add Grocery Item
- Add Admin To-Do item
- Edit Admin To-Do item
- Bathroom Fan
- Bed Temperature Scope
- generic compact room-source dialogs
- Vacation confirmation
- Sprinkler controller

Bathroom Fan remains shared-generic: `e2e/bathroom-fans.spec.ts` verifies its
off-state timer selector and disabled Set action in portrait, all three short
landscape sizes, mirrored and zero-inset phone landscape, and a real fine-pointer
desktop context. It also reaches the powered-on auto-disable choice and active
timer Clear action through the shared modal body scroll without a second layout.

## Dedicated-content gaps

These surfaces have stateful content that still relies too heavily on the
shared generic stack. The next change to one of them must add explicit
portrait, landscape, and short-landscape content obligations:

| Surface | Missing dedicated coverage |
|---|---|
| Scan/Add Item | Barcode camera, manual-name keyboard state, expiration camera/manual state, review form, processing, and success are not all walked by the complete modal inventory. |
| Daily Summary | Its three tabs are exercised, but column behavior is distributed across child lists rather than declared as one modal content-layout contract. |
| Sprinkler Controller | Detail/back states are shared-sheet pages without a named short-landscape content adaptation. |
| Bed Temperature Scope | Uses a custom portrait height but has no named short-landscape content arrangement. |
| Vacation Confirmation | Date/error/confirmation structure has no named short-landscape arrangement. |

The simple create/edit sheets above are not gaps while they remain one-field
forms with a reachable fixed footer. Adding fields, steps, or dynamic sections
moves them into the dedicated-content-gap category.
