package main

import (
	"context"
	"testing"
)

func TestOpenLink_ValidHTTP(t *testing.T) {
	var openedURL string
	app := &App{
		ctx: context.Background(),
		browserOpener: func(_ context.Context, url string) {
			openedURL = url
		},
	}

	app.OpenLink("http://example.com/path")
	if openedURL != "http://example.com/path" {
		t.Errorf("expected browser to open %q, got %q", "http://example.com/path", openedURL)
	}
}

func TestOpenLink_ValidHTTPS(t *testing.T) {
	var openedURL string
	app := &App{
		ctx: context.Background(),
		browserOpener: func(_ context.Context, url string) {
			openedURL = url
		},
	}

	app.OpenLink("https://example.com/secure-path")
	if openedURL != "https://example.com/secure-path" {
		t.Errorf("expected browser to open %q, got %q", "https://example.com/secure-path", openedURL)
	}
}

func TestOpenLink_InvalidScheme(t *testing.T) {
	called := false
	app := &App{
		ctx: context.Background(),
		browserOpener: func(_ context.Context, url string) {
			called = true
		},
	}

	app.OpenLink("ftp://files.example.com")
	if called {
		t.Error("browserOpener should not be called for ftp:// URL")
	}
}

func TestOpenLink_EmptyURL(t *testing.T) {
	called := false
	app := &App{
		ctx: context.Background(),
		browserOpener: func(_ context.Context, url string) {
			called = true
		},
	}

	app.OpenLink("")
	if called {
		t.Error("browserOpener should not be called for empty URL")
	}
}

func TestOpenLink_NilContext(t *testing.T) {
	called := false
	app := &App{
		browserOpener: func(_ context.Context, url string) {
			called = true
		},
	}
	// ctx is nil — OpenLink must not panic and must not call the opener
	app.OpenLink("http://example.com")
	if called {
		t.Error("browserOpener should not be called when ctx is nil")
	}
}
