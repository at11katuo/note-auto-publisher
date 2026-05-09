import { parseArgs } from 'node:util'
import { createLogger } from '@note/logger'
import { prisma } from '@note/db'
import { closeBrowser, launchBrowser, type BrowserSession } from './browser.js'
import { ensureLoggedIn } from './login.js'
import { createDraftOnNote } from './post.js'

const log = createLogger('publisher:cli')

function parseTags(rawJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(rawJson)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0)
  } catch (e) {
    log.warn({ err: e }, 'failed to parse draft.tags as JSON')
    return []
  }
}

async function safeCloseBrowser(session: BrowserSession): Promise<void> {
  const r = await closeBrowser(session)
  if (r.isErr()) log.warn({ err: r.error }, 'browser close failed')
}

async function runLoginOnly(): Promise<number> {
  log.info('mode=login-only')
  const launched = await launchBrowser({ headless: process.env['PLAYWRIGHT_HEADLESS'] !== 'false' })
  if (launched.isErr()) {
    log.error({ err: launched.error }, 'browser launch failed')
    return 1
  }
  const session = launched.value
  try {
    const r = await ensureLoggedIn(session.page)
    if (r.isErr()) {
      log.error({ err: r.error }, 'login failed')
      return 1
    }
    log.info({ reused: r.value.reused }, 'login confirmed; session stored')
    return 0
  } finally {
    await safeCloseBrowser(session)
  }
}

async function runPublishDraft(draftId: string): Promise<number> {
  log.info({ draftId }, 'mode=publish-draft')

  const draft = await prisma.draft.findUnique({ where: { id: draftId } })
  if (!draft) {
    log.error({ draftId }, 'draft not found')
    return 1
  }
  if (draft.status !== 'approved' && draft.status !== 'publishing') {
    log.error(
      { draftId, status: draft.status },
      'draft is not approved — abort',
    )
    return 1
  }

  const launched = await launchBrowser({})
  if (launched.isErr()) {
    log.error({ err: launched.error }, 'browser launch failed')
    return 1
  }
  const session = launched.value

  try {
    const loginRes = await ensureLoggedIn(session.page)
    if (loginRes.isErr()) {
      log.error({ err: loginRes.error, draftId }, 'login failed')
      await prisma.publishLog.create({
        data: {
          draftId,
          action: 'failed',
          detail: `login: ${loginRes.error.message}`,
        },
      })
      return 1
    }

    await prisma.publishLog.create({
      data: { draftId, action: 'submitted', detail: null },
    })

    const tags = parseTags(draft.tags)
    const postRes = await createDraftOnNote(session.page, {
      title: draft.title,
      body: draft.body,
      tags,
    })

    if (postRes.isErr()) {
      log.error({ err: postRes.error, draftId }, 'createDraftOnNote failed')
      await prisma.draft.update({
        where: { id: draftId },
        data: { status: 'approved' },
      })
      await prisma.publishLog.create({
        data: {
          draftId,
          action: 'failed',
          detail: postRes.error.message,
        },
      })
      return 1
    }

    const { noteUrl } = postRes.value
    await prisma.draft.update({
      where: { id: draftId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        noteUrl,
      },
    })
    await prisma.publishLog.create({
      data: { draftId, action: 'succeeded', detail: noteUrl },
    })
    log.info({ draftId, noteUrl }, 'draft published')
    return 0
  } finally {
    await safeCloseBrowser(session)
    await prisma.$disconnect().catch(() => undefined)
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      'login-only': { type: 'boolean', default: false },
      'draft-id': { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  })

  if (values['login-only'] === true) {
    return runLoginOnly()
  }

  const draftId = values['draft-id']
  if (typeof draftId === 'string' && draftId.length > 0) {
    return runPublishDraft(draftId)
  }

  log.error('usage: publisher --login-only | --draft-id <id>')
  return 1
}

main()
  .then((code) => {
    process.exit(code)
  })
  .catch((err) => {
    log.error({ err }, 'unhandled error')
    process.exit(1)
  })
