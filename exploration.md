## Exploration: tests-and-security

### Go Backend

**Files to test:**
- `proxy.go` — `JiraSearch()` proxy function (core business logic)
- `app.go` — `App` struct, `NewApp()`, `startup()`, `OpenLink()` (Wails bindings)
- `main.go` — `main()` entry point, embedded assets, Wails app config

**Testable functions in `proxy.go` (`JiraSearch`):**
| Function | Inputs | Output | Testability | Notes |
|----------|--------|--------|-------------|-------|
| `JiraSearch` | `domain, jql, email, token, maxResults, fields` | `map[string]any` | Medium | Pure HTTP logic; requires mocking `http.Client` and URL construction |

**Testable functions in `app.go`:**
| Function | Inputs | Output | Testability | Notes |
|----------|--------|--------|-------------|-------|
| `NewApp()` | — | `*App` | High | Pure constructor |
| `startup(ctx)` | `context.Context` | — | Medium | Stores context; needs mock context |
| `OpenLink(url)` | `string` | — | Low | Calls `runtime.BrowserOpenURL`; needs Wails runtime mock |

**Mocking needs:**
- `http.Client` for `proxy.go` (replace `http.DefaultClient` with injected client or use `httptest.Server`)
- `context.Context` for `app.go` startup
- `wails runtime` for `OpenLink` (can test context validation logic in isolation)

**Test count estimate:**
- `proxy.go`: 8–12 tests (domain normalization, auth header encoding, URL construction, query params, 401/403/4xx/5xx error paths, JSON unmarshal success, network error, empty results)
- `app.go`: 3–5 tests (constructor, startup stores context, OpenLink validates URL prefix, OpenLink calls runtime)
- `main.go`: No unit tests needed (entry point); test via integration

---

### JS Frontend (shared/ source of truth)

**Module categorization:**

**Pure functions — no mocking needed (easy to unit test):**
| Module | Exports | Notes |
|--------|---------|-------|
| `config.js` | `getConfig()`, `setConfig()`, `getWatchlist()`, `setWatchlist()` | Pure localStorage wrappers; mock `localStorage` |
| `i18n.js` | `t()`, `setLanguage()`, `getLanguage()`, `getAvailableLanguages()`, `updateDOM()` | Pure string manipulation + DOM; `updateDOM` needs DOM mock |
| `ui-utils.js` | `showLoading()`, `showError()`, `showEmpty()`, `formatRateLimit()`, `escapeHtml()` | Pure DOM helpers; need JSDOM |
| `task-providers.js` | `TASK_PROVIDERS`, `getTaskProvider()` | Pure object exports; logic is in provider methods that call external deps |
| `themes.js` | `THEMES`, `getTheme()`, `setTheme()`, `applyTheme()` | localStorage + DOM class manipulation |
| `notifications.js` | `requestPermission()`, `getPermission()`, `notifyReviewNeeded()`, `getPendingCount()`, `markAllSeen()`, `clearSeen()` | localStorage + Notification API; needs mocks for both |

**Modules needing `fetch` mocking (external API calls):**
| Module | Functions | Dependencies to mock |
|--------|-----------|---------------------|
| `github.js` | `fetchActivePRs`, `fetchMyPRs`, `fetchAssignedPRs`, `fetchCheckRuns`, `fetchPRReviews`, `searchRepos`, `fetchSinglePR`, `fetchRepoPRs`, `searchIssues`, `getIssue` | `fetch` (GitHub API) |
| `jira.js` | `fetchJira()` | `fetch` (Jira proxy) OR `window.go.main.App.JiraSearch` (Wails backend) |
| `metrics.js` | `computeMetrics()`, `computeGitHubMetrics()`, `computeJiraMetrics()` | Calls `github.js`, `jira.js`, `config.js` — needs full mock chain |
| `ai.js` | `generateInsight()`, `generateAllInsights()`, `collectGitHubData()`, `collectJiraData()` | `fetch` (GitHub/Jira), `ai-providers.chatCompletion` |
| `ai-providers.js` | `chatCompletion()` | `fetch` (AI provider APIs: Google, Groq, OpenAI, GitHub Models, custom) |

