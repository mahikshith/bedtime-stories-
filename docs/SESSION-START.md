# Starting a new session cheaply

Context is the scarce resource. A session that re-reads everything burns a large
share of the budget before doing any work.

## What loads automatically

Only **`CLAUDE.md`** (~85 lines). Everything else is read on demand. That is the
whole design: keep `CLAUDE.md` small and let it route.

## The opening message that works

> Read `docs/HANDOVER.md` and continue. Don't read the research docs unless the
> task needs them.

That is usually enough. `HANDOVER.md` carries current state, the decisions
already made, the next actions, and the bugs that already bit us.

## Rules of thumb

- **Don't re-run the research.** `RESEARCH.md` and `RESEARCH-PLATFORM.md` are
  finished work with sources. Cite them; don't rebuild them.
- **Don't re-read files you just wrote.** The edit tools fail loudly on error.
- **Don't dump whole files** into context to make a one-line change. Grep for
  the symbol, read the range.
- **Trust the tests.** `npm test` answers "is it still working?" in one call and
  a handful of tokens. Reading source to check does not.
- **Ask for a narrow task.** "Add the image manifest" costs a fraction of
  "continue the project".

## When finishing a session

Update `docs/HANDOVER.md` — state, what changed, what's next, any new gotcha —
and add to `docs/DECISIONS.md` if something was settled. Keep both terse. These
files exist to save the next session's budget, so bloating them defeats them.
