1. Settings/Configuration
Core Configuration File: shared/config.js
- Defines default config values using localStorage persistence
- Key fields related to your query:
- githubToken - Classic PAT for GitHub API
- githubEmail - GitHub email for PR filtering
- githubUser - GitHub username (optional, for review notifications)
- githubRepos - Repos to monitor (comma-separated)
- jiraDomain - Jira domain (e.g., yourcompany.atlassian.net)
- jiraEmail - Jira email
- jiraToken - Jira API token
- jiraJql - Custom JQL for "My Jira" panel
- taskProvider - Provider for tasks panel: jira or github
- githubIssuesToken - Optional separate token for GitHub Issues
- githubIssuesQuery - Default query: is:issue is:open sort:updated-desc
Settings UI: frontend/src/ui.js (the openSettings() function, lines 1287-1605)
- Renders a tabbed modal with panels: General, Tasks, AI, Watchlist, Import/Export, Help
- General tab (lines 1306-1329): GitHub token, repos, email, username
- Tasks tab (lines 1331-1379): Task provider toggle (Jira vs GitHub Issues), shows Jira fields (domain, email, token, JQL, story field) or GitHub Issues fields (optional token, query)
- Save (lines 1551-1579): Collects all field values from the form and calls setConfig()
Crypto/Export-Impost: shared/ui-crypto.js
- Defines which config fields are considered "credentials" for export/import:
- GitHub: githubToken, githubEmail, githubUser, githubRepos
- Jira: jiraDomain, jiraEmail, jiraToken, jiraJql, jiraProxyUrl
- Tasks: taskProvider, githubIssuesToken, githubIssuesQuery
2. Localization/i18n
I18n System: shared/i18n.js
- Provides t(key, params) function for translation lookup
- Language stored in localStorage via key devdash_lang_v1
- Supported languages: English (en) and Spanish (es)
- updateDOM() finds elements with data-i18n or data-i18n-placeholder attributes and replaces their content
- Language switcher in frontend/src/main.js (lines 19-49)
Locale Files:
- shared/locales/en.json and shared/locales/es.json - Core translations
- frontend/src/locales/en.json and frontend/src/locales/es.json - Also contain translations (frontend takes precedence or they're separate bundles)
Key translation categories:
- settings.* - Settings labels and hints
- help.* - Help modals/guide text
- metrics.* - Metrics labels
- panel.* - Panel titles
- ai.* - AI insights modal
3. Jira and GitHub Token Fields
Jira API Token (throughout the codebase):
- Config: shared/config.js line 11: jiraToken: ''
- UI: frontend/src/ui.js line 1352-1353: <label>${t('settings.jiraToken')}</label> → <input type="password" id="cfg-jira-token" ... />
- Usage: frontend/src/jira.js lines 2-4: validates cfg.jiraDomain, cfg.jiraEmail, cfg.jiraToken before making API calls
- Help text: shared/locales/en.json line 92: "settings.jiraToken": "Jira API token"; shared/locales/es.json line 92: "settings.jiraToken": "API token de Jira"; help.jira.credentials explains generating tokens at id.atlassian.com
GitHub Personal Access Token (PAT):
- Config: shared/config.js line 5: githubToken: ''
- UI: frontend/src/ui.js line 1308-1310: <label>${t('settings.ghToken')}</label> → <input type="password" id="cfg-gh-token" ... /> with hint
- Usage: frontend/src/github.js - all API functions require cfg.githubToken; shared/metrics.js, shared/ai.js also use it
- Help text: shared/locales/en.json line 78-79: "settings.ghToken.hint" with link to GitHub token generation page; help.github.token explains 'repo' scope requirements
GitHub Issues Token (optional, separate from main PAT):
- Config: shared/config.js line 16: githubIssuesToken: ''
- UI: frontend/src/ui.js lines 1368-1371: Shown only when "Tasks" provider is set to "GitHub Issues"
- <label>${t('settings.githubIssuesToken')}</label> → <input type="password" id="cfg-github-issues-token" ... />
- Hint: t('settings.githubIssuesToken.hint') - "Leave empty to reuse the GitHub token from General tab. Only needed for a separate token."
- Usage: frontend/src/github.js lines 273, 315: const token = cfg.githubIssuesToken || cfg.githubToken - falls back to main token if not set
- Help text: frontend/src/locales/en.json lines 95-96: "settings.githubIssuesToken": "GitHub Issues token (optional)" with hint; help.tasks.github explains optional separate token
4. Help Text and Tooltips
Help Modal (frontend/src/ui.js lines 774-820): The openHelp() function displays a modal with localized help sections:
- GitHub section: Uses t('help.github.token'), t('help.github.repos'), t('help.github.email'), t('help.github.username')
- Jira section: Uses t('help.jira.domain'), t('help.jira.credentials'), t('help.jira.jql'), t('help.jira.noProxy')
- Tasks section: Uses t('help.tasks.provider'), t('help.tasks.jira'), t('help.tasks.github')
- Watchlist section: Uses t('help.watchlist.jira'), t('help.watchlist.prs')
- Import/Export section: Uses t('help.io.export'), t('help.io.import')
Settings Help Button (frontend/src/ui.js lines 1429-1456): The "Help" tab in the settings modal shows the same help content, using the same t() calls from locale files.
Key locale entries (from shared/locales/en.json and frontend/src/locales/en.json):
- settings.ghToken.hint - Tooltip with GitHub PAT generation instructions
- settings.ghEmail.hint - Tooltip explaining email use for PR filtering
- settings.ghUser.hint / settings.ghUser.placeholder - Tooltip/placeholder for GitHub username
- settings.jiraToken - Label "Jira API token"
- settings.jiraJql - Label "Custom JQL for My Jira"
- settings.githubIssuesToken.hint - Optional separate token hint
- settings.githubIssuesQuery.hint - Default query hint
Overall Structure
beaconator-wails/
├── shared/                    # Shared Go+JS code
│   ├── config.js              # Default config values (localStorage)
│   ├── i18n.js                # i18n system (t(), setLanguage, etc.)
│   ├── locales/               # JSON translation files (en, es)
│   ├── ui-crypto.js           # Export/import categories
│   ├── github.js              # GitHub API helpers
│   ├── jira.js                # Jira API helpers
│   ├── metrics.js             # Metrics computation
│   ├── ai.js                  # AI insights
│   ├── task-providers.js      # Task provider config fields
│   ├── notifications.js       # Notification handling
│   └── ui-utils.js            # UI utility functions
├── frontend/src/              # Frontend (JS/HTML)
│   ├── locales/               # JSON translation files (en, es - larger set)
│   ├── i18n.js                # i18n imports/exports
│   ├── ui.js                  # Main UI logic (settings, rendering, modals)
│   ├── jira.js                # Jira API calls
│   ├── github.js              # GitHub API calls
│   ├── themes.js              # Theme management
│   ├── ai-providers.js        # AI provider config
│   └── main.js                # App initialization
├── app.go                     # Go app structure
├── main.go                    # Wails entry point
└── wails.json                 # Wails build config