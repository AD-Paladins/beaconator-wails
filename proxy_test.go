package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// rewriteTransport rewrites outgoing request URLs to a target test server,
// allowing tests to verify JiraSearch with a real HTTP round-trip.
type rewriteTransport struct {
	target string
}

func (t *rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	targetURL, err := url.Parse(t.target)
	if err != nil {
		return nil, fmt.Errorf("rewriteTransport: bad target %q: %w", t.target, err)
	}
	req.URL.Scheme = targetURL.Scheme
	req.URL.Host = targetURL.Host
	return http.DefaultTransport.RoundTrip(req)
}

// errTransport always returns a connection error to simulate network failures.
type errTransport struct{}

func (t *errTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return nil, fmt.Errorf("connection refused")
}

func TestJiraSearch_HappyPath(t *testing.T) {
	var capturedReq *http.Request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedReq = r
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{"id": "10000", "key": "TEST-1", "fields": map[string]any{"summary": "Test issue"}},
			},
		})
	}))
	defer server.Close()

	app := &App{
		httpClient: &http.Client{
			Transport: &rewriteTransport{target: server.URL},
		},
	}

	result := app.JiraSearch("test.atlassian.net", "project = TEST", "user@test.com", "tok", 10, "summary")

	items, ok := result["items"]
	if !ok {
		t.Fatal("expected 'items' key in result")
	}
	issues, ok := items.([]any)
	if !ok {
		t.Fatal("expected items to be []any")
	}
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(issues))
	}

	if capturedReq == nil {
		t.Fatal("request was not captured by test server")
	}

	// Verify the request was sent to the correct path
	if !strings.Contains(capturedReq.URL.Path, "/rest/api/3/search/jql") {
		t.Errorf("expected path /rest/api/3/search/jql, got %s", capturedReq.URL.Path)
	}

	// Verify auth header format
	auth := capturedReq.Header.Get("Authorization")
	expectedAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte("user@test.com:tok"))
	if auth != expectedAuth {
		t.Errorf("Authorization header: got %q, want %q", auth, expectedAuth)
	}

	// Verify Accept header
	accept := capturedReq.Header.Get("Accept")
	if accept != "application/json" {
		t.Errorf("Accept header: got %q, want %q", accept, "application/json")
	}
}

func TestJiraSearch_EmptyResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{
			"issues": []any{},
		})
	}))
	defer server.Close()

	app := &App{
		httpClient: &http.Client{
			Transport: &rewriteTransport{target: server.URL},
		},
	}

	result := app.JiraSearch("test.atlassian.net", "project = EMPTY", "user@test.com", "tok", 10, "")

	items, ok := result["items"]
	if !ok {
		t.Fatal("expected 'items' key in result")
	}
	issues, ok := items.([]any)
	if !ok {
		t.Fatal("expected items to be []any")
	}
	if len(issues) != 0 {
		t.Fatalf("expected 0 issues, got %d", len(issues))
	}
}

func TestJiraSearch_401Unauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]any{
			"errorMessages": []string{"Invalid authentication credentials"},
		})
	}))
	defer server.Close()

	app := &App{
		httpClient: &http.Client{
			Transport: &rewriteTransport{target: server.URL},
		},
	}

	result := app.JiraSearch("test.atlassian.net", "project = TEST", "bad@user.com", "bad-token", 10, "")

	errMsg, ok := result["error"]
	if !ok {
		t.Fatal("expected 'error' key in result for 401 response")
	}
	if !strings.Contains(errMsg.(string), "credenciales inválidas") {
		t.Errorf("expected error about invalid credentials, got: %s", errMsg)
	}
	if !strings.Contains(errMsg.(string), "401") {
		t.Errorf("expected error to reference 401, got: %s", errMsg)
	}
}

func TestJiraSearch_403Forbidden(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(`{"errorMessages":["Access denied"]}`))
	}))
	defer server.Close()

	app := &App{
		httpClient: &http.Client{
			Transport: &rewriteTransport{target: server.URL},
		},
	}

	result := app.JiraSearch("test.atlassian.net", "project = TEST", "user@test.com", "tok", 10, "")

	errMsg, ok := result["error"]
	if !ok {
		t.Fatal("expected 'error' key in result for 403 response")
	}
	if !strings.Contains(errMsg.(string), "acceso denegado") {
		t.Errorf("expected error about access denied, got: %s", errMsg)
	}
	if !strings.Contains(errMsg.(string), "403") {
		t.Errorf("expected error to reference 403, got: %s", errMsg)
	}
}

