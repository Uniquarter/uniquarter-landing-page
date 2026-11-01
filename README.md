# UniQuarter landing site

The temporary public site for uniquarter.co.nz: a home page and a 404 page, as plain HTML and CSS with no build step. It is hosted on GitHub Pages from this public repository.

The app lives in a separate private monorepo (`uni-quarter`). This site borrows that repo's design tokens but none of its code.

## What is where

| Path | What it is |
|---|---|
| `index.html` | The home page |
| `404.html` | Served by GitHub Pages for any address that does not exist |
| `privacy/index.html` | The privacy notice for the sign-up form |
| `confirm/index.html` | Where the link in the confirmation email lands. Not indexed |
| `worker/` | The Cloudflare Worker behind the sign-up form, with its tests and setup script |
| `.github/workflows/worker.yml` | Tests and deploys the Worker when `worker/` changes on `main` |
| `assets/css/tokens.css` | The design system's tokens, copied in by the sync script. Do not edit by hand |
| `assets/css/site.css` | Everything else: base rules, layout, components, and the marketing additions |
| `assets/js/site.js` | The two tab groups, the equal-height cards, the sign-up form and the confirm page. The page works without it: every panel shows, stacked, the cards stretch together, and the sign-up section shows the email address instead of the form |
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

## Changing the CSS or JavaScript

The stylesheet and script links in `index.html` and `404.html` end in `?v=` and a date. When you change a CSS or JS file, change that date in both pages, so browsers fetch the new file instead of a saved old one.

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

## The sign-up form

The "Register your interest" section holds a sign-up form. The list lives in Resend, the email provider. A small Cloudflare Worker sits between the page and Resend, because a public web page can't hold the Resend key.

### How a sign-up works

1. The visitor fills in the form. If their email domain looks like a typo of a common one, such as gmial.com, the form offers "Did you mean ..." with a button to fix it. The domain list is `SIGNUP_DOMAINS` in `site.js`. Cloudflare Turnstile, usually invisibly, checks they are a person.
2. `site.js` posts the form to the Worker's `/subscribe` address.
3. The Worker checks the fields and the Turnstile result. It seals the sign-up into an encrypted token that lasts 24 hours, and emails a link to `https://uniquarter.co.nz/confirm/#<token>`. It stores nothing.
4. On the confirm page, the visitor presses "Confirm my interest". The button posts the token to `/confirm`. A button is used so that email scanners that open links can't confirm on someone's behalf.
5. The Worker opens the token and creates or updates the contact in Resend, in the "Register interest" segment, with the properties `role`, `institution`, `consented_at`, `consent_version` and `source`. It then emails hello@uniquarter.co.nz a short heads-up with the person's details, so the team sees each registration as it lands. A failed heads-up is logged, but the person stays on the list.

Nobody is stored until they confirm. `consented_at` makes each link single use, so an old link can't re-subscribe someone who has unsubscribed since.

### Where the settings live

| Setting | Where |
|---|---|
| The Worker's address | `data-endpoint` on the form in `index.html`, and on `#confirm` in `confirm/index.html` |
| The Turnstile site key (public) | `data-sitekey` on the form in `index.html` |
| Sender, reply-to, who gets the heads-up email, allowed origins, confirm page address, consent version | `[vars]` in `worker/wrangler.toml` |
| `RESEND_API_KEY`, `RESEND_SEGMENT_ID`, `TOKEN_KEY`, `TURNSTILE_SECRET` | GitHub repository secrets, pushed to the Worker by the workflow |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub repository secrets, used by the workflow to deploy |

The form stays hidden, and the email address shows instead, until `data-sitekey` holds a real key. So the page is safe to publish before the setup below is finished.

IMPORTANT: when the wording under the form changes, change `CONSENT_VERSION` in `worker/wrangler.toml` too, so each contact records which wording they agreed to.

### One-off setup

1. **Resend.** Create an account, add the domain `news.uniquarter.co.nz` (Tokyo region) and add the DNS records it lists, with hosts such as `send.news` and `resend._domainkey.news`. Emails go out from `hello@news.uniquarter.co.nz`, a sub-address kept apart from the main domain so that newsletter spam complaints can't hurt the reputation of everyday Outlook mail. Replies go to `hello@uniquarter.co.nz`. None of these records touch the Microsoft 365 mail records. The domain's DNS is managed at the registrar, not in UniQuarter's Cloudflare account. Also add a TXT record with host `_dmarc` and value `v=DMARC1; p=none;`, which Gmail and Yahoo expect from anyone sending to their users. Create a full-access API key, then run this from `worker/`:
   ```
   npm ci
   RESEND_API_KEY=re_xxx npm run setup-resend
   ```
   It creates the five contact properties and the segment, and prints `RESEND_SEGMENT_ID`.
2. **Cloudflare.** Create a free account. Set the workers.dev subdomain to `uniquarter`, which gives the Worker the address already in the HTML: `https://uniquarter-signup.uniquarter.workers.dev`. Add a Turnstile widget for `uniquarter.co.nz` and `www.uniquarter.co.nz` in Managed mode, and put its site key in `data-sitekey`. Create an API token from the "Edit Cloudflare Workers" template, limited to this account.
3. **TOKEN_KEY.** Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
4. **GitHub.** Add the six secrets from the table above under Settings, Secrets and variables, Actions. Then run the "Sign-up Worker" workflow from the Actions tab, or push a change under `worker/`.

### Running it locally

From `worker/`, copy `.dev.vars.example` to `.dev.vars` and fill it in. git ignores `.dev.vars`; never commit it. Then:

```
npm ci
npm test
npm run dev
```

`npm run dev` serves the Worker at http://localhost:8787 and allows requests from localhost. Serve the site with `python3 -m http.server 8000`, and while testing set the form's `data-endpoint` to `http://localhost:8787` and `data-sitekey` to Turnstile's test key `1x00000000000000000000AA`. Do the same for `data-endpoint` on the confirm page. Put both back before committing.

### Replacing a key

- **Resend key:** create a new one in Resend, update `RESEND_API_KEY` in GitHub, run the workflow, then delete the old key in Resend.
- **Cloudflare API token:** it was created in November 2026 to expire after a year. When it lapses, the deploy workflow fails, but the live Worker keeps running. Make a new one from the "Edit Cloudflare Workers" template with only Workers Scripts (Edit), Account Settings (Read), Workers Tail (Read), User Details (Read) and Memberships (Read), then update `CLOUDFLARE_API_TOKEN` in GitHub.
- **TOKEN_KEY:** replacing it breaks any confirmation links sent in the last 24 hours. Those people see "This link does not work" and can sign up again.

### Exporting the list

Resend's dashboard exports the segment as a CSV. When UniQuarter's production database exists, import the list there and update the privacy page before moving it.

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
