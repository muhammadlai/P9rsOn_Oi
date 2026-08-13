import { describe, expect, it } from 'vitest'
import { PermissionEngine } from '../modules/permissions/engine'
import {
  createActivityLog,
  sanitizeSecrets,
} from '../modules/activity/log'
import { createTaskManager } from '../modules/tasks/manager'
import { createClientManager } from '../modules/crm/manager'
import { routeIntent, getAgent, listAgents } from '../modules/agents/registry'
import { ZARA_IDENTITY } from '../modules/identity'

describe('ZARA identity', () => {
  it('identifies ZARA and Aitzaz', () => {
    expect(ZARA_IDENTITY.assistant).toBe('ZARA')
    expect(ZARA_IDENTITY.owner).toBe('AITZAZ')
    expect(ZARA_IDENTITY.role).toContain('AI Operating System')
  })
})

describe('permission engine', () => {
  const engine = new PermissionEngine()

  it('allows safe actions automatically', () => {
    expect(engine.classify('perform_web_search')).toBe('safe')
    expect(engine.isAllowed('open_path')).toBe(true)
    expect(engine.request('get_current_datetime', '').required).toBe(false)
  })

  it('requires approval for consequential actions', () => {
    expect(engine.classify('github_push')).toBe('approval')
    expect(engine.request('send_email', 'client@x.com').required).toBe(true)
    expect(engine.request('delete_file', '/a/b').risk).toBe('approval')
  })

  it('defaults unknown actions to approval (fail-safe)', () => {
    expect(engine.classify('unknown_action_xyz')).toBe('approval')
  })

  it('supports registering custom rules', () => {
    const e = new PermissionEngine({
      rules: [{ action: 'my_custom_tool', risk: 'safe', reason: 'safe' }],
    })
    expect(e.isAllowed('my_custom_tool')).toBe(true)
  })
})

describe('activity log', () => {
  it('records entries with secrets redacted', () => {
    const log = createActivityLog()
    log.add({
      userCommand: 'use key sk-abcdefghij1234567890',
      intent: 'system',
      tool: 'execute_command',
      action: 'run',
      result: 'SUCCESS',
    })
    const entries = log.all()
    expect(entries).toHaveLength(1)
    expect(entries[0].userCommand).toContain('[REDACTED]')
    expect(entries[0].userCommand).not.toContain('sk-abcdefghij')
  })

  it('respects the entry limit', () => {
    const log = createActivityLog(3)
    for (let i = 0; i < 10; i++) {
      log.add({
        userCommand: `cmd ${i}`,
        intent: 'system',
        tool: 'x',
        action: 'a',
        result: 'SUCCESS',
      })
    }
    expect(log.all()).toHaveLength(3)
  })

  it('sanitizes common secret formats', () => {
    expect(sanitizeSecrets('token sk-abcdefghij1234567890 here')).toContain(
      '[REDACTED]'
    )
    expect(sanitizeSecrets('AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz0123456789 x')).toContain(
      '[REDACTED]'
    )
  })
})

describe('task manager', () => {
  it('adds, lists and completes tasks', () => {
    const tm = createTaskManager()
    tm.clear()
    const t = tm.add({ title: 'Prepare proposal', priority: 'high' })
    expect(tm.all()).toHaveLength(1)
    tm.complete(t.id)
    expect(tm.pending()).toHaveLength(0)
    expect(tm.all()[0].status).toBe('done')
    tm.clear()
  })

  it('sorts pending by priority', () => {
    const tm = createTaskManager()
    tm.clear()
    tm.add({ title: 'low task', priority: 'low' })
    tm.add({ title: 'high task', priority: 'high' })
    const pending = tm.pending()
    expect(pending[0].title).toBe('high task')
    tm.clear()
  })
})

describe('client/CRM manager', () => {
  it('tracks leads with status', () => {
    const cm = createClientManager()
    cm.clear()
    cm.add({ company: 'Acme', service: 'AI automation', status: 'NEW' })
    cm.add({
      company: 'Globex',
      service: 'Web dev',
      status: 'NEGOTIATING',
      nextFollowUp: '2026-08-13',
    })
    expect(cm.byStatus('NEW')).toHaveLength(1)
    const due = cm.followUpsDue('2026-08-13')
    expect(due).toHaveLength(1)
    expect(due[0].company).toBe('Globex')
    cm.clear()
  })
})

describe('agent registry & routing', () => {
  it('defines the full agent roster', () => {
    const ids = listAgents().map(a => a.id)
    expect(ids).toContain('core')
    expect(ids).toContain('coding')
    expect(ids).toContain('github')
    expect(ids).toContain('job')
    expect(ids).toContain('client')
    expect(ids).toContain('memory')
  })

  it('routes intent keywords to the right agent', () => {
    expect(routeIntent('Zara, remember my name is Aitzaz').agentId).toBe('memory')
    expect(routeIntent('Help me find a remote job').agentId).toBe('job')
    expect(routeIntent('Open Google').agentId).toBe('browser')
    expect(routeIntent('Show me git status').agentId).toBe('github')
    expect(routeIntent('fix this bug in my code').agentId).toBe('coding')
  })

  it('provides agent metadata', () => {
    const core = getAgent('core')
    expect(core?.readyState).toBe('ready')
  })
})
