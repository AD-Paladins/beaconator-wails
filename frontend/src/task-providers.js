import { fetchJira } from './jira.js';
import { searchIssues, getIssue } from './github.js';

// ---- Helpers ----

function jiraStatusColor(statusName) {
  const s = (statusName || '').toLowerCase();
  if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return 'done';
  if (s.includes('progress') || s.includes('review')) return 'progress';
  return 'todo';
}

function extractPriority(labels) {
  if (!labels || !labels.length) return null;
  const order = ['highest', 'high', 'medium', 'low'];
  for (const p of order) {
    const found = labels.find((l) => {
      const n = (l.name || '').toLowerCase();
      return n === p || n.includes(p);
    });
    if (found) return found.name;
  }
  return null;
}

function mapJiraIssue(issue, cfg) {
  const domain = (cfg.jiraDomain || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return {
    id: issue.key,
    title: issue.fields?.summary || '',
    url: `https://${domain}/browse/${issue.key}`,
    status: issue.fields?.status?.name || 'unknown',
    statusColor: jiraStatusColor(issue.fields?.status?.name || ''),
    priority: issue.fields?.priority?.name || null,
    createdAt: issue.fields?.created || null,
    updatedAt: issue.fields?.updated || null,
    extra: {
      storyPoints: cfg.jiraStoryField ? issue.fields?.[cfg.jiraStoryField] : null,
      priorityIcon: issue.fields?.priority?.iconUrl || null,
    },
  };
}

function mapGitHubIssue(issue) {
  return {
    id: `#${issue.number}`,
    title: issue.title,
    url: issue.html_url,
    status: issue.state,
    statusColor: issue.state === 'open' ? 'progress' : 'done',
    priority: extractPriority(issue.labels),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    extra: {
      labels: issue.labels || [],
      assignee: issue.assignee?.login || null,
      milestone: issue.milestone?.title || null,
    },
  };
}

// ---- Providers ----

export const TASK_PROVIDERS = {
  jira: {
    id: 'jira',
    name: 'Jira',
    configFields: ['jiraDomain', 'jiraEmail', 'jiraToken', 'jiraJql', 'jiraStoryField'],
    async fetchTasks(cfg, query) {
      const jql = query || cfg.jiraJql || 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';
      const fields = ['summary', 'status', 'priority', 'updated', 'created'];
      if (cfg.jiraStoryField) fields.push(cfg.jiraStoryField);
      const result = await fetchJira(cfg, jql, { maxResults: 50, fields: fields.join(',') });
      if (result.error) return { items: [], error: result.error };
      return { items: (result.items || []).map((issue) => mapJiraIssue(issue, cfg)) };
    },
    async fetchByKey(cfg, key) {
      const result = await fetchJira(cfg, `key = ${key}`, { maxResults: 1, fields: 'summary,status,priority,updated,created' });
      if (result.error || !result.items?.length) return { item: null, error: result.error || 'Not found' };
      return { item: mapJiraIssue(result.items[0], cfg) };
    },
  },

  github: {
    id: 'github',
    name: 'GitHub Issues',
    configFields: ['githubToken', 'githubRepos', 'githubIssuesQuery'],
    async fetchTasks(cfg, query) {
      const q = query || cfg.githubIssuesQuery || 'is:issue is:open sort:updated-desc';
      const result = await searchIssues(cfg, q);
      if (result.error) return { items: [], error: result.error };
      return { items: (result.items || []).map(mapGitHubIssue) };
    },
    async fetchByKey(cfg, key) {
      // Support formats: "owner/repo#123", "#123", "123"
      const trimmed = key.replace(/^#/, '');
      let result;
      const match = trimmed.match(/^([^/]+)\/([^#]+)#(\d+)$/);
      if (match) {
        const [, owner, repo, num] = match;
        const issue = await getIssue(cfg, owner, repo, parseInt(num, 10));
        result = issue ? { items: [issue] } : { items: [] };
      } else {
        // Search by number across repos
        result = await searchIssues(cfg, `number:${trimmed}`);
      }
      if (result.error || !result.items?.length) return { item: null, error: result.error || 'Not found' };
      return { item: mapGitHubIssue(result.items[0]) };
    },
  },
};

export function getTaskProvider(id) {
  return TASK_PROVIDERS[id] || TASK_PROVIDERS.jira;
}
