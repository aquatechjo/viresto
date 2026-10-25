import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDate,
  formatInZone,
  toDateOnlyInputValue,
} from "@/lib/datetime";

// An invoice due date must survive "open edit, save without changes" on
// any machine zone. Run under several TZ values (see test:unit and
// PROJECT_STATUS): the result must not depend on the zone.
//
// The flow, step by step:
//   1. <input type="date"> sends "yyyy-MM-dd".
//   2. POST/PATCH /api/invoices parse it with new Date(value): a date-only
//      ISO string is UTC midnight by the ECMAScript spec.
//   3. The API returns it as JSON (an ISO string).
//   4. The edit page fills the input with toDateOnlyInputValue(...).
//   5. Saving sends that string back through step 2.

const machineZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Steps 2 and 3, as the invoice routes do them.
function saveAndLoad(input: string) {
  const stored = new Date(input);
  return JSON.parse(JSON.stringify({ dueDate: stored })).dueDate as string;
}

test(`due date 2026-10-26 stays 26 after an unchanged edit (machine zone ${machineZone})`, () => {
  const loaded = saveAndLoad("2026-10-26");
  assert.equal(loaded, "2026-10-26T00:00:00.000Z");

  const editValue = toDateOnlyInputValue(loaded);
  assert.equal(editValue, "2026-10-26");

  const reloaded = saveAndLoad(editValue);
  assert.equal(reloaded, loaded);

  // Shown in Amman as the same calendar day.
  assert.equal(
    formatInZone(reloaded, "en", { year: "numeric", month: "2-digit", day: "2-digit" }),
    "10/26/2026",
  );
  assert.match(formatDate(reloaded, "ar"), /^26 /);
});

test(`ten unchanged edits in a row keep every day of 2026 (machine zone ${machineZone})`, () => {
  for (let day = 0; day < 365; day += 1) {
    const original = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);

    let value = original;
    for (let edit = 0; edit < 10; edit += 1) {
      value = toDateOnlyInputValue(saveAndLoad(value));
    }

    assert.equal(value, original);
  }
});

test("empty and invalid due dates give an empty input", () => {
  assert.equal(toDateOnlyInputValue(null), "");
  assert.equal(toDateOnlyInputValue(undefined), "");
  assert.equal(toDateOnlyInputValue("not a date"), "");
});
