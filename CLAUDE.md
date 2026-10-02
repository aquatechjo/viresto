# Viresto — instructions for Claude

Read `PROJECT_STATUS.md` at the start of a session: it is the running record
of what is done, in progress, and waiting on the user.

## Standing rule: keep PROJECT_STATUS.md in sync after every push

After every push, update `PROJECT_STATUS.md` before finishing the task:

- Mark completed work as done, with the commit hash(es) and a one-line
  description of each commit.
- Update what is in progress and what is next.
- Note any decisions, deviations from the plan, or bugs found along the way.
- Note anything left open or waiting on the user.

Commit the status update as its own commit, with the message
`docs: update PROJECT_STATUS`, and push it too, so the file on origin
always matches the code. Never mix status updates into feature or fix
commits.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
