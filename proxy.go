package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// isValidJiraDomain checks that the given domain is a safe, public hostname
// suitable for Jira API requests. It rejects private/reserved IP ranges,
// pure IP addresses, localhost, and domains containing URL manipulation chars.
func isValidJiraDomain(domain string) bool {
	// Reject domains containing @ or # (URL manipulation)
	if strings.Contains(domain, "@") || strings.Contains(domain, "#") {
		return false
	}

	// Reject pure IP addresses — Jira domains must be hostnames
	if net.ParseIP(domain) != nil {
		return false
	}

	// Reject localhost (case-insensitive)
	if strings.EqualFold(domain, "localhost") {
		return false
	}

	// Reject private/reserved IP ranges using string prefixes
	lower := strings.ToLower(domain)
	if strings.HasPrefix(lower, "127.") ||
		strings.HasPrefix(lower, "10.") ||
		strings.HasPrefix(lower, "192.168.") ||
		strings.HasPrefix(lower, "169.254.") ||
		strings.HasPrefix(lower, "0.") {
		return false
	}

	// Reject 172.16.0.0 – 172.31.255.255 range
	if strings.HasPrefix(lower, "172.") {
		parts := strings.SplitN(lower, ".", 3)
		if len(parts) >= 2 {
			second, err := strconv.Atoi(parts[1])
			if err == nil && second >= 16 && second <= 31 {
				return false
			}
		}
	}

	return true
}

// stripHTMLTags removes anything between < and > from the string.
func stripHTMLTags(s string) string {
	var buf strings.Builder
	inTag := false
	for _, r := range s {
		if r == '<' {
			inTag = true
			continue
		}
		if r == '>' {
			inTag = false
			continue
		}
		if !inTag {
			buf.WriteRune(r)
		}
	}
	return buf.String()
}

// JiraSearch proxies a Jira API search call from the Go backend,
// avoiding CORS restrictions that apply when fetching from the browser/WebView.
func (a *App) JiraSearch(domain, jql, email, token string, maxResults int, fields string) map[string]any {
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimSuffix(domain, "/")

	if !isValidJiraDomain(domain) {
		return map[string]any{"error": "Dominio inválido: se requiere un dominio público válido (ej: yourcompany.atlassian.net)"}
	}

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
		uf.Set("fields", "summary,status,priority,updated,created")
	}
	uf.Set("jql", jql)

	url := fmt.Sprintf("https://%s/rest/api/3/search/jql?%s", domain, uf.Encode())

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return map[string]any{"error": fmt.Sprintf("Error creando request: %s", err.Error())}
	}
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Accept", "application/json")

	res, err := a.httpClient.Do(req)
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
		msg = stripHTMLTags(msg)
		if len(msg) > 150 {
			msg = msg[:150]
		}
		if msg == "" {
			msg = "la API de Jira devolvió un error"
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
