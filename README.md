# trustayurved.com — redesign

Static rebuild of **Shraddha Ayurvedic Clinic** (trustayurved.com) in Astro. All copy is crawled verbatim from the live WordPress site; only layout, styling, motion, and code changed.

## Run

```bash
npm install
npm run dev        # http://localhost:4321 with hot reload
npm run build      # static site → dist/
npm run preview    # serve dist/ at http://localhost:4321
```

Optional: set `PUBLIC_FORM_ENDPOINT` (for example, a Formspree URL) to make the contact form POST. Without it, the form opens the visitor's email app addressed to the contact-page email.

## How content works

- `scripts/crawl.py` snapshots the live site into `src/data/crawl.json` (every Elementor widget, in order) and `src/data/posts.json` (blog, via the WP REST API). It also downloads original images to `src/assets/wp/`.
- Pages select crawled widgets by position (`src/lib/content.ts`). If the live site changes shape, the build fails loudly instead of rendering the wrong text.
- `src/data/hero.ts` is the only hand-transcribed copy. On the live site the hero text is baked into the banner image, so it can't be crawled.

## Design system

- Tokens: `src/styles/tokens.css` (color, type, layout, motion; light and dark). Components: `src/styles/global.css`.
- Style guide: `/style-guide/` (not indexed).
- Signature motion: `src/scripts/ambience.ts` (homepage only). It handles the WebGL Shirodhara drop and ripples and the optional generated rain sound.
- Site-wide ambience: `src/components/Sky.astro` is the fixed golden light layer (sun, ember, two light shafts, drifting pools). `src/scripts/leaves.ts` is the falling-leaf canvas. Leaves favor the page margins on wide screens and carry over between pages. Condensation shows on every photo row and on the closing contact band.
- Motion: cards and photos float slowly (`.float`), cards lift with a pointer-following golden glow, reveals rise and settle, and pages cross-fade with CSS View Transitions while the header and light layer stay put.
- Everything ambient loads after first paint and pauses in hidden tabs. Under reduced motion it stops: still glow, a leaf at rest, fade-only transitions.
- Gold is ambient light only; green (`--accent`) stays the only interactive color. Text contrast is verified at the glow's brightest point.

## Checks

```bash
node scripts/verify-copy.mjs   # every crawled text block appears verbatim in dist/
node scripts/audit.mjs         # axe WCAG 2.2 AA, one <h1>, no 320px overflow; light and dark (needs `npm run preview`)
```

Last run: 930/930 text blocks verbatim; axe clean on all 22 pages in both schemes; Lighthouse mobile median: homepage 99 / 100 / 100 / 100 (LCP ≈1.6s, CLS 0), inner pages 100 across the board.

## Decisions to review

- **Hero copy** uses the banner's wording ("Welcome to Shraddha Ayurvedic Clinic / Authentic Ayurvedic Treatments for Mind, Body, & Soul / Your Trusted Destination for Holistic Healing"). The brief's "Authentic Ayurvedic Healing for Mind & Body" doesn't exist on the live site. The banner images aren't shown because their text is now live HTML. The hero uses the clinic's Shirodhara photo instead.
- **"Book Consultation"** isn't live-site copy, so the hero CTAs are "WhatsApp us" and "Contact Us".
- **Services** come from the live marquee. The live site has no service descriptions, so the cards show titles only and link to the relevant treatment page.
- **Shop** (`/shop/`) 301-redirects to `/` on the live site; kept as a redirect. **Compare** is an empty page on the live site; kept as-is (noindex). Neither appears in the live header menu, so neither was added to it.
- **WhatsApp** links to `wa.me/919016011528` (from the live click-to-chat plugin). The plugin's pre-filled message mentions "GLOWEE" (likely a template leftover), so it was dropped.
- **Gallery**: 7 byte-identical duplicate uploads are shown once each.
- **Kept verbatim, possibly typos on the live site**: "…lifelong wellness and harmony.D" (About → Our Vision), "Our Counselling Services" eyebrow on General & Lifestyle Disorders, two different emails (footer `info@shraddhaayurveda.com`, contact page `trustayurved@trustayurved.in`).
- **Not used**: the "Why Choose" black clip-art icons and the testimonial quote PNG (replaced by the clinic's own room photos and line icons), plus two stock theme backgrounds.
- **Stack**: Astro + plain CSS tokens instead of Tailwind + Framer Motion, so pages ship near-zero JS. The ambient scene is 4.7 KB gzipped.

## Screenshots

`screenshots/`: homepage at 1440 and 390, light and dark, plus a reduced-motion frame.
