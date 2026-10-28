import { Prisma } from "@prisma/client";
import { toLatinDigits } from "@/lib/digits";

// Arabic-insensitive matching for the global search. The same folding runs
// on the typed query (in JS) and on the stored columns (in PostgreSQL, at
// query time), so "أموال" finds "اموال" and the other way round, with no
// stored search column to keep in sync and no migration.
//
// Folding: أ إ آ ٱ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي; Arabic-Indic and
// Persian digits → 0-9; harakat, superscript alef and tatweel removed;
// Latin letters lowercased.

const FOLD_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["أ", "ا"],
  ["إ", "ا"],
  ["آ", "ا"],
  ["ٱ", "ا"],
  ["ى", "ي"],
  ["ة", "ه"],
  ["ؤ", "و"],
  ["ئ", "ي"],
  ..."٠١٢٣٤٥٦٧٨٩".split("").map((char, i) => [char, String(i)] as const),
  ..."۰۱۲۳۴۵۶۷۸۹".split("").map((char, i) => [char, String(i)] as const),
];

const FOLD_FROM = FOLD_PAIRS.map(([from]) => from).join("");
const FOLD_TO = FOLD_PAIRS.map(([, to]) => to).join("");
const FOLD_MAP = new Map(FOLD_PAIRS);

// Harakat (U+064B–U+065F), superscript alef (U+0670), tatweel (U+0640).
const STRIP_JS = /[ً-ٰٟـ]/g;
// Same class, written for PostgreSQL's regex engine.
const STRIP_SQL = "[\\u064B-\\u065F\\u0670\\u0640]";

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

/** The folded form of a query or a stored value. */
export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(STRIP_JS, "")
    .replace(/./gu, (char) => FOLD_MAP.get(char) ?? char)
    .replace(/\s+/g, " ")
    .trim();
}

export interface PreparedQuery {
  /** Trimmed text with Latin digits, as typed. */
  raw: string;
  /** Folded text, compared with folded columns. */
  needle: string;
  /** A positive whole number when the query is one (for publicId). */
  number: number | null;
}

/** null when the query is too short to search. */
export function prepareSearchQuery(
  input: string | null | undefined,
): PreparedQuery | null {
  const raw = toLatinDigits(input ?? "").trim().slice(0, SEARCH_MAX_LENGTH);
  const needle = normalizeSearchText(raw);

  if (needle.length < SEARCH_MIN_LENGTH) return null;

  const number = /^\d{1,9}$/.test(raw) ? Number(raw) : 0;

  return { raw, needle, number: number > 0 ? number : null };
}

/**
 * SQL that folds `expr` the way normalizeSearchText folds the query.
 * `expr` must be trusted SQL (column references), never user input.
 * Whitespace is not collapsed here; queries with runs of spaces still
 * match single-spaced text because the query side collapses them and
 * stored values are rarely double-spaced.
 */
export function normalizedSql(expr: Prisma.Sql) {
  return Prisma.sql`regexp_replace(translate(lower(${expr}), ${FOLD_FROM}, ${FOLD_TO}), ${STRIP_SQL}, '', 'g')`;
}

/** SQL: true when the folded `expr` contains the folded query `needle`. */
export function containsNormalized(expr: Prisma.Sql, needle: string) {
  return Prisma.sql`strpos(${normalizedSql(expr)}, ${needle}) > 0`;
}

/**
 * Several nullable text columns joined into one searchable string. The
 * newline separator can't occur in a query, so no match spans two fields.
 */
export function searchableFields(...exprs: Prisma.Sql[]) {
  return Prisma.sql`concat_ws(E'\\n', ${Prisma.join(exprs)})`;
}
