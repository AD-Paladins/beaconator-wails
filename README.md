# Beaconator Desktop

## About

Beaconator Desktop is a [Wails](https://wails.io) app (Go backend + plain JS/HTML/CSS frontend) that gives a
unified dashboard for GitHub PRs, Jira tickets, and AI-generated insights.

You can configure the project by editing `wails.json`. More information about the project settings can be found
here: https://wails.io/docs/reference/project-config

## Prerequisites (macOS, via Homebrew)

Install [Homebrew](https://brew.sh) first if you don't have it, then:

```sh
brew install go wails node
```

- `go` — builds the app backend (required by the `wails` formula anyway).
- `wails` — the Wails CLI (`wails dev`, `wails build`, `wails doctor`).
- `node` — runs the frontend test suite (`vitest`) under `frontend/`.

Verify everything is set up correctly:

```sh
wails doctor
```

## Credentials

Beaconator talks to GitHub, Jira, and an AI provider directly from your machine — it doesn't have its own
backend. You provide your own tokens in the app's Settings screen.

### GitHub

Create a **Personal Access Token** (not an SSH key — SSH keys are for `git clone`/`push`, not the REST API):

- Classic PAT: `https://github.com/settings/tokens` → scope **`repo`** (needed for private repos; use
  `public_repo` if you only track public ones).
- Fine-grained PAT: `https://github.com/settings/personal-access-tokens` → under **Repository access**, select
  the repos you'll list in `githubRepos`, then grant these **Repository permissions** (read-only):
  - `Pull requests`
  - `Issues`
  - `Checks`
  - `Metadata` (mandatory, selected automatically)

Paste the token into the `githubToken` field in Settings.

### Jira

Generate an API token at `https://id.atlassian.com/manage-profile/security/api-tokens`, then in Settings enter:

- `jiraDomain` — e.g. `yourcompany.atlassian.net`
- `jiraEmail` — the Atlassian account email tied to the token
- `jiraToken` — the API token you just created

### AI provider (optional, for AI-generated insights)

Pick one provider in Settings and get an API key from:

| Provider | Get a key at |
|---|---|
| Google AI Studio | https://aistudio.google.com/apikey |
| Groq | https://console.groq.com/keys |
| OpenAI | https://platform.openai.com/api-keys |
| GitHub Models | https://github.com/settings/tokens (same PAT as above, needs `Models` access) |
| Custom / local (Ollama, etc.) | none — just set the base URL |

## Live Development

To run in live development mode, run `wails dev` in the project directory. This will run a Vite development
server that will provide very fast hot reload of your frontend changes. If you want to develop in a browser
and have access to your Go methods, there is also a dev server that runs on http://localhost:34115. Connect
to this in your browser, and you can call your Go code from devtools.

## Testing

Frontend unit tests (Vitest) live under `frontend/`:

```sh
cd frontend
npm install
npm test
```

Go tests run from the repo root:

```sh
go test ./...
```

## Building

To build a redistributable, production mode package, use `wails build`.