func TestJiraSearch_500Error(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Internal Server Error"))
	}))
	defer server.Close()

	app := &App{
		httpClient: &http.Client{
			Transport: &rewriteTransport{target: server.URL},
		},
	}

	result := app.JiraSearch("test.atlassian.net", "project = TEST", "user@test.com", "tok", 10, "")

	errMsg, ok := result["error"]
	if !ok {
		t.Fatal("expected 'error' key in result for 500 response")
	}
	if !strings.Contains(errMsg.(string), "500") {
		t.Errorf("expected error to contain status code 500, got: %s", errMsg)
	}
	if !strings.Contains(errMsg.(string), "Jira API") {
		t.Errorf("expected error to contain 'Jira API', got: %s", errMsg)
	}
}

func TestJiraSearch_NetworkError(t *testing.T) {
	app := &App{
		httpClient: &http.Client{
			Transport: &errTransport{},
		},
	}

	result := app.JiraSearch("unreachable.atlassian.net", "project = TEST", "user@test.com", "tok", 10, "")

	errMsg, ok := result["error"]
	if !ok {
		t.Fatal("expected 'error' key in result for network error")
	}
	if !strings.Contains(errMsg.(string), "conexión") {
		t.Errorf("expected error about connection issue, got: %s", errMsg)
	}
}

func TestJiraSearch_URLSanitization_HTTPS(t *testing.T) {
	var capturedReq *http.Request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedReq = r
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{"issues": []any{}})
	}))
	defer server.Close()

	app := &App{
		httpClient: &http.Client{
			Transport: &rewriteTransport{target: server.URL},
		},
	}

	// Domain with https:// prefix — JiraSearch should strip it
	_ = app.JiraSearch("https://my-domain.atlassian.net", "project = TEST", "user@test.com", "tok", 10, "")

	if capturedReq == nil {
		t.Fatal("request was not captured")
	}
	// The path should be the standard search path (not a double-domain path)
	if !strings.HasPrefix(capturedReq.URL.Path, "/rest/api/3/search/jql") {
		t.Errorf("expected /rest/api/3/search/jql path after sanitization, got %s", capturedReq.URL.Path)
	}
	// The host should have been stripped of https:// prefix
	// Since we use rewriteTransport, the actual Host seen by the test server
	// is the test server's own host, but the URL is constructed from the sanitized domain
	if capturedReq.URL.RawQuery == "" {
		t.Error("expected query parameters in request")
	}
}

func TestJiraSearch_URLSanitization_TrailingSlash(t *testing.T) {
	var capturedReq *http.Request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedReq = r
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{"issues": []any{}})
	}))
	defer server.Close()

	app := &App{
		httpClient: &http.Client{
			Transport: &rewriteTransport{target: server.URL},
		},
	}

	// Domain with trailing slash — JiraSearch should strip it
	_ = app.JiraSearch("my-domain.atlassian.net/", "project = TEST", "user@test.com", "tok", 10, "")

	if capturedReq == nil {
		t.Fatal("request was not captured")
	}
	if !strings.HasPrefix(capturedReq.URL.Path, "/rest/api/3/search/jql") {
		t.Errorf("expected /rest/api/3/search/jql path after sanitization, got %s", capturedReq.URL.Path)
	}
}

func TestJiraSearch_AuthHeader(t *testing.T) {
	var capturedAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{"issues": []any{}})
	}))
	defer server.Close()

	app := &App{
		httpClient: &http.Client{
			Transport: &rewriteTransport{target: server.URL},
		},
	}

	app.JiraSearch("test.atlassian.net", "project = TEST", "alice@example.com", "my-secret-api-token", 10, "")

	expected := "Basic " + base64.StdEncoding.EncodeToString([]byte("alice@example.com:my-secret-api-token"))
	if capturedAuth != expected {
		t.Errorf("Authorization header:\ngot:  %q\nwant: %q", capturedAuth, expected)
	}
}

func TestJiraSearch_DefaultMaxResults(t *testing.T) {
	var capturedMaxResults string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedMaxResults = r.URL.Query().Get("maxResults")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{"issues": []any{}})
	}))
	defer server.Close()

	app := &App{
		httpClient: &http.Client{
			Transport: &rewriteTransport{target: server.URL},
		},
	}

	// maxResults=0 should default to 20
	app.JiraSearch("test.atlassian.net", "project = TEST", "user@test.com", "tok", 0, "")

	if capturedMaxResults != "20" {
		t.Errorf("expected default maxResults=20, got %s", capturedMaxResults)
	}
}

func TestJiraSearch_DefaultFields(t *testing.T) {
	var capturedFields string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedFields = r.URL.Query().Get("fields")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{"issues": []any{}})
	}))
	defer server.Close()

	app := &App{
		httpClient: &http.Client{
			Transport: &rewriteTransport{target: server.URL},
		},
	}

	// empty fields should default to "summary,status,priority,updated,created"
	app.JiraSearch("test.atlassian.net", "project = TEST", "user@test.com", "tok", 10, "")

	if capturedFields != "summary,status,priority,updated,created" {
		t.Errorf("expected default fields, got %s", capturedFields)
	}
}
