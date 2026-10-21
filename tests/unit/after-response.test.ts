import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// runAfterResponse hands the task to Next's after() inside a request, and
// runs it inline only where after() reports there is no request scope.

let afterImpl: (task: () => Promise<void>) => void = () => undefined;

mock.module("next/server", {
  namedExports: {
    after: (task: () => Promise<void>) => afterImpl(task),
  },
});

let runAfterResponse: (typeof import("../../src/lib/after-response"))["runAfterResponse"];

before(async () => {
  ({ runAfterResponse } = await import("../../src/lib/after-response"));
});

let ran = 0;
const task = async () => {
  ran++;
};

beforeEach(() => {
  ran = 0;
});

test("inside a request the task goes to after() and does not run before the response", async () => {
  const scheduled: (() => Promise<void>)[] = [];
  afterImpl = (fn) => {
    scheduled.push(fn);
  };

  await runAfterResponse(task);

  assert.equal(ran, 0);
  assert.equal(scheduled.length, 1);

  await scheduled[0]();
  assert.equal(ran, 1);
});

test("outside a request scope the task runs inline and is awaited", async () => {
  afterImpl = () => {
    throw new Error("`after` was called outside a request scope. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context");
  };

  await runAfterResponse(task);

  assert.equal(ran, 1);
});

test("any other after() failure is not swallowed", async () => {
  afterImpl = () => {
    throw new Error("something else");
  };

  await assert.rejects(runAfterResponse(task), /something else/);
  assert.equal(ran, 0);
});