**Modules needing `localStorage` mock:**
- `config.js`, `themes.js`, `notifications.js`, `ui-crypto.js`, `i18n.js` (language), `watchlist` logic inside `ui.js`

**Modules needing `wailsjs` / `window.go` mock:**
| Module | Wails bindings used |
|--------|---------------------|
| `jira.js` | `window.go.main.App.JiraSearch` (fallback when no proxy URL) |
| `ui.js` | `window.go.main.App.JiraSearch` (watchlist refresh) |

**UI-only modules (skip for unit tests — integration/E2E only):**
| Module | Reason |
|--------|--------|
| `ui.js` | 59KB, DOM-heavy, modal management, event handlers, Wails bindings, rendering logic |
| `main.js` | Bootstrapping, event listeners, panel switching, Wails startup |
| `ui-crypto.js` | Crypto operations tied to export/import UI flows; test crypto primitives in isolation instead |

---

### Security Surface

**`proxy.go` risks:**
| Risk | Location | Severity | Mitigation |
|------|----------|----------|------------|
| Base64 encoding of credentials (not encryption) | `auth := base64.StdEncoding.EncodeToString([]byte(email + ":" + token))` | Medium | Credentials only in memory during request; not logged. Ensure no logging of `auth` header. |
| URL injection via `domain` parameter | `fmt.Sprintf("https://%s/rest/api/3/search/jql?%s", domain, uf.Encode())` | Medium-High | `domain` is trimmed of scheme and trailing slash but not validated for host injection (e.g., `evil.com@legit.com`). Validate hostname format. |
| Error message disclosure | Returns `err.Error()` from HTTP calls, JSON unmarshal, body reads | Medium | Error messages returned to frontend may leak internal details (stack traces, internal URLs). Sanitize before returning. |
| No rate limit handling on backend | Forwards 429 from Jira as generic 400+ error | Low | Could add retry-after header parsing and backoff. |
| No request timeout | Uses `http.DefaultClient` (no timeout) | Medium | Add timeout to prevent hanging requests. |
| CORS bypass via Go backend | By design (proxy purpose) | Low (by design) | Ensure only authenticated frontend can call; Wails binds only to app. |

**JS risks (`shared/`):**
| Risk | Location | Severity | Mitigation |
|------|----------|----------|------------|
| `localStorage` stores secrets in plaintext | `config.js` saves `githubToken`, `jiraToken`, `aiApiKey`, `aiApiKeys` | High | Tokens are user-provided; consider encrypting at rest (Web Crypto API) or using Wails secure storage. |
| `localStorage` for watchlist (PII: ticket keys, PR URLs) | `ui-crypto.js`, `config.js` | Low | Non-sensitive but user-identifiable. |
| `fetch` with auth headers to external APIs | `github.js`, `jira.js`, `ai-providers.js` | Medium | Ensure HTTPS only; validate responses; don't log tokens. |
| `window.go.main.App.JiraSearch` exposes backend proxy to frontend | `jira.js`, `ui.js` | Low (by design) | Wails context isolation limits exposure. |
| AI prompt injection via user-controlled data | `ai.js` builds prompts from GitHub/Jira data | Medium | Data is from trusted APIs; sanitize ticket titles/summaries in prompts. |
| Crypto export uses PBKDF2 100k iterations | `ui-crypto.js` `deriveKey` | Medium | 100k is low by 2024 standards (OWASP recommends 600k+ for PBKDF2). Increase iterations. |
| No CSP headers (served via Wails asset server) | `main.go` embedded assets | Medium | Wails doesn't expose CSP config easily; consider meta tag in HTML. |

**Config storage risks:**
- All secrets in `localStorage` unencrypted (except export which uses AES-GCM)
- No automatic token rotation or expiry tracking
- `aiApiKeys` object stores multiple provider keys in plaintext

