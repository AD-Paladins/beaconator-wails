package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// JiraSearch proxies a Jira API search call from the Go backend,
// avoiding CORS restrictions that apply when fetching from the browser/WebView.
func (a *App) JiraSearch(domain, jql, email, token string, maxResults int, fields string) map[string]any {
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimSuffix(domain, "/")

	auth := base64.StdEncoding.EncodeToString([]byte(email + ":" + token))

	uf := url.Values{}
	if maxResults > 0 {
		uf.Set("maxResults", fmt.Sprintf("%d", maxResults))
	} else {
		uf.Set("maxResults", "20")
	}
	if fields != "" {
		uf.Set("fields", fields)
	} else {
		uf.Set("fields", "summary,status,priority,updated")
	}
	uf.Set("jql", jql)

	url := fmt.Sprintf("https://%s/rest/api/3/search/jql?%s", domain, uf.Encode())

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return map[string]any{"error": fmt.Sprintf("Error creando request: %s", err.Error())}
	}
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Accept", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return map[string]any{"error": fmt.Sprintf("Error de conexión a Jira: %s. Verificá tu dominio y conexión a internet.", err.Error())}
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return map[string]any{"error": fmt.Sprintf("Error leyendo respuesta: %s", err.Error())}
	}

	if res.StatusCode == 401 {
		return map[string]any{"error": "Jira: credenciales inválidas (401). Verificá email y token en Settings."}
	}
	if res.StatusCode == 403 {
		return map[string]any{"error": "Jira: acceso denegado (403). Verificá permisos de tu cuenta."}
	}
	if res.StatusCode >= 400 {
		msg := string(body)
		if len(msg) > 200 {
			msg = msg[:200]
		}
		return map[string]any{"error": fmt.Sprintf("Jira API %d: %s", res.StatusCode, msg)}
	}

	var data struct {
		Issues []any `json:"issues"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return map[string]any{"error": fmt.Sprintf("Error parseando respuesta: %s", err.Error())}
	}

	return map[string]any{"items": data.Issues}
}
