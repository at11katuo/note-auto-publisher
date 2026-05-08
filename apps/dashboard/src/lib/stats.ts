import { prisma } from '@note/db';

export type DashboardStats = {
  ideas: {
    total: number;
    new: number;
    used: number;
    skipped: number;
  };
  drafts: {
    total: number;
    draft: number;
    approved: number;
    published: number;
    rejected: number;
  };
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [ideaGroups, draftGroups] = await Promise.all([
    prisma.idea.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.draft.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const ideaCount = (status: string) =>
    ideaGroups.find((g) => g.status === status)?._count._all ?? 0;
  const draftCount = (status: string) =>
    draftGroups.find((g) => g.status === status)?._count._all ?? 0;

  const ideaTotal = ideaGroups.reduce((s, g) => s + g._count._all, 0);
  const draftTotal = draftGroups.reduce((s, g) => s + g._count._all, 0);

  return {
    ideas: {
      total: ideaTotal,
      new: ideaCount('new'),
      used: ideaCount('used'),
      skipped: ideaCount('skipped'),
    },
    drafts: {
      total: draftTotal,
      draft: draftCount('draft'),
      approved: draftCount('approved'),
      published: draftCount('published'),
      rejected: draftCount('rejected'),
    },
  };
}
