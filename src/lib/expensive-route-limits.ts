// Per-user limits on expensive authenticated routes (AUDIT_REPORT.md L9).
// Keyed by user id, not IP, so one account cannot hammer them from many
// addresses or sessions. High enough that a person typing never meets them.

const MINUTE = 60 * 1000;

// Type-ahead search in the top bar (debounced), one query per keystroke pause.
export const SEARCH_RATE_LIMIT = {
  keyPrefix: "search",
  windowMs: MINUTE,
  max: 60,
} as const;

// AI document summary: downloads the file and calls OpenAI. Same budget as
// the AI chat (20 per hour per user); the monthly token quota still applies.
export const SUMMARIZE_RATE_LIMIT = {
  keyPrefix: "doc-summarize",
  windowMs: 60 * MINUTE,
  max: 20,
} as const;
