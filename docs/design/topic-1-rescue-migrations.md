# Topic 1 — Rescue the lost migrations

## Problem

`.gitignore:15` ignores `apps/server/prisma/migrations/`. Two migrations were committed before
that rule landed; the other eight exist **only on the author's laptop**.

Three consequences:

1. **Single point of failure.** The schema's change history has exactly one copy. Losing the
   machine means hand-reconstructing it from the live database.
2. **The repo is not reproducible, and fails quietly.** A clone applies the two tracked
   migrations and stops without error. The result is a database missing the
   `SquadSlot → LobbySeat` relation and the per-lobby unique constraint on `AuctionResult`,
   but *with* `add_player_quality` applied on top — because the tracked pair is not even a
   contiguous prefix. Two untracked migrations dated `20260429` sit between them. The app then
   fails at runtime in ways that don't point back to the cause.
3. **CI can never touch a database.** Topics 3 and 4 need automated tests, and testing the
   auction engine needs a real schema to build. Without migrations in git, CI is limited to
   typechecking permanently.

## Findings

Verified before deciding, not assumed:

- **Production is clean.** `_prisma_migrations` on Neon holds exactly the 10 names present on
  disk — all finished, none rolled back, one step each. No orphan or failed entries. (The first
  five share a `2026-06-15 20:58` timestamp, consistent with the Railway → Neon move replaying
  them in one pass.)
- **The two hand-written migrations look replay-safe.**
  `fix_auction_result_unique_per_lobby` uses `DROP ... IF EXISTS` throughout;
  `add_lobby_seat_relation` does backfill-then-`SET NOT NULL`, which is a no-op on an empty
  database. This is inspection, not proof — hence the verification step below.
- **Local PostgreSQL 17.9 is running** (Homebrew, port 5432) and the current role has
  `CREATEDB`. Verification needs no cloud resources and no credentials.

## Decision

**Preserve all 10 migrations. Do not squash.**

Production already records all 10 names. A squash would leave prod unable to recognise its own
history, requiring a manual `prisma migrate resolve --applied` to baseline — a step that breaks
future deploys if done wrong. Preserving is both safer and the more honest history.

**Verify by replaying into a scratch local database**, then diffing the result against
`schema.prisma`. Committing migrations that don't replay is *worse* than the status quo: today
the repo is visibly broken, whereas a bad commit would make it claim reproducibility it doesn't
have — a far harder failure to diagnose.

## Rejected

| Option | Why not |
|---|---|
| Squash into one init migration | Desyncs production's `_prisma_migrations`; needs manual baselining; discards real schema history |
| Verify on a Neon scratch branch | More faithful (same platform), but needs auth and a branch slot for no gain over local Postgres on a schema with no Neon-specific extensions |
| Verify in a Docker container | Docker is installed but not running, and it is redundant while a local server is already up |
| Skip verification | Takes the topic to ~10 minutes, but a bad replay would then surface in Topic 3's CI or in a stranger's clone |
| Wire `prisma migrate deploy` into the Render build | Changes production deploy behaviour with no CI safety net yet; a failed migration would break deploys. Belongs in Topic 3 |

## Acceptance criteria

- [ ] All 10 migration directories are tracked in git
- [ ] `.gitignore` no longer ignores `apps/server/prisma/migrations/`
- [ ] A database built **from the migrations alone** shows zero drift against `schema.prisma`
      (`prisma migrate diff --exit-code` returns 0)
- [ ] `apps/server/.env.example` lists every variable the server reads, including `DIRECT_URL`
- [ ] `apps/web/.env.example` exists and lists every variable the web app reads
- [ ] No secrets are committed — examples carry placeholders only
- [ ] `npm run typecheck` passes at the repo root

## Checkpoints

1. **`docs:`** — replace the stale task board with the v2 planning docs
   (`V2.md`, `CONTRIBUTING.md`, this design note; delete `TASKS.md`)
2. **`fix(prisma):`** — track the full migration history
   (`.gitignore` line 15 removed, 8 migration directories added, replay verified)
3. **`docs(env):`** — document every environment variable both apps need
4. **`docs(claude):`** — correct stale claims about bots, migrations and repo layout

## Verification

```bash
createdb npl_migration_check
cd apps/server && npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "postgresql://$USER@localhost:5432/npl_migration_check" \
  --exit-code
dropdb npl_migration_check
```

Exit code 0 means the migrations reproduce `schema.prisma` exactly. Exit code 2 means drift —
the migrations and the schema disagree, and the topic is not done.

## Out of scope

- Deploy automation (Topic 3)
- Deleting the stale `railway.toml` and closing the superseded PR #3 (Topic 3 cleanup)
- `NewTask.md` — stale keep-warm spec, consumed by Topic 2