---

### Test Infrastructure Needed

**Go (stdlib only — no external deps needed):**
- `testing` package — built-in
- `net/http/httptest` — for mocking HTTP servers in `proxy.go` tests
- `context` — for mocking context in `app.go`
- Run: `go test ./...`

**JS (new dependencies required):**
| Tool | Purpose | Install |
|------|---------|---------|
| `vitest` | Test runner (ESM native, no bundler needed) | `npm init -y && npm i -D vitest @vitest/coverage-v8 jsdom` |
| `jsdom` | DOM environment for `ui-utils.js`, `themes.js`, `i18n.js` | Included with vitest |
| `@vitest/coverage-v8` | Coverage reporting | Dev dep |
| `wailsjs` mock | Custom mock for `window.go` bindings | Create `test/mocks/wailsjs.js` |

**Security tools:**
| Tool | Target | Install |
|------|--------|---------|
| `govulncheck` | Go vulnerabilities | `go install golang.org/x/vuln/cmd/govulncheck@latest` |
| `npm audit` | JS dependencies | Built into npm (run in `frontend/` or root if `package.json` exists) |
| `gosec` | Go static analysis | `go install github.com/securego/gosec/v2/cmd/gosec@latest` |
| Manual review | `proxy.go`, `ui-crypto.js` | Human review |

**Project setup:**
- Add `package.json` at repo root (or `frontend/`) with `vitest` config
- Add `vitest.config.js` with `environment: 'jsdom'`, `include: ['shared/**/*.test.js']`
- Test files: `shared/*.test.js` alongside source

---

### Recommendations

**Priority order for tests:**

| Priority | Target | Rationale |
|----------|--------|-----------|
| 1 | `proxy.go` — `JiraSearch` | Core backend logic; security-sensitive; HTTP mocking well-supported in Go stdlib |
| 2 | `config.js`, `i18n.js`, `ui-utils.js`, `themes.js`, `notifications.js` | Pure modules; high ROI; easy to test with vitest+jsdom |
| 3 | `github.js`, `jira.js` — with `fetch` mocking | High-value business logic; need `msw` or `vi.fn()` fetch mocks |
| 4 | `task-providers.js` provider logic | Pure-ish; test provider selection and mapping functions |
| 5 | `metrics.js` — integration-style tests | Requires mocking entire chain; lower ROI per test |
| 6 | `ai.js`, `ai-providers.js` | Complex async flows; mock `fetch` and providers; test prompt building |
| Skip | `ui.js`, `main.js`, `ui-crypto.js` (UI flows) | Better covered by E2E (Playwright/Wails) |

**Risk mitigation (security):**

| Risk | Fix | Effort |
|------|-----|--------|
| Domain host injection in `proxy.go` | Validate `domain` with regex `^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$` before use | Low |
| Error message disclosure | Wrap errors: return generic messages; log details server-side only | Low |
| No HTTP timeout in `proxy.go` | `http.Client{Timeout: 30 * time.Second}` | Low |
| `localStorage` plaintext secrets | Encrypt config at rest using Web Crypto (AES-GCM) with user-derived key | Medium |
| PBKDF2 100k iterations | Increase to 600k (OWASP 2024) or switch to Argon2id via WASM | Low-Medium |
| No CSP | Add `<meta http-equiv="Content-Security-Policy" ...>` to `index.html` | Low |
| No `npm audit` baseline | Add `package.json` with `vitest` + dev deps; run `npm audit` in CI | Low |

**Next steps for orchestrator:**
1. Run `govulncheck ./...` and `gosec ./...` on Go code
2. Initialize `package.json` + `vitest` in repo root
3. Create `sdd-propose` for `tests-and-security` with priority ordering above
4. Implement Go tests first (stdlib, no deps), then JS test infrastructure
5. Address high-severity security findings before merging tests

---

### Ready for Proposal
**Yes** — the exploration is complete. The orchestrator should present this to the user and proceed to `sdd-propose` with the priority ordering and security mitigations outlined above.