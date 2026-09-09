# Beaconator - Agents Guide

## Project Overview
Beaconator is a desktop dashboard application (Wails + Go) that monitors GitHub PRs and Jira tickets. It helps users track active PRs, Jira throughput, cycle time, and more.

## Quick Navigation

### Key Directories
- `shared/` - Shared Go+JS code, configuration, i18n, API helpers
- `frontend/src/` - Frontend JavaScript/HTML, UI logic, locales
- `docs/` - Documentation including `codebase-exploration-basic.md`
- `app.go` / `main.go` - Wails application entry points

### Core Configuration
- `shared/config.js` - Default config values with localStorage persistence
  - `githubToken`, `githubEmail`, `githubUser`, `githubRepos`
  - `jiraDomain`, `jiraEmail`, `jiraToken`, `jiraJql`
  - `taskProvider` (jira | github), `githubIssuesToken`, `githubIssuesQuery`

### Localization/I18n
The app uses a dual i18n system:

**Frontend i18n** (`frontend/src/i18n.js`):
- Used by the UI (`ui.js`, `main.js`)
- Languages: English (`en`) and Spanish (`es`)
- Keys looked up via `t(key, params)` function
- Locale files: `frontend/src/locales/en.json`, `frontend/src/locales/es.json`
- Elements with `data-i18n` or `data-i18n-placeholder` attributes are auto-updated

**Shared i18n** (`shared/i18n.js`):
- Also provides `t(key, params)` function
- Locale files: `shared/locales/en.json`, `shared/locales/es.json`
- Used by Go-side code or as backup

**Note**: Both systems exist independently. The frontend i18n is what the UI uses. Changes should be made to both if they affect different parts of the app.

### Settings Tabs
- **General** (ui.js:1305): GitHub token, repos, email, username - all have `field-hint` help text
- **Tasks** (ui.js:1331): Task provider toggle (Jira vs GitHub Issues), shows relevant fields
- **AI** (ui.js:1381): AI provider, API key, model configuration
- **Watchlist**, **Import/Export**, **Help**

### Recent Changes (this session)
1. **Jira token help added** - Added `settings.jiraToken.hint` to all locale files with link to generate token at `id.atlassian.com/tokens`. Added `field-hint` div in `frontend/src/ui.js:1354`.

2. **GitHub Issues token hint enhanced** - Added link to generate token with `issues` scope at `github.com/settings/tokens` in both English and Spanish locales.

3. **Spanish locale converted** - Converted from Argentine Spanish (`generalo`, `marcá`, `dejalo`, `querés`) to International Spanish (`genera`, `marca`, `deja`, `quiere`), removed `target="_blank"` from links (Wails desktop app).

4. **Help hint for Jira token in Tasks tab** - Was missing; now matches the pattern used for GitHub token in General tab.

### Code Conventions
- Use `t('key')` for all user-facing strings in UI
- Locale files have both `shared/locales/` and `frontend/src/locales/` - update both if affecting UI
- Spanish uses International (not Argentine) forms
- Links in hints should NOT have `target="_blank"` (desktop app)
- All settings fields have corresponding help hints except where noted

### Testing
- Run `npm test` in `frontend/` to execute Vitest tests
- 130 tests pass; 7 pre-existing failures in `metrics.test.js` (unrelated `localStorage.clear()` issue)
- Key test files: `i18n.test.js`, `config.test.js`, `jira.test.js`, `github.test.js`, `task-providers.test.js`

### Helpful Commands
- `npm test` - Run frontend tests (Vitest)
- `wails dev` - Start development mode (hot-reload Go + frontend)
- `wails build` - Build the desktop application bundle
- `rg "pattern" .` - Search codebase with ripgrep
- `go test ./...` - Run Go tests (shared logic)
- `cat shared/locales/en.json` - View English translations
- `cat frontend/src/locales/es.json` - View Spanish translations