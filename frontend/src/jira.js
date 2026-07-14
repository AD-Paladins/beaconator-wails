export async function fetchJira(cfg, jql) {
  if (!cfg.jiraDomain || !cfg.jiraEmail || !cfg.jiraToken) {
    return { error: 'Configura tu dominio, email y token de Jira en Settings.' };
  }
  const domain = cfg.jiraDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // External CORS proxy — keep using browser fetch (the proxy handles CORS)
  if (cfg.jiraProxyUrl) {
    const proxy = cfg.jiraProxyUrl.replace(/\/$/, '');
    const auth = btoa(`${cfg.jiraEmail}:${cfg.jiraToken}`);
    const url = `${proxy}/search/jql?jira_domain=${encodeURIComponent(domain)}&jql=${encodeURIComponent(jql)}&maxResults=20&fields=summary,status,priority,updated`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 401) return { error: 'Jira: credenciales inválidas (401). Verificá email y token en Settings.' };
        if (res.status === 403) return { error: 'Jira: acceso denegado (403). Verificá permisos de tu cuenta.' };
        return { error: `Jira API ${res.status}: ${body.slice(0, 200)}` };
      }
      const data = await res.json();
      return { items: data.issues || [] };
    } catch (e) {
      return { error: `Error de conexión a Jira: ${e.message}. Verificá tu dominio y conexión a internet.` };
    }
  }

  // Go backend proxy — avoids CORS by routing through the Wails Go runtime
  try {
    return await window.go.main.App.JiraSearch(domain, jql, cfg.jiraEmail, cfg.jiraToken);
  } catch (e) {
    return { error: `Error de conexión a Jira: ${e.message}. Verificá tu dominio y conexión a internet.` };
  }
}
