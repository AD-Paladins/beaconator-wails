package main

import (
	"context"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// OpenLink opens a URL in the default system browser
func (a *App) OpenLink(url string) {
	if a.ctx != nil && (strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://")) {
		runtime.BrowserOpenURL(a.ctx, url)
	}
}
