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
  word-data-utils.ts             # Displayability rule, word filtering (by year, length, letter, etc.)
  word-stats-utils.ts            # Statistics calculation algorithms
  word-validation.ts             # Shape guards for stored word files and the words.json index

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
  parts-of-speech.ts             # Part-of-speech vocabulary (grammatical categories plus abbreviation)
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
  helpers/log-levels.js          # Preload that marks a spawned tool's warn and error lines
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
  workflows/                     # CI: lint, typecheck, test, build, e2e
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
| `DICTIONARY_FALLBACK` | `wiktionary` | Fallback chain, comma-separated (e.g. `wordnik,wiktionary`); empty means the default, `none` (any case) disables it |
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
- The dictionary's answer must contain at least one displayable definition (see below); otherwise the fallback chain moves on, and an exhausted chain fails the add
- Strict YYYYMMDD format

### Displayable Definitions

`getDisplayableDefinitions()` in `utils/word-data-utils.ts` is the one rule for which of a word's definitions count. A definition is displayable when it has a part of speech and non-empty text. Abbreviation-labelled definitions are displayable only when the word has no displayable grammatical definition: a lookup of "sad" also returns SAD, "seasonal affective disorder", which must not become a sense of the adjective, while "pb&j" has nothing but its abbreviation, so that is what its page shows.

