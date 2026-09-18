# Technical Documentation

Architecture reference for the occasional-wotd project. For philosophy, principles, and code standards, see [AGENTS.md](../AGENTS.md) (also available via the `CLAUDE.md` symlink).

## Framework & Stack

- **[Astro](https://astro.build/)** - Static site generator; zero application JavaScript by default — no UI framework or hydration; only Astro's prefetch runtime and small progressive enhancements ship; native CSS view transitions ship no JS
- **TypeScript** - Strict mode (`strictNullChecks`, `noUncheckedIndexedAccess`)
- **Node.js 26+** - Runtime (`.nvmrc` provided)
- **[Vitest](https://vitest.dev/)** - Unit, component, and integration testing
- **[Playwright](https://playwright.dev/)** - E2E testing against the built static site
- **[Sharp](https://sharp.pixelplumbing.com/)** + [OpenType.js](https://opentype.js.org/) - Social image generation
- **[oxlint](https://oxc.rs/)** - Linting

## File Structure

```
src/
  content.config.ts              # Astro Content Collections config
  components/                    # Reusable Astro components
  layouts/                       # Page layout templates
  pages/                         # Route definitions
  utils/                         # Astro-specific utilities (10 files)
  styles/                        # CSS files
  assets/                        # Static assets

utils/                           # Pure Node.js utilities (13 files)
  adapter-utils.ts               # Shared adapter helpers (POS, transforms, HTTP)
  breadcrumb-utils.ts            # Breadcrumb navigation logic
  date-utils.ts                  # Date manipulation (YYYYMMDD format)
  i18n-utils.ts                  # Translation helpers (t(), tp())
  logger-core.ts                 # Logger factory (SentryBridge + output filter)
  logger.ts                      # CLI logger wrapper (@sentry/node)
  page-metadata-utils.ts         # Page title/description generation
  text-pattern-utils.ts          # Pattern detection (palindromes, double letters, etc.)
  text-utils.ts                  # slugify(), syllable counting, re-exports
  url-utils.ts                   # URL generation for routes
  word-data-utils.ts             # Word filtering (by year, length, letter, etc.)
  word-stats-utils.ts            # Statistics calculation algorithms
  word-validation.ts             # Dictionary data validation

tools/                           # CLI tools (Node.js only, no Astro deps)
  add-word.ts                    # Add new words with validation
  generate-images.ts             # Social image generation (consolidated)
  help-utils.ts                  # Shared help system
  regenerate-all-words.ts        # Batch word data refresh
  utils.ts                       # Shared tool utilities

adapters/                        # Dictionary API adapters
  index.ts                       # Adapter registry + fallback chain
  merriam-webster.ts             # Merriam-Webster Collegiate API
  wordnik.ts                     # Wordnik API
  wiktionary.ts                  # Free Dictionary API (Wiktionary-sourced)

config/
  paths.ts                       # Path configuration (SOURCE_DIR-based)

constants/
  parts-of-speech.ts             # Part of speech normalization mappings
  stats.ts                       # Statistics definitions and slugs
  text-patterns.ts               # Regex patterns, milestones, word endings
  urls.ts                        # URL constants, route builders

types/                           # Shared TypeScript definitions
  index.ts                       # Barrel export
  adapters.ts                    # DictionaryAdapter, DictionaryResponse
  common.ts                      # LogContext, PathConfig, FetchOptions, SourceMeta
  word.ts                        # WordData, WordProcessedData, stats result types
  stats.ts                       # StatsDefinition, StatsSlug, SuffixKey
  schema.ts                      # JSON-LD schema types
  seo.ts                         # SEO metadata types
  merriam-webster.ts             # MW API response types
  wiktionary.ts                  # Free Dictionary API types
  wordnik.ts                     # Wordnik API response types
  vite.d.ts                      # Build-time global declarations
  opentype.js.d.ts               # OpenType.js type shim

locales/
  en.json                        # English translations

tests/
  setup.js                       # Global mocks (astro:env/client, astro:content, translations)
  helpers/spawn.js               # CLI tool process spawner
  adapters/                      # Adapter tests (Vitest)
  architecture/                  # Import boundary enforcement (Vitest)
  config/                        # Config tests (Vitest)
  constants/                     # Constants tests (Vitest)
  e2e/                           # E2E tests against built site (Playwright)
  src/                           # Astro component/utility tests (Vitest)
  tools/                         # CLI integration tests (Vitest)
  utils/                         # Pure utility tests (Vitest)

.agents/                         # Agent skills (tool-agnostic)
  skills/                        # validate, commit, pr workflows

.claude/                         # Claude Code config
  hooks/                         # Safety hooks (destructive commands, main branch guard)
  settings.json                  # Shared permissions and hook registrations
  skills -> ../.agents/skills/   # Symlink to agent skills

.github/
  actions/setup-env/             # Composite action: repository variables and secrets into the job
  workflows/                     # CI: lint, typecheck, test, build, e2e; add-word; deploy
  copilot-instructions.md        # GitHub Copilot guidelines
  instructions/                  # Scoped Copilot instructions (review focus)
  pull_request_template.md       # PR body template
```

## Environment Configuration

All environment variables are validated in `astro.config.ts` (single source of truth). See `.env.example` for the complete list with defaults.

### Required

| Variable | Purpose |
|----------|---------|
| `SITE_URL` | Canonical URL (e.g., `https://example.com`) |
| `SITE_TITLE` | Site name |
| `SITE_DESCRIPTION` | Site description for SEO |
| `SITE_ID` | Unique site identifier |

### Data & Dictionary

| Variable | Default | Purpose |
|----------|---------|---------|
| `SOURCE_DIR` | `''` | Data source subdirectory (unset = root paths) |
| `DICTIONARY_ADAPTER` | `wordnik` | Primary dictionary API (`merriam-webster`, `wordnik`, `wiktionary`) |
| `DICTIONARY_FALLBACK` | `wiktionary` | Fallback chain, comma-separated (e.g. `wordnik,wiktionary`) |
| `MERRIAM_WEBSTER_API_KEY` | — | Merriam-Webster API key |
| `MERRIAM_WEBSTER_API_URL` | `https://dictionaryapi.com/api/v3/references` | MW API endpoint |
| `MERRIAM_WEBSTER_DICTIONARY` | `collegiate` | MW dictionary edition |
| `WORDNIK_API_KEY` | — | Wordnik API key |
| `WORDNIK_API_URL` | `https://api.wordnik.com/v4` | Wordnik API endpoint |
| `WORDNIK_WEBSITE_URL` | `https://www.wordnik.com` | Wordnik website (for cross-ref links) |

### Deployment

| Variable | Default | Purpose |
|----------|---------|---------|
| `BASE_PATH` | `/` | Subdirectory for deployment |
| `SITE_LOCALE` | `en-US` | Locale for i18n |

### Site Metadata

| Variable | Default | Purpose |
|----------|---------|---------|
| `SITE_AUTHOR` | `''` | Author name for attribution |
| `SITE_AUTHOR_URL` | `''` | Author website URL |
| `SITE_ATTRIBUTION_MESSAGE` | `''` | Custom attribution text |
| `SITE_KEYWORDS` | `''` | SEO keywords (comma-separated) |

### humans.txt

| Variable | Default | Purpose |
|----------|---------|---------|
| `HUMANS_WORD_CURATOR` | `''` | Word curator name |
| `HUMANS_DEVELOPER_NAME` | `''` | Developer name |
| `HUMANS_DEVELOPER_CONTACT` | `''` | Developer contact |
| `HUMANS_DEVELOPER_SITE` | `''` | Developer website |

### Feature Flags

| Variable | Default | Purpose |
|----------|---------|---------|
| `SENTRY_ENABLED` | `false` | Error tracking |
| `SENTRY_DSN` | — | Sentry data source name |
| `SENTRY_ORG` | — | Sentry organization |
| `SENTRY_PROJECT` | — | Sentry project name |
| `SENTRY_AUTH_TOKEN` | — | Sentry auth token (sourcemap uploads) |
| `SENTRY_ENVIRONMENT` | `development` | Sentry environment tag |
| `SENTRY_RELEASE` | auto-generated | Release identifier (`name@version+hash`) |
| `GA_ENABLED` | `false` | Google Analytics |
| `GA_MEASUREMENT_ID` | — | GA measurement ID |

### Theming

| Variable | Default | Purpose |
|----------|---------|---------|
| `COLOR_PRIMARY` | `#9a3412` | Primary brand color |
| `COLOR_PRIMARY_LIGHT` | `#c2410c` | Light variant |
| `COLOR_PRIMARY_DARK` | `#7c2d12` | Dark variant |

### Dark Mode

Opt-in via environment variables. Setting `COLOR_DARK_BACKGROUND` activates dark mode — it's the minimum viable dark palette. All other dark vars are optional; unset ones fall back to the light-mode value.

| Variable | Maps to | Fallback |
|----------|---------|----------|
| `COLOR_DARK_BACKGROUND` | `--color-background` | *(enablement trigger)* |
| `COLOR_DARK_BACKGROUND_LIGHT` | `--color-background-light` | light value |
| `COLOR_DARK_PRIMARY` | `--color-primary` | light value |
| `COLOR_DARK_PRIMARY_LIGHT` | `--color-primary-light` | light value |
| `COLOR_DARK_PRIMARY_DARK` | `--color-primary-dark` | light value |
| `COLOR_DARK_TEXT` | `--color-text` | light value |
| `COLOR_DARK_TEXT_LIGHT` | `--color-text-light` | light value |
| `COLOR_DARK_BORDER` | `--color-border` | light value |

When enabled, `Layout.astro` emits a `@media (prefers-color-scheme: dark)` block with the configured overrides and a dark-variant `<meta name="theme-color">`. No JavaScript required — respects the user's system preference. When no dark vars are set, the site is light-only with no dark mode CSS emitted.

### Environment Access

Environment variables in `src/` code are accessed via Astro's type-safe `astro:env/client` module. The schema is defined in `astro.config.ts` using `envField` — this provides validation, defaults, and TypeScript types. All env vars use `context: 'client'` since this is a fully static site with no secrets.

Four computed build-time constants remain as Vite `define` globals (declared in `types/vite.d.ts`):

| Global | Purpose |
|--------|---------|
| `__VERSION__` | Package version from `package.json` |
| `__RELEASE__` | Release identifier (`name@version+hash`) |
| `__TIMESTAMP__` | Build timestamp (ISO 8601) |
| `__WORD_DATA_PATH__` | Resolved word data directory path |

## Word Data

### Storage Format

Each word is a JSON file at `data/[{SOURCE_DIR}/]words/{year}/{YYYYMMDD}.json` (the `SOURCE_DIR` segment is included only when set):

```json
{
  "word": "serendipity",
  "date": "20250131",
  "adapter": "wordnik",
  "data": [
    {
      "text": "The faculty of making fortunate discoveries by accident.",
      "partOfSpeech": "noun",
      "sourceDictionary": "wordnik"
    }
  ],
  "preserveCase": false
}
```

### Content Collections

Words load via Astro Content Collections at build time. `src/content.config.ts` uses `glob()` with `__WORD_DATA_PATH__` (injected by `astro.config.ts`) to find JSON files.

```typescript
export const collections = {
  words: defineCollection({
    loader: glob({ pattern: '**/*.json', base: __WORD_DATA_PATH__ })
  })
};
```

### Computed Derivatives

`src/utils/word-data-utils.ts` loads `allWords` once and derives everything from it:

```typescript
export const allWords = await getAllWords();
export const wordStats = getWordStats(allWords);
export const availableYears = getAvailableYears(allWords);
export const getWordsForYear = (year: string) => getWordsByYear(year, allWords);
```

Statistics are computed once at build time, not recalculated per page.

### i18n

All user-facing strings go through `locales/en.json`. The `t(key)` function from `utils/i18n-utils.ts` returns the translation, and `tp(key, count)` handles pluralization. Translation keys use dot notation (`words.count`, `stats.title`). Components and utilities import `t()` directly -- no framework-level i18n integration. Adding a new string means adding the key to `en.json` and using `t('key')` at the call site.

### Validation Rules

- Each word can only be used once across all dates (global uniqueness)
- No future dates
- Word must exist in the configured dictionary
- Strict YYYYMMDD format

## CLI Tools

All tools are pure Node.js (no Astro deps) and use `util.parseArgs()` for argument parsing.

Tools run directly on Node's built-in TypeScript support (`node tools/<tool>.ts`); there is no loader or compile step. `npm run tool:local <tool>` runs a tool through `node --env-file-if-exists=.env`, so `.env` is loaded when present and variables already in the environment win. When `.env` is absent Node prints `.env not found. Continuing without it.` to stderr and carries on. The bare `tool:*` scripts (`tool:generate-images`, `tool:regenerate-all-words`, ...) do not load `.env`: image tools render without the site title and the Merriam-Webster adapter throws without its key.

npm keeps any flag written before a bare `--` for itself, so a tool's flags always follow one: `npm run tool:local tools/add-word.ts -- --help` and `npm run tool:add-word -- --help` print the tool's help, and without the separator npm prints its own. `tests/architecture/npm-scripts.spec.js` enforces this in `package.json`, tool help text, docs and workflows.

### `add-word.ts`

Adds a word with dictionary validation, duplicate detection, and automatic image generation.

```sh
npm run tool:local tools/add-word.ts serendipity
npm run tool:local tools/add-word.ts ephemeral 20250130
npm run tool:local tools/add-word.ts -- Japan --preserve-case
npm run tool:local tools/add-word.ts -- serendipity --overwrite
```

### `generate-images.ts`

Consolidated image generation (SVG templates, Sharp PNG conversion, 1200x630px OpenGraph).

```sh
npm run tool:local tools/generate-images.ts                         # All images
npm run tool:local tools/generate-images.ts -- --word serendipity   # Single word
npm run tool:local tools/generate-images.ts -- --words              # All word images
npm run tool:local tools/generate-images.ts -- --generic            # Generic page images
npm run tool:local tools/generate-images.ts -- --page /stats        # Specific page
npm run tool:local tools/generate-images.ts -- --force              # Regenerate existing
```

### `regenerate-all-words.ts`

Batch refresh of word data from the dictionary API. Supports dry-run mode and rate limiting. `--force` re-sources every word through the configured adapter chain (the `adapter` field follows); pronunciation audio and etymology come only from Merriam-Webster, so run it via `tool:local` with `MERRIAM_WEBSTER_API_KEY` in `.env` to backfill them.

## URL System

Two-tier system supporting root and subdirectory deployments:

| Function | Purpose | Example (`BASE_PATH="/blog"`) |
|----------|---------|-------------------------------|
| `getUrl(path)` | Relative URL with BASE_PATH | `getUrl('/words/hello')` -> `/blog/words/hello` |
| `getFullUrl(path)` | Absolute URL for SEO | `getFullUrl('/words/hello')` -> `https://example.com/blog/words/hello` |

`getFullUrl()` uses `getUrl()` internally to ensure BASE_PATH consistency.

### Route Structure

```
/                           # Homepage (current word)
/words/{word}               # Individual word pages
/{YYYYMMDD}/                # Date-based word access
/browse/                    # Browse hub
/browse/year/{year}         # Words by year
/browse/letter/{letter}     # Words by starting letter
/browse/length/{n}          # Words by length
/browse/part-of-speech/{p}  # Words by part of speech
/stats/                     # Statistics hub
/stats/{category}           # Individual stat pages
```

## Sentry Integration

### Sentry SDKs

Three Sentry contexts, each with its own SDK:

| Context | SDK | Config | Purpose |
|---------|-----|--------|---------|
| Browser | `@sentry/astro` | `sentry.client.config.js` | Tracing, error-only session replays |
| Server | `@sentry/astro` | `sentry.server.config.js` | Tracing disabled (static site) |
| CLI | `@sentry/node` | Lazy init in `utils/logger.ts` | Only initializes on first error |

### Logger Architecture

All loggers share a factory in `utils/logger-core.ts` that creates a `Proxy` over `console`. The factory accepts a `SentryBridge` interface and an optional output filter. Each environment provides its own bridge (wiring to the correct SDK) and filter.

```
utils/logger-core.ts          Core factory: createLogger(options)
                               - Console proxy with Sentry forwarding
                               - SentryBridge interface (withScope, captureException, captureMessage)
                               - shouldOutput filter for log level control

utils/logger.ts                CLI wrapper: @sentry/node
                               - Lazy Sentry init (first error only)
                               - All log levels always output
                               - exit(), flush(), getErrorMessage() helpers

src/utils/logger.ts            Astro wrapper: @sentry/astro
                               - Sentry already initialized by Astro integration
                               - Prod: only warn/error output
                               - config export (isDev, sentryEnabled, version)
```

The `isLogContext` type guard from `#types` validates the context argument before `Object.entries()` iteration. This prevents iterating over string characters or Error instance properties.

**The `exit()` helper**: Always use `await exit(code)` instead of `process.exit()` in error handlers. `process.exit()` kills in-flight async work immediately, losing pending Sentry events. `exit()` flushes first.

## Statistics System

All statistics computed at build time from `allWords`:

- **Letter patterns**: Palindromes, double/triple letters, alphabetical sequences, same start/end
- **Word endings**: Common suffixes (-ed, -ing, -ly, -ness, -ful, -less)
- **Letter analysis**: Most/least common letters (ranked by the number of words containing the letter, case-insensitive, not by total occurrences; `getLetterStats` is the single definition for the stat, its page, and its metadata), vowel/consonant ratios
- **Streaks**: Current and longest consecutive word streaks
- **Milestones**: 1st, 25th, 50th, 100th words, etc.

Definitions live in `constants/stats.ts`. Computation functions in `utils/word-stats-utils.ts` (pure) and `src/utils/word-stats-utils.ts` (Astro wrapper). All stat pages are always generated — if a stat has zero results, the page renders with a zero count. Demo word coverage should be expanded if stats pages need test data rather than adding feature flags to skip pages.

## Image Generation

- **Templates**: Programmatic SVG with OpenType.js text measurement
- **Conversion**: Sharp PNG rasterization (1200x630px, 90% quality, 128-color palette)
- **Typography**: Liberation Sans Regular + Bold (`tools/fonts/liberation-sans/`), gradient text with theme colors
- **Output**: `public/images/social/{SOURCE_DIR}/2024/20240105-giggle.png` (word) and `public/images/social/pages/{page}.png` (static). `SOURCE_DIR` segment is omitted when unset.
- **Skip guard**: `.image-settings-hash` is an md5 fingerprint of what determines an image's bytes, inputs and renderer alike: two probe SVGs rendered through the real template (colors, site title, dimensions, layout), the PNG options, both font files, and `sharp.versions` (sharp, libvips and the libraries bundled with it), so a sharp upgrade that re-quantizes the palette invalidates the cache on its own. Each run compares it once; on a mismatch every existing image in that run is regenerated, otherwise existing files are skipped. `--force` regenerates regardless. The marker is only written by a run that covered all words and all pages with no failures, whether that was the default run or `--words --generic` together, so `--word`, `--page`, and `--words` or `--generic` alone never certify the corpus. `npm run build` copies `public/` verbatim and never regenerates images.
- **CI**: the Add Word workflow runs the complete generation (`npm run tool:generate-images`) after adding a word, not `--word`. With a current marker that renders the new word's card and skips the rest; after a settings, font or sharp change it regenerates every card once and commits them with the refreshed marker (the commit step stages every PNG under `images/social` and the marker). A single-image run could never write the marker, so the skip guard would stay stale in CI forever.

## Testing

### Strategy

Tests are organized by what they validate, with no overlap between layers. Each function is tested at exactly one layer. Unit tests validate logic. E2E tests validate the built output. This avoids duplication while ensuring comprehensive coverage.

### Layer Boundaries

The key question for each test: what is the minimum layer that can verify this?

**Belongs at E2E** (requires built site in a real browser):

| What | Why |
|------|-----|
| Navigation flows (click link, page loads) | Route resolution only works against built output |
| 404 handling | HTTP status codes require a running server |
| Meta tags exist in rendered HTML | Verifies build pipeline assembled components correctly |
| JSON-LD parses as valid JSON | Script tags must survive the build |
| RSS feed and sitemap return HTTP 200 | HTTP-level concerns |
| Skip-to-content keyboard flow | Real focus management in a real browser |
| Image alt text in rendered pages | Build-time content processing output |
| Link accessible text | Assembled page structure |

**Does NOT belong at E2E** (tested at lower layers):

| What | Better layer | Why |
|------|-------------|-----|
| URL generation logic | Unit | Pure function, no browser needed |
| Meta tag content values | Component | Input/output of a single component |
| JSON-LD structure and content | Component | Data structure validation |
| Schema.org field correctness | Component | Schema-utils produces the data |
| Word filtering/sorting | Unit | Pure function |
| Import boundary enforcement | Architecture | Static analysis |
| Statistics calculations | Unit | Pure function |

E2E tests follow user journeys: each test starts at an entry point, discovers content through navigation, and asserts on element presence. No hardcoded word URLs. No content-value assertions that duplicate component tests.

### Layers

| Layer | Location | Tool | Speed | Purpose |
|-------|----------|------|-------|---------|
| Unit | `tests/utils/`, `tests/adapters/` | Vitest | Fast | Pure function correctness |
| Component | `tests/src/` | Vitest | Fast | Astro wrappers, SEO, schemas |
| Architecture | `tests/architecture/` | Vitest | Fast | Import boundary enforcement |
| CLI Integration | `tests/tools/` | Vitest | Slow | Process spawning, protocol errors |
| E2E | `tests/e2e/` | Playwright | Slow | Built site navigation, SEO, accessibility |

### Coverage

Vitest thresholds: lines 80%, functions 80%, branches 85%, statements 80%.

Excluded from Vitest coverage: build-time utilities (`static-file-utils.ts`, `static-paths-utils.ts`), pages, CLI tools (tested via integration), content config.

E2E tests run against the built site via `npm run test:e2e` (requires `npm run build` first). Playwright starts its own foreground `astro preview --ignore-lock` on port 4517 (`PORT` in `playwright.config.ts`, `reuseExistingServer: false`), so the run always serves the current `dist/` and never reuses a server on Astro's default 4321. They verify build assembly — that the pipeline correctly assembled components into working pages — not logic (which unit and component tests cover). Three spec files organized by concern:

- **`navigation.spec.ts`** — User journeys: discover a word and navigate between words, browse by year, footer section links, 404 handling
- **`seo.spec.ts`** — Build output wiring: meta tags present (description, canonical, OpenGraph, Twitter), JSON-LD parseable, RSS and sitemap discoverable
- **`accessibility.spec.ts`** — Structural a11y: skip-to-content keyboard flow, document language and viewport, image alt text, link accessible text

E2E always runs in demo mode — the CI workflow skips `setup-env` and explicitly sets `SOURCE_DIR=demo` (no `BASE_PATH`) so production env vars don't break test selectors. All test URLs omit trailing slashes (`trailingSlash: 'never'`).

### CI Workflows

Five separate workflow files, one per quality gate. Each reports an individual check status for branch protection:

| Workflow | File | Check Name |
|----------|------|------------|
| Lint | `.github/workflows/lint.yml` | `Lint / lint` |
| Typecheck | `.github/workflows/typecheck.yml` | `Typecheck / typecheck` |
| Test | `.github/workflows/test.yml` | `Test / test` |
| Build | `.github/workflows/build.yml` | `Build / build` |
| E2E | `.github/workflows/e2e.yml` | `E2E / e2e` |

All five trigger on PR to main and push to main. Lint, Typecheck, Test, and Build run in parallel. E2E builds with demo defaults (no `setup-env`) then runs Playwright.

### Key Regression Test

CLI tools broke when Node.js-side code imported Astro-only modules (`#astro-utils/*`, `@sentry/astro`, Vite build-time globals). Permanently prevented by:
- `tests/architecture/utils-boundary.spec.js` — detects forbidden imports in all Node.js-side directories (`utils/`, `adapters/`, `constants/`, `config/`)
- `tests/tools/cli-integration.spec.js` — catches `astro:` protocol errors in real processes

## Utility Architecture

### Two-Layer Separation

See [AGENTS.md - The Boundary](../AGENTS.md#the-boundary) for the principle and rationale.

**`utils/`** (pure Node.js):

| File | Purpose |
|------|---------|
| `breadcrumb-utils.ts` | Breadcrumb navigation generation |
| `date-utils.ts` | YYYYMMDD parsing, formatting, validation |
| `i18n-utils.ts` | `t()` translation, `tp()` pluralization |
| `logger-core.ts` | Logger factory (SentryBridge, output filter) |
| `logger.ts` | CLI logger wrapper with @sentry/node |
| `page-metadata-utils.ts` | Page titles and descriptions (cached) |
| `text-pattern-utils.ts` | Palindrome, double/triple letter detection |
| `text-utils.ts` | `slugify()`, syllable counting |
| `url-utils.ts` | Route URL builders |
| `word-data-utils.ts` | Word filtering by year/length/letter/pos |
| `word-stats-utils.ts` | Statistics computation |
| `word-validation.ts` | Dictionary data validation |

**`src/utils/`** (Astro-specific):

| File | Purpose |
|------|---------|
| `image-utils.ts` | Social image URL generation |
| `logger.ts` | Astro Proxy logger with @sentry/astro |
| `page-metadata.ts` | Page metadata with BASE_PATH |
| `schema-utils.ts` | JSON-LD schema generation |
| `seo-utils.ts` | SEO config and meta descriptions |
| `static-file-utils.ts` | Static file generation (build-time) |
| `static-paths-utils.ts` | Dynamic static path generation |
| `url-utils.ts` | `getUrl()`, `getFullUrl()` |
| `word-data-utils.ts` | Content Collections wrapper, cached allWords |
| `word-stats-utils.ts` | Stats with Astro error handling |

### Import Boundary

| Context | Can import from | Cannot import from |
|---------|----------------|-------------------|
| `utils/`, `adapters/`, `constants/`, `config/` | `#utils/*`, `#types`, `#constants/*`, `#config/*`, `#adapters/*`, Node built-ins | `#astro-utils/*`, `astro:*`, `@sentry/astro` |
| `tools/` | Same as above + `#tools/*` | `#astro-utils/*`, `astro:*`, `@sentry/astro` |
| `src/utils/` | Everything above + `#astro-utils/*`, `astro:*`, `@sentry/astro` | — |
| `src/pages/`, `src/components/` | Everything | — |

The thin-wrapper delegation pattern avoids logic duplication. See AGENTS.md for the canonical example.

## Accessibility

- Semantic HTML with proper heading hierarchy and landmarks
- Skip-to-content link for keyboard users
- Descriptive alt text on generated images
- ARIA attributes for interactive elements
- Color contrast meeting WCAG AA
- Mobile-first responsive design

## Deployment

### GitHub Actions

The workflow files are the reference for their steps; this is what each one is for.

| Workflow | File | Runs |
|----------|------|------|
| Add Word | `.github/workflows/add-word.yml` | Manual dispatch with a word, an optional date, and overwrite and preserve-case switches |
| Deploy to GitHub Pages | `.github/workflows/deploy.yml` | Push to main, manual dispatch, and after an Add Word run on main that succeeded |

**Add Word** checks the dictionary settings before adding anything and stops with an error if `DICTIONARY_ADAPTER` is empty, if either variable spans more than one line or names an adapter other than `wordnik`, `merriam-webster` or `wiktionary` (any case), or if a named adapter's API key is missing (Wiktionary needs none). `DICTIONARY_FALLBACK` may be empty or `none` in any case for no fallback, or a comma-separated list. It then runs `npm run tool:add-word` followed by the complete `npm run tool:generate-images`, and commits and pushes to the branch it was dispatched on. It stages only what the run writes: word JSON under the words directory, PNG cards under `images/social`, and `.image-settings-hash`, in whichever layout `SOURCE_DIR` selects. A run that changes nothing ends with a notice instead of a commit. Workflow inputs reach the shell as environment variables, never as `${{ }}` expressions inside `run:`, so a word is always data and never script.

**Deploy** builds and publishes `dist/`. A push made with `GITHUB_TOKEN` starts no `push` run, so Add Word's completion is what triggers the deploy of a new word; failed or cancelled Add Word runs are skipped. For `workflow_run`, `GITHUB_SHA` is the last commit on the default branch, so the default checkout builds the commit Add Word just pushed.

**Environment.** Add Word, Deploy and Build all run the `.github/actions/setup-env` composite action, which copies repository variables and secrets into the job by name. Each runs `npm ci` before it, so no dependency's install script has the secrets in its environment. A name missing from its `VAR_NAMES` or `SECRET_NAMES` list never reaches a job, whatever the repository settings say. `VAR_NAMES` is read only from repository variables and `SECRET_NAMES` only from secrets: API keys (`*_API_KEY`), `GA_*` and `SENTRY_*` are secrets and everything else is a variable, and a name stored in the other place is exported empty. `tests/architecture/env-transport.spec.js` fails when a variable in the `astro.config.ts` env schema is neither in those lists nor set by the action itself, or when a name is in the wrong list. `SENTRY_ENVIRONMENT` is in neither list: the action always sets it to `production`. The action also sets `TZ` from the `SITE_TZ` repository variable (default `America/New_York`), so "today" is the same date when a word is added and when the site is built. Every value is written to `$GITHUB_ENV` in the multiline `NAME<<delimiter` form with a random delimiter per value, so a value that spans lines stays one variable instead of failing the step or setting others.

### Build Pipeline

1. Environment validation (required vars)
2. Content Collections load word data
3. Static page generation
4. Asset optimization (CSS, images)
5. Deploy to GitHub Pages or other static host

Social cards are not part of the build: they are generated by the image tool, committed, and served from `public/`.

### Deployment Scenarios

```sh
# Root (example.com)
SITE_URL="https://example.com" BASE_PATH="/"

# Subdirectory (example.com/vocab/)
SITE_URL="https://example.com" BASE_PATH="/vocab"

# GitHub Pages (username.github.io/repo/)
SITE_URL="https://username.github.io" BASE_PATH="/repo"
```

### Downstream Sync

This repo is the upstream template. Downstream repos (wordbug, wordbun) fork it and diverge only in word data, images, and favicons. `npm run tool:sync` (`tools/sync-upstream.sh`) brings upstream changes into a downstream repo without touching `main`: it fetches `upstream`, creates `sync/upstream-<short sha>` from `main`, and merges `upstream/main` into it with `--no-ff --no-commit`, so even a fast-forward stops before a commit exists. It then runs `npm ci` and the quality gates in order (lint, typecheck, test, then the build and E2E with `SOURCE_DIR=demo BASE_PATH=/`) and commits the merge only when every gate passes without changing a file. It never pushes: review the branch, fast-forward `main` to it, and push. `npm run tool:sync -- --skip-e2e` skips E2E when Playwright browsers are not installed.

It refuses to start below the repository root, off `main`, during a merge or rebase, or with modified, staged or untracked files, and never stashes; ignored files such as `.env` are fine. A `package-lock.json` conflict resolves to upstream's lockfile only when the merged `package.json` is upstream's. Any other conflict, or a failing gate, stops with the merge staged on the sync branch and the commands to finish or abandon it. An existing branch of the same name is refused. Merge-based (not rebase) so downstream can regular-push without force. The script no-ops in the upstream repo (no `upstream` remote). `tests/tools/sync-upstream.spec.js` runs it against real repositories in a temp dir with a fake `npm`.

### Content Security Policy

CSP is enabled via `security.csp` in `astro.config.ts`. Astro auto-hashes its bundled scripts and processed component styles. Dynamic per-site content that cannot be auto-hashed is served from same-origin endpoints:

| Endpoint | Role |
|----------|------|
| `src/pages/theme.css.ts` | Theme color custom properties (replaces inline `<style>`) |
| `src/pages/ga-init.js.ts` | GA bootstrap (replaces inline `<script>`) |

Only external script source: `https://www.googletagmanager.com` (gtag.js loader). Hardening: `object-src 'none'`, `base-uri 'self'`. `worker-src 'self' blob:` allows Sentry Session Replay's compression worker. `connect-src`/`img-src` intentionally unrestricted (GA/Sentry beacons).

**Pattern**: Dynamic inline content must become a same-origin endpoint. Neither `<style set:html>` nor `<script is:inline>` is auto-hashed. `define:vars` produces CSP-blocked inline style attributes.

Markdown syntax highlighting is disabled (`markdown.syntaxHighlight: false`): Shiki's inline styles are CSP-incompatible and the site renders no markdown.

## Constraints

- **Static only**: All pages pre-rendered; changes require rebuild
- **One word per date**: Each YYYYMMDD maps to exactly one word
- **Global uniqueness**: Each word used once across all dates
- **No future dates**: Words can only be added for today or past
- **Family-friendly**: Educational tone throughout
- **WCAG AA**: Accessibility compliance required

## Architecture History

### September 2026 - Node 26 and Native TypeScript

- Node.js 26 requirement (upgraded from 24)
- `package.json` `imports` is the only alias table: `compilerOptions.paths` removed from `tsconfig.json`; TypeScript alias targets end in `.ts` so Node's resolver (no extension guessing) loads them unaided
- CLI tools run as `node tools/<tool>.ts` (type stripping); `tsx` removed. `tool:local` loads `.env` with `--env-file-if-exists`
- `astro.config.ts` loads `.env` with `process.loadEnvFile()`; `dotenv` removed
- `erasableSyntaxOnly` enabled so the compiler rejects syntax Node's type stripping cannot run

### June 2026 - CSP and Progressive Enhancement

- Native CSS view transitions: `<ClientRouter />` removed; `@view-transition { navigation: auto }` added to `src/styles/global.css` with `prefers-reduced-motion` guard. Ships zero JS; cross-fades same-origin navigations (Chromium/Safari; Firefox partial); plain navigation elsewhere. Reason: Astro dropped CSP support for `ClientRouter`.
- CSP enabled via `security.csp` in `astro.config.ts`; dynamic inline content migrated to same-origin endpoints (`src/pages/theme.css.ts`, `src/pages/ga-init.js.ts`).
- Removed: `src/utils/build-utils.ts` and `types/window.d.ts` (with `window.app` debug global).

### February 2026 - Environment and Theming

- `astro:env` migration: 21 Vite `define` globals replaced with Astro's type-safe env schema (`envField` in `astro.config.ts`, accessed via `astro:env/client`). Four computed build-time constants remain as Vite defines.
- Environment-driven dark mode: opt-in via `COLOR_DARK_*` env vars, conditional `prefers-color-scheme` media query emitted only when configured.
- SEO fixes: semantic `<nav>` in header, `itemCount` in CollectionPage structured data, redundant hreflang removal.

### February 2026 - Codebase Audit

- Import alias migration: `~` (Vite resolve.alias) to `#` (Node.js subpath imports)
- Config conversion: `.mjs` to `.ts` (`astro.config.ts`, `vitest.config.ts`)
- TypeScript strictness: `strictNullChecks`, `noUncheckedIndexedAccess`
- DRY consolidation: stats function duplication eliminated
- ES6+ modernization: `Object.groupBy()`, `Array.findLast()`, `util.parseArgs()`
- Node.js 24 requirement (upgraded from 22)
- Logger DRY: shared factory (`logger-core.ts`) with env-specific Sentry bridges
- Boundary enforcement expanded: architecture tests now cover `adapters/`, `constants/`, `config/` (not just `utils/`)

### January 2025 - Tool Consolidation

- Unified image generation: merged separate tools into `generate-images.ts`
- Shared help system: `tools/help-utils.ts`

### Content Collections Migration

- Astro 5 Content Layer API
- Build-time path injection via `__WORD_DATA_PATH__`
