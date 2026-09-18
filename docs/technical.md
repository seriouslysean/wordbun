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
  create-site.ts                 # Scaffold a site repository for the reusable workflows
  generate-images.ts             # Social image generation (consolidated)
  help-utils.ts                  # Shared help system
  regenerate-all-words.ts        # Batch word data refresh
  sync-upstream.sh               # Merge upstream into a fork, gated (tool:sync)
  templates/site/                # Callers, Dependabot, README and .gitignore that create-site writes
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
    site-deploy.yml              # Reusable build and deploy that Deploy and each site repository call
    site-add-word.yml            # Reusable Add Word that Add Word and each site repository call
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

### `create-site.ts`

Writes a new site repository that holds only its content and calls Site Deploy and Site Add Word at one pinned engine release (Site Repositories, under Deployment).

```sh
npm run tool:create-site -- ../wordbee --engine-ref v3.23.0 --seed-file ~/20260918.json
```

The target must not exist or must be empty. `--engine-ref` must be a release tag (`vX.Y.Z`) or a full commit SHA, not a branch or a major tag like `v3`, which moves and would change the engine a site runs without a change in the site; only its form is checked. `--seed-file` is the site's first word, in the format `data/words` holds, and must pass `parseWordData` (`utils/word-validation.ts`), the check the tools read word files with, and carry a real `YYYYMMDD` date. Everything is checked before anything is written. It writes the two caller workflows from `tools/templates/site/`, both pinned to the ref, `.github/dependabot.yml`, `README.md` with the repository settings to make, `.gitignore`, a copy of this repository's `.env.example` and `public/favicon.svg`, and the seed, byte for byte, at `data/words/YYYY/YYYYMMDD.json`. It runs no Git, install or network command; creating the repository and pushing are the owner's.

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
| Site Deploy | `.github/workflows/site-deploy.yml` | Called by Deploy here, in a fork, and in each site repository |
| Site Add Word | `.github/workflows/site-add-word.yml` | Called by Add Word here, in a fork, and in each site repository |

**Add Word** calls **Site Add Word**, the workflow every site repository's Add Word calls, with the same four inputs, and keeps `contents: write` and the `add-word` concurrency group, so two runs never write at once.

**Site Add Word** checks out the engine and installs, then checks out the tip of the dispatched branch into `site/`, so a run that waited behind another starts from the commit that run pushed, and keeps that checkout's credentials for the push. It runs `setup-env` and overlays the site content exactly as Site Deploy does. It checks the dictionary settings before adding anything and stops with an error if `DICTIONARY_ADAPTER` is empty, if either variable spans more than one line or names an adapter other than `wordnik`, `merriam-webster` or `wiktionary` (any case), or if a named adapter's API key is missing (Wiktionary needs none). `DICTIONARY_FALLBACK` may be empty or `none` in any case for no fallback, or a comma-separated list. It then runs `npm run tool:add-word` followed by the complete `npm run tool:generate-images` in `engine/`, copies back into `site/` only word JSON under the words directory, PNG cards under `images/social` and `.image-settings-hash`, in whichever layout `SOURCE_DIR` selects, and stages only those. The copy compares content and never deletes. It commits as the repository owner with the message `Add word: <word>` and pushes to the branch it was dispatched on; a push that is not a fast-forward fails the run, and nothing is ever forced. A run that changes nothing ends with a notice instead of a commit. Workflow inputs reach the shell as environment variables, never as `${{ }}` expressions inside `run:`, so a word is always data and never script.

**Deploy** calls **Site Deploy**, the workflow every site repository calls, so the demo site builds exactly as a site does. Deploy keeps the triggers, the permissions, the `pages` concurrency group and the gate that skips failed or cancelled Add Word runs. A push made with `GITHUB_TOKEN` starts no `push` run, so Add Word's completion is what triggers the deploy of a new word. For `workflow_run`, `GITHUB_SHA` is the last commit on the default branch, so the site checkout builds the commit Add Word just pushed.

**Site Deploy** checks out the calling repository into `site/` and the engine into `engine/` (Engine ref, below), runs `npm ci` and then `setup-env` in `engine/`, and mirrors `site/data/` and `site/public/` over the engine's with `rsync --delete`, keeping the engine's `favicon.svg` when the site has none. Every copy compares content (`--checksum`), since two checkouts made in the same second can hold a same-size file that rsync's size and time check would skip. It then runs the complete `npm run tool:generate-images`, so an engine or theme change never deploys stale cards (current cards are skipped and nothing is committed), builds in `engine/`, whose own `.git` gives the build its release fingerprint, and uploads `engine/dist`. A separate deploy job holds `pages: write`, `id-token: write` and the `github-pages` environment, which a job that calls a reusable workflow cannot declare. Before copying anything it stops when `SOURCE_DIR` is not `demo` in this repository or not empty in any other, rather than publish the other site's content, when the site has no words directory or `public/`, which mirroring would otherwise empty, and when anything under the site's `data/` or `public/` is a symbolic link, which `rsync -a` copies as a link, so the tools would write through it and the build read through it outside `engine/`.

