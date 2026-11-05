import { randomBytes } from "node:crypto";
import { slugify } from "@/lib/utils";

const RANDOM_SLUG_LENGTH = 8;

/** `length` random base36 characters (a-z, 0-9). */
function randomBase36(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const byte of bytes) out += (byte % 36).toString(36);
  return out;
}

/**
 * The slug of a new office, before the uniqueness suffix: its name's
 * Latin letters and digits, or `office-<8 random base36>` when the name
 * has none (an Arabic name, which slugify would otherwise reduce to
 * dashes). Internal only (admin page and search, export file name):
 * never in a public link, so it need not read like the name.
 */
export function tenantSlugBase(name: string): string {
  return slugify(name) || `office-${randomBase36(RANDOM_SLUG_LENGTH)}`;
}
