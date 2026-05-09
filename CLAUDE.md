# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **Chrome/Edge browser extension (Manifest V3)** that analyzes web images and generates reverse prompts using AI vision APIs. Pure static extension — **no build step or test framework**. `package.json` exists solely for the Node.js scripts (icon generation, data extraction) and is not needed at runtime.

Key capabilities:
- Hover overlay on any web image triggers AI-powered reverse prompt generation
- Works out of the box — default vision API key stored server-side via Supabase Edge Function (no client-side key exposure)
- User-configurable AI providers: OpenAI-compatible or Anthropic (Claude)
- Supabase pgvector-backed semantic search for similar reference prompts
- RAG-enhanced generation: initial analysis + vector search + enhanced second pass
- Analysis history stored locally (max 50 items)

## Development Workflow

No build step. Edit files directly and reload:

1. Open `chrome://extensions` → enable **Developer mode**
2. Click **Load unpacked** → select the `rev_prompt/` folder
3. After editing, click the **refresh icon** on the extension card
4. Debug background worker via "Inspect views: service worker" link on the extension card
5. Content script console shows in the page's dev tools

## Architecture

### Runtime Components

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest: declares `sidePanel`, `storage`, `activeTab` permissions and `<all_urls>` host access |
| `src/background.js` | Service worker — message router. Loads libs via `importScripts(lib/utils.js, lib/supabase-client.js, lib/api-client.js)`. Handles `analyzeImage`, `openSidebar`, `saveApiConfig`, `getApiConfig`, `getHistory`, `clearHistory`. Routes to Edge Function proxy (default) or direct API (user-configured) |
| `src/content-script.js` | Injected into all pages. Uses `MutationObserver` to track `<img>` elements, shows glass floating "破解prompt" button on hover (skips images <50px), sends `analyzeImage` to background |
| `src/sidebar/sidebar.html/js/css` | Side panel UI — settings, result display (JSON/natural language toggle), similar prompts, history |
| `src/lib/supabase-client.js` | RAG pipeline orchestrator + Supabase config. Defines `SUPABASE_URL`, `SUPABASE_KEY`. Embedding API calls, `searchSimilarPrompts()` RPC, `analyzeAndRetrieve()` (parallel image+text vector search → dedup → conditional RAG-enhanced generation) |
| `src/lib/api-client.js` | AI client: direct API adapters (OpenAI/Anthropic), Edge Function proxy (`analyzeImageViaProxy`), system prompts (`SYSTEM_PROMPT`, `ENHANCED_SYSTEM_PROMPT`), `parseApiResponse()` |
| `src/lib/utils.js` | `fetchImageAsBase64()` (fetch → canvas fallback), `copyToClipboard()`, `formatJson()`, `truncateString()` |
| `supabase/functions/vision-proxy/index.ts` | Edge Function: holds default vision API key as server-side secret, proxies requests to mimo vision API. Deployed to Supabase |

### Message Flow

```
content-script.js: mouseenter on <img> → glass floating "破解prompt" button
  click → { action: "openSidebar" } + { action: "analyzeImage", imageUrl }
    → background.js: fetches image → base64 via utils.fetchImageAsBase64()
    → background.js: check if user has saved apiConfig
        usingDefault? → config = DEFAULT_CONFIG, usingDefault = true
        user config?  → config = userConfig, usingDefault = false
    → supabase-client.js: analyzeAndRetrieve(base64, config, usingDefault)
        1. parallel:
           - AI analysis: usingDefault → analyzeImageViaProxy() [Edge Function]
                          user config  → analyzeImageWithAI() [direct API]
           - searchSimilarPrompts(imageEmbedding)
        2. searchSimilarPrompts(textQuery from analysis), merge+dedup
        3. if matches: RAG-enhanced second pass (same proxy/direct routing)
    → saves to chrome.storage.local { analysisHistory }
    → { action: "analysisComplete", result, similarPrompts } → sidebar renders
```

### State Management

All persistent state lives in `chrome.storage.local`:
- **`apiConfig`**: `{ protocol, baseUrl, apiKey, model }` — user-configured AI provider. When absent or apiKey is empty, `DEFAULT_CONFIG` is used and requests go through the Edge Function proxy
- **`analysisHistory`**: array of `{ id, imageUrl, timestamp, analysis, similarPrompts }` (max 50, FIFO)

The background worker maintains an in-memory `analysisHistory` mirror synced on startup.

### Default API / Edge Function Proxy

The default vision API key is stored as a Supabase secret (`VISION_API_KEY`), never in client code. The Edge Function at `supabase/functions/vision-proxy/` proxies requests to the default vision model. Users who configure their own API key bypass the proxy and call the API directly.

### Supabase / Vector Search Pipeline

1. `scripts/extract-prompts.mjs` — parses CSV/Markdown reference data from `refer/` into `data/prompts.json` and `data/prompts-for-supabase.json`
2. `scripts/supabase-migration.sql` — creates the `prompts` table with `vector(2048)` column (doubao-embedding-vision-251215) and `search_prompts()` RPC function
3. `scripts/import-supabase.mjs` — batch imports prompt data with embeddings into Supabase (needs `SUPABASE_KEY` secret)
4. At runtime, `supabase-client.js` orchestrates the full RAG pipeline (`analyzeAndRetrieve`):
   - **Step 1 (parallel)**: AI vision analysis via user's configured model + image-based vector search (multimodal embedding on the image itself, top 5 matches, threshold 0.3)
   - **Step 2**: Text-based vector search using the initial analysis result (top 5, threshold 0.3), merged and deduplicated with image search results
   - **Step 3 (conditional)**: If similar prompts exist, a RAG-enhanced second AI call (`generateEnhancedPrompt`) re-analyzes the image with reference prompts as context. Falls back to initial analysis on failure.

### Important Implementation Details

- **CORS**: `fetchImageAsBase64()` tries direct `fetch()` first, falls back to canvas (`crossOrigin='anonymous'`). Both can fail on strict CORS sites.
- **srcset priority**: Content script selects the highest-resolution URL from `srcset` when available, rather than `src`.
- **System prompts**: Two in `api-client.js` — `SYSTEM_PROMPT` (initial analysis) and `ENHANCED_SYSTEM_PROMPT` (RAG-enhanced second pass). Both instruct the AI to return `{ scene, tags, structured_prompt, natural_language_prompt }` with the `structured_prompt` fields varying by image type (portrait/product/poster/landscape/illustration). Chinese system prompts, English `natural_language_prompt` output.

### Scripts (Node.js, run manually)

```bash
# Extract prompts from refer/ CSV and Markdown into data/
node scripts/extract-prompts.mjs

# Import prompts with embeddings into Supabase
node scripts/import-supabase.mjs

# Regenerate extension icons (requires: npm install first)
node scripts/generate-icons.mjs
```

### Refer / Data Directories

- `refer/` — Source CSV and Markdown prompt datasets (not loaded at runtime)
- `data/` — Generated JSON files from extraction scripts
- `icons/` — Must contain `icon16.png`, `icon48.png`, `icon128.png`. Generate via `scripts/generate-icons.mjs` (requires `canvas` npm package) or `icons/generate-icons.html` (open in browser).

### Service Worker Architecture Note

The background service worker loads shared libraries via `importScripts(lib/utils.js, lib/supabase-client.js, lib/api-client.js)`. Order matters: `supabase-client.js` must load before `api-client.js` because the latter references `SUPABASE_URL` and `SUPABASE_KEY` at load time. All libraries define global functions (not ES modules) so they work in the `importScripts` context. Avoid converting them to ES module `import/export` syntax without also changing the loading mechanism.