**Engine ref.** Site Deploy and Site Add Word check the engine out at `job.workflow_repository` and `job.workflow_sha`, the repository and commit of the workflow file that defines the running job ([job context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#job-context)), so the code is always the commit the caller's `uses:` pin runs, and a caller passes nothing that names the engine. actionlint 1.7.12 does not know the `job.workflow_*` properties, so `.github/actionlint.yaml` ignores its undefined-property error for exactly those four in these two workflows until it does. A `./` call runs the called workflow from the caller's own commit, so the engine checkout is the calling repository at that commit. This repository calls that way for the demo site. So does a fork of it that syncs with `npm run tool:sync`: its Deploy and Add Word are this repository's, so after a sync they call the reusable workflows with `./`, check out the fork's own commit as the engine, and keep building and adding words as before, unchanged, until the fork is migrated to a thin site. For a fork `site/` and `engine/` are the same commit, so the overlay copies and deletes nothing: the fork's `data/demo` and `public/demo`, which it tracks from this repository, stay where they are, `SOURCE_DIR` empty builds its own `data/words`, and `public/demo` is published with the rest of `public/` as it is today. The `SOURCE_DIR` check tells this repository from the rest by the name in `ENGINE_REPOSITORY`, not by `job.workflow_repository`, which a fork's `./` call makes the fork itself.

**Environment.** Build, Site Deploy and Site Add Word all run the `.github/actions/setup-env` composite action, which copies repository variables and secrets into the job by name. Each runs `npm ci` before it, so no dependency's install script has the secrets in its environment, and Site Add Word checks out the site only after `npm ci` too, so no install script can read the credentials that checkout keeps, which can push to the site. In Site Deploy and Site Add Word, `vars` is the calling repository's, and its secrets arrive as the one secret `site-secrets`, which the caller sets to `toJSON(secrets)` and the action reads as `secrets-json`, as it reads a single repository's. Site Deploy's build job has no environment, so a value stored only on the `github-pages` environment does not reach the build. A name missing from its `VAR_NAMES` or `SECRET_NAMES` list never reaches a job, whatever the repository settings say. `VAR_NAMES` is read only from repository variables and `SECRET_NAMES` only from secrets: API keys (`*_API_KEY`), `GA_*` and `SENTRY_*` are secrets and everything else is a variable, and a name stored in the other place is exported empty. `tests/architecture/env-transport.spec.js` fails when a variable in the `astro.config.ts` env schema is neither in those lists nor set by the action itself, or when a name is in the wrong list. `SENTRY_ENVIRONMENT` is in neither list: the action always sets it to `production`. The action also sets `TZ` from the `SITE_TZ` repository variable (default `America/New_York`), so "today" is the same date when a word is added and when the site is built. Every value is written to `$GITHUB_ENV` in the multiline `NAME<<delimiter` form with a random delimiter per value, so a value that spans lines stays one variable instead of failing the step or setting others. Before it writes a secret, the action masks each non-blank line of its value with `::add-mask::`: inside a called workflow the job's only secret is the `site-secrets` envelope, and GitHub does not mask a value taken out of it, so a tool that logs a request URL with an API key in it would show the key. Short values are masked too, so with `GA_ENABLED` set to `true` every `true` in the rest of the job's log reads `***`. Variables are never masked.

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

### Site Repositories

A site repository holds only its content and two workflows that call Site Deploy and Site Add Word in this repository at one pinned release; the code, its dependencies and the fonts come from the engine checkout. `npm run tool:create-site` (CLI Tools) writes a new one.

| What | Where | Rule |
|------|-------|------|
| Words | `data/words/YYYY/YYYYMMDD.json` | Mirrored over the engine's `data/` with `rsync --delete`, so no demo word is built |
| Public files | `public/**` | Mirrored over the engine's `public/`; the engine's `favicon.svg` stays when the site has none |
| Cards and marker | `public/images/social/` (`YYYY/*.png`, `pages/*.png`, `.image-settings-hash`) | Generated in `engine/`. Add Word copies back and commits only these and the word JSON, never deleting; Deploy regenerates them and commits nothing |
| Callers | `.github/workflows/deploy.yml`, `.github/workflows/add-word.yml` | Both pin the same release in `uses:`, and nothing else names the engine |
| Engine updates | `.github/dependabot.yml` | `github-actions` updates, grouped so both pins move in one pull request |
| Settings | Repository variables and secrets | `vars` is the site's; the secrets go as `site-secrets`; `SOURCE_DIR` unset or empty |
| Local settings | `.env.example`, ignored `.env` | For local development only; the workflows never read them |
| Not in a site | `src/`, `tools/`, `package.json`, the lockfile, `node_modules/`, `dist/` | The engine's, at the pin |

`.github/workflows/deploy.yml`, with `vX.Y.Z` the release to run:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ['main']
  workflow_run:
    workflows: ['Add Word']
    branches: ['main']
    types:
      - completed
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    if: github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'
    uses: seriouslysean/occasional-wotd/.github/workflows/site-deploy.yml@vX.Y.Z
    secrets:
      site-secrets: ${{ toJSON(secrets) }}
```

`.github/workflows/add-word.yml`, pinned to the same release:

```yaml
name: Add Word

on:
  workflow_dispatch:
    inputs:
      word:
        description: 'The word to add'
        required: true
        type: string
      date:
        description: 'Date to add the word to (YYYYMMDD). Leave empty for today.'
        required: false
        type: string
      overwrite:
        description: 'Overwrite existing word if one exists for the date'
        required: false
        type: boolean
        default: false
      preserve_case:
        description: 'Keep original capitalization'
        required: false
        type: boolean
        default: false

permissions:
  contents: write

concurrency:
  group: add-word
  cancel-in-progress: false

jobs:
  add-word:
    uses: seriouslysean/occasional-wotd/.github/workflows/site-add-word.yml@vX.Y.Z
    with:
      word: ${{ inputs.word }}
      date: ${{ inputs.date }}
      overwrite: ${{ inputs.overwrite }}
      preserve_case: ${{ inputs.preserve_case }}
    secrets:
      site-secrets: ${{ toJSON(secrets) }}
```

The secrets go by name because `secrets: inherit` is only for callers in the same organization or enterprise, and site repositories live under a personal account. What the site repository needs in its settings, which the README `create-site` writes lists too:

- Repository variables: `SITE_URL`, `SITE_TITLE`, `SITE_DESCRIPTION`, `SITE_ID` and `DICTIONARY_ADAPTER`, plus `BASE_PATH`, `SITE_TZ` or any other setting under Environment Configuration that differs from its default. `SOURCE_DIR` unset or empty; this repository keeps `SOURCE_DIR=demo`.
- Repository secrets: the API key of each configured dictionary, and any `GA_*` and `SENTRY_*` values.
- Pages built from GitHub Actions, with the `github-pages` environment allowing deployments from `main`.
- Actions allowed to use reusable workflows from `seriouslysean/occasional-wotd`. A public repository can only call reusable workflows in public repositories, so this repository stays public.
- Branch protection and rulesets on `main` that let Add Word's push with the workflow's `GITHUB_TOKEN` through, since it commits straight to the branch it was dispatched on.

To move a site to a new release, change both pins together; never move a published release tag. The engine at the pin runs with the site's secrets and a token that can write to the site, so pin only engine releases you trust. The first runs in a site repository are the acceptance test for the cross-repository setup: an Add Word run that commits the word and its cards to `main`, followed by the Deploy it triggers publishing the site at its URL.

**Local development.** Clone this repository into a sibling directory used for nothing else, check out the release the site pins, and run `npm ci` there once. Then, from the site repository:

```sh
(
  site_dir="$PWD"
  cd ../site-engine
  rsync -a --checksum --delete "$site_dir/data/" data/
  rsync -a --checksum --delete --filter='P /favicon.svg' "$site_dir/public/" public/
  SOURCE_DIR= node --env-file-if-exists="$site_dir/.env" node_modules/astro/bin/astro.mjs dev
)
```

It copies the content over the engine checkout as the workflows do and runs Astro's dev server there with the site's `.env`. `SOURCE_DIR=` wins over any value in `.env`, because Node never lets an env file override a variable already set. Rerun it after changing content. The copy deletes the checkout's demo content, which is why the checkout must not be one you work in.

**Forks.** wordbug and wordbun are forks of this repository, not site repositories, and keep working unchanged until they are migrated: `npm run tool:sync` brings in this repository's Deploy and Add Word, which call the reusable workflows with `./` at the fork's own commit (Engine ref, under GitHub Actions).

**Migrating a fork.** The owner migrates one fork at a time, wordbun first:

1. Release this repository with the reusable workflows and check that the demo's Deploy and Add Word succeed through them.
2. Prove the setup in a disposable public repository made with `npm run tool:create-site`: variables and secrets reach the build, Pages deploys, Add Word pushes with the site's `GITHUB_TOKEN`, the Deploy it triggers publishes the word, and Dependabot's first engine update moves both pins.
3. Bring the fork up to the release with `npm run tool:sync` and merge that to `main`, so it already builds through the reusable workflows. Then freeze it: no Add Word runs until the move is done. Record its `HEAD`, word and card counts, Pages settings (source and custom domain), rulesets, variable names and values, and secret names.
4. Tag the current head `pre-thin-site` and make the migration an ordinary commit on a branch of the same repository. No new repository, orphan branch, history rewrite or force push, so history, settings, secrets and the domain stay where they are.
5. In that commit keep `data/words/`, everything under `public/` except `public/demo/`, and any file the fork added itself. Replace `.github/workflows/deploy.yml` and `add-word.yml` with the callers above pinned to the release, add `.github/dependabot.yml`, `README.md` and `.gitignore` from `tools/templates/site/`, and delete the rest, including `data/demo/`, `public/demo/`, `.github/actions/` and the other workflows. Compare each deleted file with this repository's first, and keep any that is not the engine's.
6. Check parity (below), with no unexplained difference.
7. Merge to `main`. The Deploy that runs must publish the same site at the same URL and custom domain.
8. Run Add Word once with a real word: its commit holds only the word file, cards and marker, and the Deploy after it publishes the word.
9. Stop running `npm run tool:sync` in the migrated repository, then repeat for the next fork.

Parity compares two builds from the same engine commit, content and settings: `pre-thin-site` built in place with `npm run build`, and the migration branch built through the local development command above with `build` for `dev`.

| Check | Passes when |
|-------|-------------|
| Content | `git diff --stat pre-thin-site HEAD -- data/words public/images public/favicon.svg` is empty: words, cards and marker move byte for byte |
| Routes | The sorted file lists of the two `dist/` directories match, apart from the fork's `demo/` files, and neither has a demo word page |
| Feeds | `rss.xml` items, `words.json` and the sitemap URL sets match |
| SEO | Canonical and `og:image` URLs match, and every `og:image` path, URL-decoded, is a file in `dist/` (card names are lower case and can hold spaces and `&`) |
| Cards | Cards and `.image-settings-hash` regenerated with the same engine commit and settings match byte for byte |
| Branding | Favicon, theme colors, title, `robots.txt`, `manifest.json`, `humans.txt` and any custom public file match |
| Allowed | Build and sitemap timestamps differ; the release fingerprint must match, since it hashes the engine's `src/` |

**Rollback.** `git revert` the migration commit on `main` and push it, which runs Deploy. The revert restores the engine files and the fork's workflows and keeps any word Add Word committed since, because both layouts keep words and cards at the same root paths. `pre-thin-site` marks the old head for reference; do not reset to it, which would drop those words.

### Downstream Sync

This repo is the upstream template. Downstream repos (wordbug, wordbun) fork it and diverge only in word data, images, and favicons. `npm run tool:sync` (`tools/sync-upstream.sh`) brings upstream changes into a downstream repo without touching `main`: it fetches `upstream`, creates `sync/upstream-<short sha>` from `main`, and merges `upstream/main` into it with `--no-ff --no-commit`, so even a fast-forward stops before a commit exists. It then runs `npm ci` and the quality gates in order (lint, typecheck, test, then the build and E2E with `SOURCE_DIR=demo BASE_PATH=/`) and commits the merge only when every gate passes without changing a file. It never pushes: review the branch, fast-forward `main` to it, and push. `npm run tool:sync -- --skip-e2e` skips E2E when Playwright browsers are not installed.

It refuses to start below the repository root, off `main`, during a merge or rebase, or with modified, staged or untracked files, and never stashes; ignored files such as `.env` are fine. A `package-lock.json` conflict resolves to upstream's lockfile only when the merged `package.json` is upstream's. Any other conflict, or a failing gate, stops with the merge staged on the sync branch and the commands to finish or abandon it. An existing branch of the same name is refused. Merge-based (not rebase) so downstream can regular-push without force. The script no-ops in the upstream repo (no `upstream` remote), and a site repository that calls the reusable workflows has nothing to merge: it moves its pins instead. A fork keeps working after a sync that brings in Site Deploy and Site Add Word, because its Deploy and Add Word call them with `./` at its own commit (Engine ref, above). `tests/tools/sync-upstream.spec.js` runs it against real repositories in a temp dir with a fake `npm`.

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
