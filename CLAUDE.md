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
