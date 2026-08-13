/**
 * ZARA AI 2070 — central permission/approval engine.
 *
 * Every potentially consequential action passes through this engine. Safe,
 * read-only actions run automatically. Actions that could send data, delete,
 * purchase, or otherwise have meaningful consequences require explicit
 * approval from Aitzaz.
 *
 * The engine is data-driven so new tools/agents can declare their risk level
 * without rewriting the core.
 */

export type RiskLevel = 'safe' | 'review' | 'approval'

export interface PermissionRule {
  /** Tool or action identifier (e.g. 'open_path', 'github.push'). */
  action: string
  risk: RiskLevel
  reason: string
}

export interface ApprovalRequest {
  action: string
  reason: string
  target: string
  risk: 'safe' | 'review' | 'approval'
  /** Whether approval is required before executing. */
  required: boolean
}

const DEFAULT_SAFE = new Set<string>([
  'open_path',
  'open_website',
  'perform_web_search',
  'searxng_web_search',
  'browser_context',
  'get_current_datetime',
  'get_calendar_events',
  'get_unread_emails',
  'search_emails',
  'get_email_content',
  'list_directory',
  'recall_memories',
  'get_recent_memories',
  'manage_clipboard',
  'search_torrents',
  'explain_code',
  'read_file',
  'search_files',
  'git_status',
  'git_diff',
  'analyze_screen',
  'take_screenshot',
])

const DEFAULT_REVIEW = new Set<string>([
  'save_memory',
  'update_memory',
  'schedule_task',
  'manage_scheduled_tasks',
  'browser_back',
  'browser_forward',
  'new_tab',
  'refresh_page',
  'switch_window',
  'open_application',
  'close_application',
  'run_safe_task',
  'analyze_camera',
  'create_file',
])

const DEFAULT_APPROVAL = new Set<string>([
  'execute_command',
  'create_calendar_event',
  'update_calendar_event',
  'delete_calendar_event',
  'delete_memory',
  'clear_memory',
  'close_tab',
  'send_email',
  'send_message',
  'github_push',
  'github_commit',
  'create_release',
  'delete_file',
  'edit_file',
  'write_code',
  'submit_application',
  'change_settings',
  'purchase',
  'add_torrent_to_qb',
])

export interface PermissionEngineOptions {
  /** Extra rules to merge in (e.g. custom tools). */
  rules?: PermissionRule[]
}

export class PermissionEngine {
  private safe: Set<string>
  private review: Set<string>
  private approval: Set<string>

  constructor(options: PermissionEngineOptions = {}) {
    this.safe = new Set(DEFAULT_SAFE)
    this.review = new Set(DEFAULT_REVIEW)
    this.approval = new Set(DEFAULT_APPROVAL)
    for (const rule of options.rules ?? []) {
      if (rule.risk === 'safe') this.safe.add(rule.action)
      else if (rule.risk === 'review') this.review.add(rule.action)
      else this.approval.add(rule.action)
    }
  }

  classify(action: string): RiskLevel {
    if (this.approval.has(action)) return 'approval'
    if (this.review.has(action)) return 'review'
    // Unknown actions default to approval (fail-safe).
    if (this.safe.has(action)) return 'safe'
    return 'approval'
  }

  /** Build an ApprovalRequest for a given action. */
  request(action: string, target: string): ApprovalRequest {
    const risk = this.classify(action)
    return {
      action,
      target,
      risk,
      required: risk === 'approval',
      reason: this.reasonFor(action, risk),
    }
  }

  /** Whether an action may run without approval. */
  isAllowed(action: string): boolean {
    return this.classify(action) === 'safe'
  }

  registerRule(rule: PermissionRule): void {
    if (rule.risk === 'safe') this.safe.add(rule.action)
    else if (rule.risk === 'review') this.review.add(rule.action)
    else this.approval.add(rule.action)
  }

  private reasonFor(action: string, risk: RiskLevel): string {
    switch (risk) {
      case 'safe':
        return 'Read-only or low-risk action; runs automatically.'
      case 'review':
        return 'This action changes local state; shown for visibility.'
      default:
        return 'This action can send data, delete, or otherwise have consequences and requires approval.'
    }
  }
}

export const defaultPermissionEngine = new PermissionEngine()
