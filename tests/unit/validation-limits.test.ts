import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appointmentSchema,
  caseSchema,
  clientSchema,
  invoiceItemSchema,
  updateProfileSchema,
} from "@/lib/validations";

// Unbounded free text lets one request store megabytes per field, and
// unvalidated date strings reach the database layer as Invalid Date.

const long = (length: number) => "x".repeat(length);

const validCase = { clientId: "client-1", title: "Case title" };
const validClient = { name: "Client", phone: "0791234567", nationalId: "9991234567" };
const validAppointment = { title: "Hearing", startTime: "2026-10-01T09:00:00.000Z" };

test("case: title and short fields are capped at 200, description at 10,000", () => {
  assert.equal(caseSchema.safeParse(validCase).success, true);
  assert.equal(caseSchema.safeParse({ ...validCase, title: long(201) }).success, false);

  for (const field of ["caseNumber", "court", "judgeName", "plaintiffName", "defendantName"]) {
    assert.equal(caseSchema.safeParse({ ...validCase, [field]: long(200) }).success, true, field);
    assert.equal(caseSchema.safeParse({ ...validCase, [field]: long(201) }).success, false, field);
  }

  assert.equal(caseSchema.safeParse({ ...validCase, description: long(10_000) }).success, true);
  assert.equal(caseSchema.safeParse({ ...validCase, description: long(10_001) }).success, false);
});

test("client: address capped at 500, notes at 10,000, email at 160", () => {
  assert.equal(clientSchema.safeParse(validClient).success, true);
  assert.equal(clientSchema.safeParse({ ...validClient, address: long(501) }).success, false);
  assert.equal(clientSchema.safeParse({ ...validClient, notes: long(10_001) }).success, false);
  assert.equal(
    clientSchema.safeParse({ ...validClient, email: `${long(160)}@example.com` }).success,
    false,
  );
});

test("appointment: text capped; start/end must be real ISO date-times with a timezone", () => {
  assert.equal(appointmentSchema.safeParse(validAppointment).success, true);
  assert.equal(
    appointmentSchema.safeParse({ ...validAppointment, startTime: "2026-10-01T12:00:00+03:00" }).success,
    true,
  );

  for (const startTime of ["not a date", "2026-10-01T10:00", "2026-13-45T00:00:00Z", ""]) {
    assert.equal(appointmentSchema.safeParse({ ...validAppointment, startTime }).success, false, startTime);
  }
  assert.equal(
    appointmentSchema.safeParse({ ...validAppointment, endTime: "tomorrow" }).success,
    false,
  );

  assert.equal(appointmentSchema.safeParse({ ...validAppointment, title: long(201) }).success, false);
  assert.equal(appointmentSchema.safeParse({ ...validAppointment, location: long(301) }).success, false);
  assert.equal(
    appointmentSchema.safeParse({ ...validAppointment, description: long(10_001) }).success,
    false,
  );
});

test("invoice item description is capped at 500", () => {
  const item = { description: "Consultation", quantity: 1, unitPrice: 10 };
  assert.equal(invoiceItemSchema.safeParse(item).success, true);
  assert.equal(invoiceItemSchema.safeParse({ ...item, description: long(501) }).success, false);
});

test("profile name capped at 120, email at 160", () => {
  assert.equal(updateProfileSchema.safeParse({ name: long(121) }).success, false);
  assert.equal(updateProfileSchema.safeParse({ email: `${long(160)}@example.com` }).success, false);
  assert.equal(updateProfileSchema.safeParse({ name: "Lawyer" }).success, true);
});
