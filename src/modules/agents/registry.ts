/**
 * ZARA AI 2070 — modular Agent Registry.
 *
 * ZARA is a multi-agent system. The "ZARA Core" orchestrator routes a user
 * request to the most appropriate specialized agent. Agents declare their
 * capabilities, the tools they may use, and a real readiness state so the UI
 * can honestly report what is configured vs. what needs setup.
 *
 * This registry is deliberately data-driven: adding a new agent is just adding
 * an entry (plus an optional handler), so the system stays extensible without
 * rewriting ZARA Core.
 */

export type AgentId =
  | 'core'
  | 'coding'
  | 'browser'
  | 'research'
  | 'job'
  | 'client'
  | 'communication'
  | 'vision'
  | 'github'
  | 'memory'
  | 'productivity'
  | 'system'

export type AgentReadyState = 'ready' | 'requires-config' | 'unavailable'

export interface AgentCapability {
  name: string
  description: string
}

export interface AgentDefinition {
  id: AgentId
  name: string
  description: string
  capabilities: AgentCapability[]
  /** Tools (functions) this agent may invoke, matching functions.json names. */
  tools: string[]
  readyState: AgentReadyState
  /** Human readable reason for the readiness state. */
  readinessNote: string
}

/**
 * The tool allowlist per agent. This is the "controlled tool" layer — agents
 * never execute arbitrary code directly; they only call registered functions.
 */
