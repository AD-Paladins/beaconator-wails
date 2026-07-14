package main

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx           context.Context
	httpClient    *http.Client
	browserOpener func(ctx context.Context, url string)
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		httpClient:    &http.Client{Timeout: 10 * time.Second},
		browserOpener: runtime.BrowserOpenURL,
	}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// OpenLink opens a URL in the default system browser
func (a *App) OpenLink(url string) {
	if a.ctx != nil && (strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://")) {
		a.browserOpener(a.ctx, url)
	}
}
