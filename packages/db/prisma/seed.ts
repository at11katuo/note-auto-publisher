import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const idea1 = await prisma.idea.create({
    data: {
      source: 'rss',
      sourceUrl: 'https://example.com/article/nisa-2024',
      title: '【2024年】新NISAの成長投資枠を最大活用する方法',
      summary:
        '2024年から始まった新NISAの成長投資枠を使って、ETFや個別株に投資する方法を解説します。年間240万円まで非課税で運用できる成長投資枠の活用術。',
      rawContent: null,
      topics: JSON.stringify(['nisa', 'etf']),
      status: 'new',
    },
  })

  const idea2 = await prisma.idea.create({
    data: {
      source: 'rss',
      sourceUrl: 'https://example.com/article/eth-tax-2024',
      title: 'イーサリアムの税制と長期保有戦略【2024年版】',
      summary:
        '仮想通貨(暗号資産)の税制について、ETHを中心に解説。長期保有のメリットと確定申告の注意点。20.315%分離課税移行論の最新動向も。',
      rawContent: null,
      topics: JSON.stringify(['crypto', 'eth', 'tax']),
      status: 'new',
    },
  })

  await prisma.idea.create({
    data: {
      source: 'x',
      sourceUrl: 'https://twitter.com/i/web/status/1234567890',
      title: 'サイドFIREで月30万円生活を実現した話',
      summary: '36歳で週3勤務+副業のサイドFIREを実現。月30万円生活のリアルな収支内訳を公開します。',
      rawContent: 'サイドFIREで月30万円生活を実現した話。週3勤務+副業で...',
      topics: JSON.stringify(['fire', 'side-hustle']),
      status: 'new',
    },
  })

  await prisma.draft.create({
    data: {
      ideaId: idea1.id,
      title: '新NISAの成長投資枠完全ガイド：ETFで長期資産形成を始める方法',
      body: [
        '## はじめに',
        '',
        '2024年から新しいNISA制度が始まりました。36歳の電気エンジニアとして夜勤をこなしながら、2人の子供のために資産形成を続けている私が、新NISAの成長投資枠について徹底解説します。',
        '',
        '## 成長投資枠とは',
        '',
        '年間240万円まで投資でき、利益が非課税になります...',
        '',
        '## おすすめETF',
        '',
        'eMAXIS Slim 全世界株式(オール・カントリー)が王道です...',
        '',
        '---',
        '*本記事は情報提供を目的としており、投資を推奨するものではありません。投資判断はご自身の責任で行ってください。*',
      ].join('\n'),
      tags: JSON.stringify(['NISA', 'ETF', '資産形成', '長期投資']),
      charCount: 2500,
      status: 'draft',
      llmModel: 'claude-sonnet-4-5',
      promptVersion: 'v1.0',
    },
  })

  console.log('Seed complete:', {
    ideas: [idea1.id, idea2.id],
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