export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    id: 'core',
    name: 'ZARA Core',
    description: 'Orchestrator and router. Decides which agent handles a request.',
    capabilities: [
      { name: 'intent-routing', description: 'Routes requests to the right agent' },
      { name: 'permissions', description: 'Enforces approval gates for risky actions' },
      { name: 'activity-log', description: 'Records user commands, intents, tools and results' },
    ],
    tools: ['get_current_datetime', 'save_memory', 'recall_memories', 'delete_memory'],
    readyState: 'ready',
    readinessNote: 'Core routing and memory are always available.',
  },
  {
    id: 'memory',
    name: 'Memory Agent',
    description: 'Persistent, long-term memory about Aitzaz and the work.',
    capabilities: [
      { name: 'save-memory', description: 'Store a durable fact, preference or instruction' },
      { name: 'recall-memory', description: 'Retrieve relevant stored memories' },
      { name: 'update-memory', description: 'Correct or refine an existing memory' },
      { name: 'delete-memory', description: 'Forget a memory on request' },
      { name: 'clear-memory', description: 'Clear memories' },
    ],
    tools: ['save_memory', 'recall_memories', 'delete_memory'],
    readyState: 'ready',
    readinessNote: 'Local persistent memory store is available.',
  },
  {
    id: 'productivity',
    name: 'Productivity Agent',
    description: 'Tasks, reminders, scheduling and daily planning.',
    capabilities: [
      { name: 'tasks', description: 'Create, list, prioritize and complete tasks' },
      { name: 'reminders', description: 'Schedule verbal/command reminders' },
      { name: 'daily-plan', description: 'Summarize what is due today' },
      { name: 'work-session', description: 'Help start a focused work session' },
    ],
    tools: ['get_current_datetime', 'schedule_task', 'manage_scheduled_tasks'],
    readyState: 'ready',
    readinessNote: 'Local task & reminder engine available.',
  },
  {
    id: 'system',
    name: 'System Agent',
    description: 'Computer assistance — launch apps, open paths, clipboard, shell.',
    capabilities: [
      { name: 'open-app', description: 'Launch an application or open a folder/URL' },
      { name: 'filesystem', description: 'List directories and explore the file system' },
      { name: 'clipboard', description: 'Read/write the clipboard' },
      { name: 'shell', description: 'Run safe, allowlisted shell commands' },
    ],
    tools: ['open_path', 'list_directory', 'manage_clipboard', 'execute_command'],
    readyState: 'ready',
    readinessNote: 'Local desktop tooling available in the desktop app.',
  },
  {
    id: 'browser',
    name: 'Browser Agent',
    description: 'Web browsing and search.',
    capabilities: [
      { name: 'open-site', description: 'Open a website in the default browser' },
      { name: 'web-search', description: 'Search the web for current information' },
      { name: 'browser-context', description: 'Read the current browser page context' },
      { name: 'browser-control', description: 'Back/forward/tab control via bridge' },
    ],
    tools: ['open_path', 'perform_web_search', 'searxng_web_search', 'browser_context'],
    readyState: 'requires-config',
    readinessNote: 'Web search works when a provider is configured; full browser control needs the desktop/browser bridge.',
  },
  {
    id: 'research',
    name: 'Research Agent',
    description: 'Deep web research and information gathering.',
    capabilities: [
      { name: 'web-search', description: 'Search the web across queries' },
      { name: 'research', description: 'Gather and summarize findings' },
    ],
    tools: ['perform_web_search', 'searxng_web_search'],
    readyState: 'requires-config',
    readinessNote: 'Needs a search provider (OpenRouter/OpenAI web search or SearXNG).',
  },
  {
    id: 'job',
    name: 'Job Agent',
    description: 'Job hunting and application preparation for Aitzaz.',
    capabilities: [
      { name: 'find-jobs', description: 'Search legitimate remote/local job opportunities' },
      { name: 'analyze-job', description: 'Compare requirements against Aitzaz skills' },
      { name: 'prepare-application', description: 'Draft CV/cover-letter/answers for approval' },
      { name: 'track-application', description: 'Track application status' },
    ],
    tools: ['perform_web_search', 'save_memory', 'recall_memories'],
    readyState: 'requires-config',
    readinessNote: 'Job searching needs a search provider. Nothing is ever sent without approval.',
  },
  {
    id: 'client',
    name: 'Client Agent',
    description: 'Client and lead finding, CRM tracking, outreach prep.',
    capabilities: [
      { name: 'find-clients', description: 'Research public business information and leads' },
      { name: 'crm', description: 'Track leads and client status' },
      { name: 'reminders', description: 'Remind Aitzaz of follow-ups due' },
    ],
    tools: ['perform_web_search', 'save_memory', 'recall_memories'],
    readyState: 'requires-config',
    readinessNote: 'Lead research needs a search provider. Leads are never fabricated.',
  },
  {
    id: 'communication',
    name: 'Communication Agent',
    description: 'Professional client communication drafting and translation.',
    capabilities: [
      { name: 'draft', description: 'Draft professional replies, proposals, quotes' },
      { name: 'translate', description: 'Translate between English/Urdu/Hindi' },
      { name: 'summarize', description: 'Summarize conversations' },
    ],
    tools: ['manage_clipboard', 'save_memory', 'recall_memories'],
    readyState: 'ready',
    readinessNote: 'Drafting works with any AI provider. Nothing is sent without approval.',
  },
  {
    id: 'coding',
    name: 'Coding Agent',
    description: 'Code explanation, writing, fixing, debugging, and project analysis.',
    capabilities: [
      { name: 'explain-code', description: 'Explain how code works' },
      { name: 'write-code', description: 'Write and edit code in the project' },
      { name: 'fix-code', description: 'Diagnose and propose fixes for errors' },
      { name: 'analyze-project', description: 'Inspect a project structure and dependencies' },
    ],
    tools: ['list_directory', 'manage_clipboard', 'execute_command'],
    readyState: 'requires-config',
    readinessNote: 'Full autonomous edits run in the desktop app only; changes are always reviewed/approved.',
  },
  {
    id: 'github',
    name: 'GitHub Agent',
    description: 'Repository status, diff, commit, branch, issue inspection.',
    capabilities: [
      { name: 'git-status', description: 'Report git status and diffs' },
      { name: 'git-commit', description: 'Prepare commits for approval' },
      { name: 'inspect-repo', description: 'Inspect issues and repository state' },
    ],
    tools: ['execute_command'],
    readyState: 'requires-config',
    readinessNote: 'Requires a GitHub token and git in the desktop environment. Pushes always require approval.',
  },
  {
    id: 'vision',
    name: 'Vision Agent',
    description: 'Screen and camera understanding via a vision model.',
    capabilities: [
      { name: 'screen', description: 'Capture and explain the current screen' },
      { name: 'camera', description: 'Use the camera to read what is shown' },
      { name: 'ocr', description: 'Read text from an image' },
    ],
    tools: ['take_screenshot'],
    readyState: 'unavailable',
    readinessNote: 'Requires a vision-capable model and camera/screen capture permission.',
  },
]

