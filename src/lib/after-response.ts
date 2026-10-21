import { after } from "next/server";

// Runs a task after the response is sent. On Vercel, after() keeps the
// function alive (waitUntil) until the task settles, so the work finishes
// even though the client already has its answer.
//
// Outside a Next.js request scope (route handlers called directly by the
// integration tests, scripts) after() throws; there the task runs inline
// and is awaited, so callers see the same side effects as before.
//
// The task must handle its own errors: nothing is left to report them to
// once the response is gone.
export async function runAfterResponse(task: () => Promise<void>) {
  try {
    after(task);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("called outside a request scope")
    ) {
      await task();
      return;
    }

    throw error;
  }
}
