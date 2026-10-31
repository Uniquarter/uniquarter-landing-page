# UniQuarter landing site

The temporary public site for uniquarter.co.nz: a home page and a 404 page, as plain HTML and CSS with no build step. It is hosted on GitHub Pages from this public repository.

The app lives in a separate private monorepo (`uni-quarter`). This site borrows that repo's design tokens but none of its code.

## What is where

| Path | What it is |
|---|---|
| `index.html` | The home page |
| `404.html` | Served by GitHub Pages for any address that does not exist |
| `assets/css/tokens.css` | The design system's tokens, copied in by the sync script. Do not edit by hand |
| `assets/css/site.css` | Everything else: base rules, layout, components, and the marketing additions |
| `assets/js/site.js` | The two tab groups, and the equal-height cards. The page works without it: every panel shows, stacked, and the cards stretch together |
| `assets/fonts/` | Bricolage Grotesque and Instrument Sans, self-hosted, with their OFL licences |
| `assets/img/` | App screenshots, and the logo lockups from the brand files |
| `favicon.ico`, `apple-touch-icon.png`, `og-image.png` | Browser, home-screen and link-preview images |
| `robots.txt`, `sitemap.xml` | For search engines. Update `lastmod` in the sitemap when the page changes |
| `CNAME` | Tells GitHub Pages to serve the site at uniquarter.co.nz |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are, without running Jekyll |
| `scripts/sync-tokens.mjs` | Copies the tokens across from the monorepo |

## Previewing locally

Open `index.html` in a browser, or serve the folder so the 404 page's root paths work too:

```
python3 -m http.server 8000
```

Then go to http://localhost:8000.

## Keeping the tokens in step with the app

When colours, type, spacing or any other tokens change in the monorepo, run this from this repo's folder:

```
node scripts/sync-tokens.mjs
```

It expects the monorepo at `../Uni Quarter`. If it is somewhere else, pass the path to `packages/design-system` as the first argument. The script copies the generated `tokens.css` and drops the Tailwind-only `@theme` block. Check the page, then commit.

## How this site uses the design system

The site follows the design system wherever the rule is about accessibility or brand consistency. It departs where a marketing page needs something the app does not.

**Taken from the design system as is**

- All colour, spacing, radius, border, motion and z-index values are `--uq-` tokens. `site.css` contains no hex values.
- Ordinary buttons follow the design system: teal primary, white-and-teal secondary. Buttons and tabs use 8px corners, a 1.5px border and a 44px minimum height.
- There is one focus ring everywhere: a 2px teal outline with a white halo, so it shows on teal as well as on white.
- Links are Primary Teal and underlined, except in the header navigation.
- Coral, Sky Blue and Gold never carry meaning. Coral appears as the fill of the main call-to-action button, as decoration (bullets, the status dot, the number discs) and as the darker accent text token used for eyebrows. Gold is used only for the star ratings in the illustrations.
- The fonts are self-hosted. The site keeps the design system's body text size, eyebrow letter-spacing, skip link, reduced-motion rules and forced-colours rules.
- The page is pinned to light mode with `data-theme="light"`, so the dark-mode tokens are present but never apply.

**Marketing departures, all in `site.css` as `--lp-` values**

- **Coral call to action.** "Contact" in the header and "Register interest" in the hero are coral with Ink text, so the main action stands out. The design system's buttons are teal. White text on coral would fail contrast (2.81:1); Ink passes at 5.27:1, and 6.72:1 on hover.
- **Display type.** The design system's largest size is 36px. The hero heading goes up to 56px, section headings to 40px, and sub-headings to 30px. Large headings use slightly tighter letter-spacing (-0.02em).
- **Long-form line height.** Paragraphs in long sections use 1.6, against the design system's 1.5.
- **Page width and rhythm.** The content is 1140px wide, with 96px between sections (64px on phones).
- **Header.** The header is white and 64px tall. The app's header is teal and 56px. A teal header would merge into the teal hero.
- **Ink band.** The "Four rules that never change" section sits on Ink, which the app does not use as a surface.
- **Footer.** The footer uses `teal-800` straight from the colour ramp, a step darker than the hero.
- **Illustrations.** The four inline illustrations and the icons keep their colours written into the SVG. Every colour in them matches a token value.

**Changed while porting, to meet the design system's rules**

- The coral "Register interest" button had white text at 2.81:1 contrast, which fails WCAG AA. It now keeps the coral but uses Ink text (see the coral call to action above).
- The coral focus ring measured 2.73:1 on teal, which fails the 3:1 a focus indicator needs. It is now the design system's ring.
- Coral borders, coral underlines and Sky Blue text were replaced with teal, white or neutral equivalents.
- Grey text on the light grey bands failed contrast in two places. It now uses the stronger text colour.

The page passes axe (WCAG 2.2 AA plus best practice) at 1280, 375 and 320px wide, with no horizontal scroll.

## Publishing on GitHub Pages

1. On GitHub, create a new **public** repository, for example `uniquarter-landing-page`, without a README.
2. Push this repo to it:
   ```
   git remote add origin https://github.com/<your-account>/uniquarter-landing-page.git
   git push -u origin main
   ```
3. In the repository, go to Settings, then Pages. Under "Build and deployment", set Source to "Deploy from a branch", Branch to `main`, and folder to `/ (root)`. Save.
4. Under "Custom domain", check that `uniquarter.co.nz` is filled in (it comes from the `CNAME` file).
5. At the domain registrar, add these DNS records:
   - Four `A` records for `uniquarter.co.nz`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`
   - A `CNAME` record for `www` pointing to `<your-account>.github.io`
6. Once the DNS check passes, tick "Enforce HTTPS".
7. Also verify the domain for your GitHub account (Settings, Pages, "Add a domain"). This stops anyone else's repository from claiming it.

Until the custom domain is live, the site is at `https://<your-account>.github.io/uniquarter-landing-page/`. The home page works there, but the 404 page will look unstyled, because its paths start from the root of the domain.

Check GitHub's current documentation on custom domains before changing DNS. The IP addresses above are the ones GitHub published at the time of writing.
