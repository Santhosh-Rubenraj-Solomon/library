/**
 * Minimal in-memory stand-in for the TypeORM repositories exposed by src/db.ts.
 *
 * It intentionally mirrors the TypeORM 0.3 semantics the route handlers rely on:
 *  - `where` keys whose value is `undefined` / `null` are IGNORED (no condition),
 *    exactly like TypeORM 0.3 — this matters for several documented bugs.
 *  - FindOperators `In(...)` and `ILike(...)` are supported; ILike follows SQL
 *    LIKE rules (`%` = any run, `_` = any single char), case-insensitive.
 *  - `order: { col: "ASC" | "DESC" }`.
 *  - `update(idOrCriteria, partial)` skips `undefined` values.
 *  - `save()` fills uuid primary keys, column defaults and CreateDateColumns.
 */
import { randomUUID } from "crypto";
import { FindOperator } from "typeorm";

type Row = Record<string, any>;

interface EntityMeta {
  pk: string;
  defaults: () => Row;
  createDate?: string;
}

const META: Record<string, EntityMeta> = {
  library: {
    pk: "bookId",
    defaults: () => ({ available: true, updatedAt: null }),
    createDate: "createdAt",
  },
  lendrecords: {
    pk: "lendId",
    defaults: () => ({ returnDate: null, dueDate: null, returned: false }),
  },
  userrecords: {
    pk: "userId",
    defaults: () => ({ visitCount: 0 }),
    createDate: "createdAt",
  },
  reservationrecords: {
    pk: "reservationId",
    defaults: () => ({ status: "waiting" }),
    createDate: "createdAt",
  },
};

// Monotonic clock so createdAt ordering is deterministic within a test.
let tick = Date.UTC(2025, 0, 1);
const nextCreatedAt = () => new Date((tick += 1000));

function likeToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.replace(/%/g, ".*").replace(/_/g, ".") + "$", "i");
}

function matchValue(actual: any, expected: any): boolean {
  if (expected instanceof FindOperator) {
    switch (expected.type) {
      case "in":
        return (expected.value as any[]).includes(actual);
      case "ilike":
        return typeof actual === "string" && likeToRegex(String(expected.value)).test(actual);
      default:
        throw new Error(`fake-db: unsupported FindOperator ${expected.type}`);
    }
  }
  return actual === expected;
}

function matches(row: Row, where?: Row): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (v === undefined || v === null) return true; // TypeORM 0.3: ignored
    return matchValue(row[k], v);
  });
}

const clone = <T>(v: T): T => (v == null ? v : { ...(v as any) });

export class FakeRepository {
  rows: Row[] = [];
  constructor(private readonly meta: EntityMeta) {}

  private select(opts: any = {}): Row[] {
    let out = this.rows.filter((r) => matches(r, opts.where));
    if (opts.order) {
      const [[col, dir]] = Object.entries(opts.order) as [string, string][];
      const sign = String(dir).toUpperCase() === "DESC" ? -1 : 1;
      out = [...out].sort((a, b) => (a[col] > b[col] ? sign : a[col] < b[col] ? -sign : 0));
    }
    return out;
  }

  async find(opts?: any) {
    return this.select(opts).map(clone);
  }

  async findOne(opts?: any) {
    return clone(this.select(opts)[0] ?? null);
  }

  create(obj: Row) {
    return { ...obj };
  }

  async save(obj: Row) {
    const pk = this.meta.pk;
    const existing = obj[pk] ? this.rows.find((r) => r[pk] === obj[pk]) : undefined;
    if (existing) {
      Object.assign(existing, obj);
      return clone(existing);
    }
    const row: Row = { ...this.meta.defaults(), ...obj, [pk]: obj[pk] ?? randomUUID() };
    if (this.meta.createDate && !row[this.meta.createDate]) row[this.meta.createDate] = nextCreatedAt();
    this.rows.push(row);
    return clone(row);
  }

  private resolve(criteria: any): Row[] {
    if (typeof criteria === "string") return this.rows.filter((r) => r[this.meta.pk] === criteria);
    return this.rows.filter((r) => matches(r, criteria));
  }

  async update(criteria: any, partial: Row) {
    const targets = this.resolve(criteria);
    const defined = Object.fromEntries(Object.entries(partial).filter(([, v]) => v !== undefined));
    targets.forEach((r) => Object.assign(r, defined));
    return { generatedMaps: [], raw: [], affected: targets.length };
  }

  async delete(criteria: any) {
    const targets = new Set(this.resolve(criteria));
    this.rows = this.rows.filter((r) => !targets.has(r));
    return { raw: [], affected: targets.size };
  }

  /** Test helper: insert directly, applying defaults. */
  seed(obj: Row) {
    const pk = this.meta.pk;
    const row: Row = { ...this.meta.defaults(), ...obj, [pk]: obj[pk] ?? randomUUID() };
    if (this.meta.createDate && !row[this.meta.createDate]) row[this.meta.createDate] = nextCreatedAt();
    this.rows.push(row);
    return row;
  }
}

export const fakeDb = {
  library: new FakeRepository(META.library),
  lendrecords: new FakeRepository(META.lendrecords),
  userrecords: new FakeRepository(META.userrecords),
  reservationrecords: new FakeRepository(META.reservationrecords),
};

export function resetFakeDb() {
  Object.values(fakeDb).forEach((repo) => (repo.rows = []));
}