const REGISTRY_BY_ID = new Map<AgentId, AgentDefinition>(
  AGENT_REGISTRY.map(a => [a.id, a])
)

export function getAgent(id: AgentId): AgentDefinition | undefined {
  return REGISTRY_BY_ID.get(id)
}

export function listAgents(): AgentDefinition[] {
  return AGENT_REGISTRY
}

export function listReadyAgents(): AgentDefinition[] {
  return AGENT_REGISTRY.filter(a => a.readyState === 'ready')
}

export function listAgentsForTool(toolName: string): AgentDefinition[] {
  return AGENT_REGISTRY.filter(a => a.tools.includes(toolName))
}

/**
 * Simple, deterministic intent router (keyword based) that works even without
 * an LLM so the app is usable in demo/no-key mode. When an AI provider is
 * connected, the provider's own function-calling does the real routing; this
 * is a local fallback only.
 */
export function routeIntent(rawInput: string): { agentId: AgentId; confidence: 'high' | 'medium' | 'low' } {
  const text = (rawInput || '').toLowerCase()

  const keywordGroups: Array<{ ids: AgentId[]; keywords: string[] }> = [
    {
      ids: ['memory'],
      keywords: ['remember', 'forget', 'memory', 'do you remember', 'what do you remember', 'recall'],
    },
    {
      ids: ['client', 'communication'],
      keywords: ['client', 'lead', 'proposal', 'quotation', 'outreach', 'follow up', 'follow-up', 'negotiat'],
    },
    {
      ids: ['job'],
      keywords: ['job', 'hiring', 'remote work', 'apply', 'application', 'cv', 'cover letter', 'career'],
    },
    {
      ids: ['coding'],
      keywords: ['code', 'debug', 'fix error', 'refactor', 'bug', 'compile', 'script', 'function', 'commit'],
    },
    {
      ids: ['github'],
      keywords: ['git status', 'git diff', 'push', 'branch', 'pull request', 'github', 'repository'],
    },
    {
      ids: ['research'],
      keywords: ['research', 'search for', 'look up', 'find out', 'investigate', 'what is', 'who is', 'why', 'how does'],
    },
    {
      ids: ['browser'],
      keywords: ['open youtube', 'open google', 'open gmail', 'open github', 'open chatgpt', 'search youtube', 'new tab', 'go back', 'browser', 'website', 'open '],
    },
    {
      ids: ['productivity'],
      keywords: ['task', 'remind', 'today', 'todo', 'schedule', 'plan my day', 'work session', 'what do i need to do'],
    },
    {
      ids: ['vision'],
      keywords: ['what is on my screen', 'what do you see', 'take a screenshot', 'read this screen', 'explain this page', 'error shown'],
    },
    {
      ids: ['system'],
      keywords: ['open chrome', 'open calculator', 'open my project', 'open application', 'switch window', 'close application', 'open '],
    },
  ]

  for (const group of keywordGroups) {
    for (const keyword of group.keywords) {
      if (text.includes(keyword)) {
        const agent = group.ids[0]
        const confidence = text.length < 20 ? 'medium' : 'high'
        return { agentId: agent, confidence }
      }
    }
  }

  return { agentId: 'core', confidence: 'low' }
}
