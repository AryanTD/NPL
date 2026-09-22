# Changelog

One entry per completed topic. See [V2.md](V2.md) for the roadmap.

## Unreleased

- **Migration history rescued.** `apps/server/prisma/migrations/` was gitignored, leaving eight
  of ten migrations on a single machine and the repo unable to reproduce its own schema. All ten
  are now tracked and verified to replay into `schema.prisma` with no drift.
- **Environment variables documented.** `apps/web/.env.example` added; `DIRECT_URL` added to the
  server example; the unused `ANTHROPIC_API_KEY` removed.
- **Planning docs.** `V2.md` (roadmap) and `CONTRIBUTING.md` (how topics are built) added;
  `TASKS.md` retired.
