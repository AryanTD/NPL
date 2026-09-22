# How we build NPL v2

One developer plus an AI pair, a two-month deadline, and two goals: real users, and a repo
that stands up as portfolio evidence. This process is sized for that — no ceremony that
exists to coordinate a team we don't have.

A guiding principle: **the artifacts this process produces are themselves part of the
deliverable.** Design notes, commit history and PR descriptions are read by hiring managers.
They cost little if built into the loop, and can't be reconstructed afterwards.

---

## The loop, per topic

Topics are defined in [V2.md](V2.md) and picked off in order, one at a time.

1. **Name the topic.** The developer picks the next one.
2. **Branch.** `<type>/<short-description>` — e.g. `fix/track-prisma-migrations`,
   `feat/squad-rating`. Use the conventional-commit type that fits the work. Branch names
   describe the change, not the roadmap position; cut from an up-to-date `main`.
3. **Discuss.** Every decision point gets resolved before any code is written. This is the
   part that takes real thought; it is not a formality.
4. **Design note.** Decisions land in `docs/design/topic-N-short-name.md`: the problem, the
   chosen approach, what was rejected and why, and the acceptance criteria.
5. **Plan the checkpoints.** The commit sequence is written out *before* coding, so progress
   is legible in advance rather than discovered afterwards.
6. **Build.** Stop after the first checkpoint to confirm direction, then run the rest through.
7. **Commit message.** Generate it from the staged diff with `/gen-commit-msg` rather than
   writing it freehand, so the message reflects what actually changed.
8. **PR** against `main`, with a description covering what changed, why, and how it was verified.
9. **Merge, deploy, update** `V2.md` and `CHANGELOG.md`.

---

## Checkpoints

A checkpoint is a commit that:

- leaves the repo in a **working state** — typecheck passes, tests pass
- is **one coherent unit** of the topic, describable in a single sentence with no "and"
- is **substantial** — not "added a file", not "fixed a typo"

Checkpoints are enumerated in the plan before coding starts. A small topic may legitimately
be a single commit; a large one should not be. The test is whether a reviewer can read the
commits in order and follow the reasoning.

---

## Rules

**WIP limit of one.** One topic in flight. It gets finished and merged before the next starts.
Branch sprawl is the characteristic solo-developer failure and it hides the true state of the work.

**Acceptance criteria before code.** Written in the design note at step 4. This is what makes
"done" a fact rather than a feeling, and it is the main defence against scope creep.

**Deploy after every topic.** `main` is never left undeployed. With a launch deadline, the worst
failure mode is discovering during launch week that several topics' changes don't work together
in production.

**Conventional commits.** `feat(scope):`, `fix(scope):`, `docs(scope):`, `test(scope):`,
`chore(scope):` — consistent with the existing history.

**No tooling attribution.** Commit messages and PR descriptions carry no co-author trailers,
no tool names, no generated-by footers. The history reads as the author's work, because it is —
every commit here was designed, reviewed and accepted by a person.

**Keep CLAUDE.md true.** It is the context loaded at the start of every AI session. When it
drifts, the advice degrades. Any change to architecture or conventions updates it in the same PR.

---

## Definition of Done

A topic is done when all of the following hold:

- [ ] Merged to `main` via PR
- [ ] Deployed and verified live
- [ ] Acceptance criteria from the design note are met
- [ ] `V2.md` and `CHANGELOG.md` updated
- [ ] `CLAUDE.md` updated if architecture or conventions changed

---

## Scheduling

Only the *user* goal carries a hard date — the NPL season launch window. The job goal does not.
So if the schedule slips, the topics to let slide past launch are **4 (engine tests)** and
**7 (endgame polish)**. Topics **2, 6 and 8** are load-bearing for launch and do not slip.

Decided in advance, deliberately, while not under pressure.

| Phase | Topics | Focus |
| --- | --- | --- |
| Weeks 1–2 | 1–3 | Foundation — cheap, unblocking, gets CI protecting everything after |
| Weeks 3–5 | 4–6 | The substantive build — tests and the rating engine |
| Weeks 6–7 | 7–8 | Endgame polish and the share loop |
| Week 8 | 9 | Launch, with slack |

---

## Deliberately not doing

Story points, velocity tracking, burndown charts, sprint ceremonies, retrospectives with
oneself, estimation rituals. All exist to coordinate teams and forecast for stakeholders.
The rough estimates already in [V2.md](V2.md) are sufficient.