Everything that shows, counts, groups or accepts definitions goes through it: the word page senses (`getWordSenses`), the primary definition used for meta descriptions, RSS and JSON-LD (`findValidDefinition`), the part-of-speech browse pages (`getAvailablePartsOfSpeech`, `getWordsByPartOfSpeech`, `groupWordsByPartOfSpeech`), and add-time acceptance (`isValidDictionaryData`, checked by `fetchWithFallback` on every adapter's answer, so the tools only ever receive usable definitions). A record with text but no part of speech is refused at add time because no page could display it.

## CLI Tools

All tools are pure Node.js (no Astro deps) and use `util.parseArgs()` for argument parsing.

Tools run directly on Node's built-in TypeScript support (`node tools/<tool>.ts`); there is no loader or compile step. `npm run tool:local <tool>` runs a tool through `node --env-file-if-exists=.env`, so `.env` is loaded when present and variables already in the environment win. When `.env` is absent Node prints `.env not found. Continuing without it.` to stderr and carries on. The bare `tool:*` scripts (`tool:generate-images`, `tool:regenerate-all-words`, ...) do not load `.env`: image tools render without the site title and the Merriam-Webster adapter throws without its key.

npm keeps any flag written before a bare `--` for itself, so a tool's flags always follow one: `npm run tool:local tools/add-word.ts -- --help` and `npm run tool:add-word -- --help` print the tool's help, and without the separator npm prints its own. `tests/architecture/npm-scripts.spec.js` enforces this in `package.json`, tool help text, docs and workflows.

### `add-word.ts`

Adds a word with dictionary validation and duplicate detection. It does not render the social card: the Add Word workflow runs the complete image generation afterwards (see Image Generation).

```sh
npm run tool:local tools/add-word.ts serendipity
npm run tool:local tools/add-word.ts ephemeral 20250130
npm run tool:local tools/add-word.ts -- Japan --preserve-case
npm run tool:local tools/add-word.ts -- serendipity --overwrite
```

Failures are classified by error type, never by message text. Adapters throw `WordNotFoundError` (from `utils/adapter-utils.ts`) for a 404, an empty answer, a Merriam-Webster suggestion list or an entry only in another Merriam-Webster dictionary, and `RateLimitError` for a 429. A 200 whose body is not an array at all is an unexpected shape, not a missing word: the API changed. add-word reports "Word not found in dictionary" only when every adapter in the chain threw `WordNotFoundError` (`isWordNotFound`); a rate limit, outage or unexpected shape anywhere in the chain is reported as a failure to add. regenerate-all-words backs off when any adapter threw `RateLimitError` (`isRateLimited`).

### `generate-images.ts`

Consolidated image generation (SVG templates, Sharp PNG conversion, 1200x630px OpenGraph).

```sh
npm run tool:local tools/generate-images.ts                         # All images
npm run tool:local tools/generate-images.ts -- --word japan         # Single word
npm run tool:local tools/generate-images.ts -- --words              # All word images
npm run tool:local tools/generate-images.ts -- --generic            # Generic page images
npm run tool:local tools/generate-images.ts -- --page /stats        # Specific page
npm run tool:local tools/generate-images.ts -- --force              # Regenerate existing
```

A bulk run reads the corpus once. A word file that cannot be read, or is not valid word data, is logged and counted as a failure: its card and the pages it feeds would be missing, so the run exits 1 and does not certify the image cache. `--word` and `--page` log such a file and carry on.

### `regenerate-all-words.ts`

Batch refresh of word data from the dictionary API. Supports dry-run mode and rate limiting. A word file it cannot read (not JSON, or no `word` string) counts as a failure, in a dry run too, so the exit code says whether every stored word was covered. `--force` re-sources every word through the configured adapter chain (the `adapter` field follows); pronunciation audio and etymology come only from Merriam-Webster, so run it via `tool:local` with `MERRIAM_WEBSTER_API_KEY` in `.env` to backfill them.

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

**Error level means fault**: only `logger.error` creates a Sentry event (`captureException` for an `Error`, otherwise `captureMessage` at level `error`); `warn`, `info` and `debug` only print. So CLI tools refuse operator input at `warn`: add-word's blank word, malformed or future date, date or word already taken, and a word every adapter in the chain reported as not found; generate-images' `--word` that is not in the data and `--page` that is not a page; and regenerate-all-words' malformed `--timeout`, `--batch-size` or `--batch-timeout` all exit 1 with a warn-level message. Network failures, HTTP errors, unexpected response shapes, rate limits, unreadable word files and missing configuration log at `error`. A missing or empty words directory is not a fault to add-word's duplicate check, since a new site's first word has nothing to collide with, but the bulk runs of generate-images and regenerate-all-words, which need data, fail on it at `error`.

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
- **Settings**: `createSvg` draws the card text and `SITE_TITLE` on one line each, so any run of whitespace, line breaks included, becomes one space and the ends are trimmed. The gradient takes `COLOR_PRIMARY`, `COLOR_PRIMARY_LIGHT` and `COLOR_PRIMARY_DARK` as CSS hex colors (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`; surrounding whitespace ignored, empty means the default). Any other value, a named color included, stops the run before any image is written with an error naming the variable, since librsvg draws a malformed stop as black. The site's own stylesheet does not validate these.
- **Output**: `public/{SOURCE_DIR}/images/social/2024/20240105-giggle.png` (word, lowercased, spaces and punctuation kept) and `public/{SOURCE_DIR}/images/social/pages/browse-2023-april.png` (page path flattened into one slug); the homepage and word pages use the word's card. The `SOURCE_DIR` segment is omitted when unset.
- **One contract**: `utils/image-path-utils.ts` owns these paths. The generator writes them and `src/utils/image-utils.ts` links to them, so they cannot drift; the existing file names are the contract, since renaming a rule orphans every committed card upstream and downstream. The site emits absolute `og:image`/`twitter:image` URLs through `getFullUrl`, with each path segment passed through `encodeURI` plus `?` and `#`, so spaces become `%20` while `&` stays literal (`astro preview` decodes with `decodeURI`, which leaves `%26` undecoded; GitHub Pages serves both forms). `tests/architecture/social-images.spec.js` checks the demo dataset and its cards under `public/demo/`, never a fork's own words: Vitest pins `SOURCE_DIR=demo`, so a fork running the suite checks the demo words and cards it merges from upstream. It fails if any emitted URL names an untracked card or any tracked card is unreferenced. Both sides of that check read the page list from `getAllPageMetadata`, so it cannot see a listed page that has no route; `tests/architecture/page-routes.spec.js` resolves every metadata path against the files under `src/pages` (`index.astro` serves its directory, a `[param]` file or directory matches any segment that no literal file or directory at that level claims, `.ts` endpoints are not pages) and fails on any path with no page.
- **Skip guard**: `.image-settings-hash` (in the `social/` directory) is JSON with two parts. `settings` is an md5 fingerprint of what determines every image's bytes, inputs and renderer alike: three probe SVGs rendered through the real template (colors, site title, dimensions, layout, and, from a 45-letter probe wider than the card, the scaling that fits a long word), the PNG options, both font files, and `sharp.versions` (sharp, libvips and the libraries bundled with it), so a sharp upgrade that re-quantizes the palette invalidates the cache on its own. `cards` maps each card's path (relative to the images directory) to a short hash of its own inputs, the exact text and date passed to `createSvg`, because a card's text can change while its path does not: page titles such as the most and least common letter come from the corpus, and a word card's file name lowercases the word while the card shows it as stored. Each run reads the marker once. A card is rendered when the settings differ, its entry is missing or differs, or its file is missing; otherwise it is skipped. `--force` renders every card. A marker that is missing, not JSON, or the bare fingerprint older runs wrote leaves the settings unknown, so the next run renders every card once. The marker is written (cards sorted by path, so its diff shows only real changes) only by a run that covered all words and all pages with no failures, whether that was the default run or `--words --generic` together, so `--word`, `--page`, and `--words` or `--generic` alone never certify the corpus. That run records every card it saw, so entries for cards that no longer exist drop out. `npm run build` copies `public/` verbatim and never regenerates images.
- **CI**: the Add Word workflow runs the complete generation (`npm run tool:generate-images`) after adding a word, not `--word`. With a current marker that renders the new word's card and any page card whose title the new word changed, and skips the rest; after a settings, font or sharp change it regenerates every card once and commits them with the refreshed marker (`git add data/ public/` picks up both). A single-image run could never write the marker, so the skip guard would stay stale in CI forever.

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

The browser side has the mirror-image rule. Bundled `<script>` blocks import a few modules from `utils/` and `src/utils/`, and Vite ships whatever those import as values, so one re-export can put dictionary code in every page's JavaScript. `tests/architecture/client-imports.spec.js` follows the value imports those scripts reach through `utils/`, `types/`, `constants/` and `src/utils/`, and fails on any edge (`module -> specifier`) missing from its explicit list of today's edges, so a new import fails even between modules already listed; a listed edge that is no longer reached must be removed. `import type` is always allowed.

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
| `word-data-utils.ts` | Displayability rule, add-time acceptance, word filtering by year/length/letter/pos |
| `word-stats-utils.ts` | Statistics computation |
| `word-validation.ts` | Shape guards for stored word files and the `words.json` index |

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

```yaml
- name: Add word
  run: npm run tool:add-word ${{ github.event.inputs.word }}
  env:
    WORDNIK_API_KEY: ${{ secrets.WORDNIK_API_KEY }}
    SOURCE_DIR: ${{ vars.SOURCE_DIR }}
```

### Build Pipeline

1. Environment validation (required vars)
2. Content Collections load word data
3. Static page generation
4. Social image generation
5. Asset optimization (CSS, images)
6. Deploy to GitHub Pages or other static host

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

This repo is the upstream template. Downstream repos (wordbug, wordbun) fork it and diverge only in word data, images, and favicons. `npm run tool:sync` merges upstream changes into a downstream repo via `git fetch upstream --no-tags && git merge upstream/main`. Merge-based (not rebase) so downstream can regular-push without force. Lockfile conflicts auto-resolve by accepting upstream's version and running `npm install`. The script no-ops in the upstream repo (no `upstream` remote).

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
