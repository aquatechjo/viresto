// One line for a caught error, safe to print to the server log.
//
// Never log a raw error object: SDK errors carry the request they failed
// on, headers included. On 2026-11-13 a Polar API error that apiHandler
// passed whole to console.error printed the request's Authorization
// header (the Polar token) to the dev server log; on
// Vercel the same path would print the production token.
//
// describeError keeps the error's name, HTTP status, code, message and a
// few stack frames, and redacts bearer tokens, Polar tokens and email
// addresses from all of them. Nothing else of the object is read.

const MAX_MESSAGE = 400;
const MAX_FRAMES = 4;

const REDACTIONS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]"],
  [/\bpolar_[a-z]{2,4}_[A-Za-z0-9]+/g, "[polar-token]"],
  [/\b(?:sk|pk|rk|whsec)_(?:live|test)?_?[A-Za-z0-9]{8,}/g, "[secret]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
];

export function redactSecrets(text: string): string {
  return REDACTIONS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return redactSecrets(String(error)).slice(0, MAX_MESSAGE);
  }

  const fields = error as Error & { statusCode?: unknown; status?: unknown; code?: unknown };
  const status = typeof fields.statusCode === "number" ? fields.statusCode : typeof fields.status === "number" ? fields.status : null;
  const code = typeof fields.code === "string" || typeof fields.code === "number" ? fields.code : null;

  const head = [
    error.name || "Error",
    status !== null ? `status=${status}` : null,
    code !== null ? `code=${code}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const message = redactSecrets(error.message ?? "").slice(0, MAX_MESSAGE);
  const frames = (error.stack ?? "")
    .split("\n")
    .filter((line) => line.trim().startsWith("at "))
    .slice(0, MAX_FRAMES)
    .map((line) => redactSecrets(line.trim()));

  return [`${head}: ${message}`, ...frames.map((frame) => `    ${frame}`)].join("\n");
}
