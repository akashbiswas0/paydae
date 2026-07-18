# Brand — Paydae

Paydae is confidential contractor payroll on Canton for companies, contractors, and auditors.

## Direction

**Palette:** Ledger Plum

**Mood:** premium, minimal, warm

**Reference:** Deel-inspired product confidence and clarity, interpreted as Paydae rather than copied.

The interface pairs a warm parchment canvas with strong ink typography and a saturated plum primary. Lime is a sparing trust and completion signal. Mint and sky identify contractor and auditor contexts without fragmenting the master brand.

## Core colors

| Token | OKLCH | Purpose |
| --- | --- | --- |
| Background | `oklch(0.978 0.009 91)` | Warm application canvas |
| Foreground | `oklch(0.19 0.025 305)` | Primary ink and dark surfaces |
| Primary | `oklch(0.49 0.22 305)` | Main actions and brand emphasis |
| Primary soft | `oklch(0.925 0.05 305)` | Selected and contextual surfaces |
| Brand lime | `oklch(0.88 0.2 116)` | Trust, readiness, completion |
| Brand mint | `oklch(0.91 0.08 165)` | Contractor role accent |
| Brand sky | `oklch(0.91 0.06 230)` | Auditor role accent |

The complete light and dark shadcn token sets live in `frontend/src/app/globals.css`.

## Typography

Geist is used for interface and display text, with Geist Mono reserved for party IDs, hashes, and technical values. Display headings use tight tracking and strong line breaks; body copy remains neutral and compact.

## Logo

The Paydae mark is a rounded-square plum tile containing a continuous, double-line `P` inspired by payment rails and ledger movement. It is paired with the lowercase `paydae` wordmark in Geist. The mark is intentionally flat and contains no corner dot, gradient, or interior micro-detail so it remains clear at 28–36 px navbar sizes.

## Gradients

- `--gradient-bg`: subtle plum and lime radial atmosphere for marketing surfaces.
- `--gradient-accent`: restrained plum-to-magenta action gradient.

## Voice

Paydae sounds clear and assured. It explains what happens next, uses concrete verbs, and avoids blockchain jargon when a familiar payroll term will do.

Trust language should be specific: keys stay in the browser, access is read-only, or a transaction is signed. Avoid vague claims such as “military-grade” or “fully secure.”

The product should feel warm enough for people operations and rigorous enough for finance. Short headings can be expressive; form copy should be direct and practical.

## Usage

- Use plum for the single primary action in a region.
- Use lime for compact success and trust signals, never long body text.
- Keep large surfaces warm neutral or ink; role colors belong in small chips and icons.
- Prefer generous whitespace, 16–32 px radii, thin borders, and low diffuse shadows.
- Do not introduce unrelated saturated colors or gradient-heavy cards.
- Do not sacrifice visible labels, focus rings, or contrast for visual minimalism.
