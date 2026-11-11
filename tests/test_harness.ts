/**
 * Lightweight, zero-dependency testing harness for The Spire v3.1 E2E Test Suite.
 * Compatible with Node.js 26 native `--experimental-strip-types` and `tsx`.
 */

export interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
  status: "pending" | "passed" | "failed";
  error?: Error;
  durationMs?: number;
}

export interface TestSuite {
  name: string;
  cases: TestCase[];
}

export function createSuiteRegistry() {
  const suites: TestSuite[] = [];
  let current: TestSuite | null = null;

  function describe(name: string, fn: () => void): void {
    const suite: TestSuite = { name, cases: [] };
    suites.push(suite);
    const prev = current;
    current = suite;
    try {
      fn();
    } finally {
      current = prev;
    }
  }

  function it(name: string, fn: () => void | Promise<void>): void {
    if (!current) {
      describe("Default Suite", () => it(name, fn));
      return;
    }
    current.cases.push({ name, fn, status: "pending" });
  }

  return {
    describe,
    it,
    test: it,
    getSuites: () => suites,
    run: async (title: string = "Test Run Summary") => {
      const results = await runSuites(suites);
      printSummary(results, title);
      return results.failed === 0;
    },
  };
}

const defaultRegistry = createSuiteRegistry();
export const describe = defaultRegistry.describe;
export const it = defaultRegistry.it;
export const test = defaultRegistry.test;
export const getActiveSuites = defaultRegistry.getSuites;

function deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

function safeStringify(val: any): string {
  if (typeof val === "bigint") return `${val.toString()}n`;
  try {
    return JSON.stringify(val, (_, v) => (typeof v === "bigint" ? `${v.toString()}n` : v));
  } catch {
    return String(val);
  }
}

export interface Expectation<T> {
  toBe(expected: T): void;
  toEqual(expected: any): void;
  toBeGreaterThan(expected: number | bigint): void;
  toBeGreaterThanOrEqual(expected: number | bigint): void;
  toBeLessThan(expected: number | bigint): void;
  toBeLessThanOrEqual(expected: number | bigint): void;
  toBeCloseTo(expected: number, delta?: number): void;
  toContain(expected: any): void;
  toMatch(pattern: RegExp | string): void;
  toThrow(expected?: string | RegExp): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  not: Expectation<T>;
}

export function expect<T = any>(actual: T, isNot: boolean = false): Expectation<T> {
  const matchers: Expectation<T> = {
    toBe(expected: T): void {
      const match = Object.is(actual, expected);
      if (isNot ? match : !match) {
        throw new Error(
          `Expected ${safeStringify(actual)} ${isNot ? "NOT to be" : "to be"} ${safeStringify(expected)}`
        );
      }
    },
    toEqual(expected: any): void {
      const match = deepEqual(actual, expected);
      if (isNot ? match : !match) {
        throw new Error(
          `Expected ${safeStringify(actual)} ${isNot ? "NOT to equal" : "to equal"} ${safeStringify(expected)}`
        );
      }
    },
    toBeGreaterThan(expected: number | bigint): void {
      const match = (actual as any) > expected;
      if (isNot ? match : !match) {
        throw new Error(`Expected ${actual} ${isNot ? "NOT to be >" : "to be >"} ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number | bigint): void {
      const match = (actual as any) >= expected;
      if (isNot ? match : !match) {
        throw new Error(`Expected ${actual} ${isNot ? "NOT to be >=" : "to be >="} ${expected}`);
      }
    },
    toBeLessThan(expected: number | bigint): void {
      const match = (actual as any) < expected;
      if (isNot ? match : !match) {
        throw new Error(`Expected ${actual} ${isNot ? "NOT to be <" : "to be <"} ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected: number | bigint): void {
      const match = (actual as any) <= expected;
      if (isNot ? match : !match) {
        throw new Error(`Expected ${actual} ${isNot ? "NOT to be <=" : "to be <="} ${expected}`);
      }
    },
    toBeCloseTo(expected: number, delta: number = 0.001): void {
      const diff = Math.abs((actual as any) - expected);
      const match = diff <= delta;
      if (isNot ? match : !match) {
        throw new Error(
          `Expected ${actual} ${isNot ? "NOT to be close to" : "to be close to"} ${expected} (diff: ${diff}, delta: ${delta})`
        );
      }
    },
    toContain(expected: any): void {
      let match = false;
      if (typeof actual === "string") {
        match = actual.includes(String(expected));
      } else if (Array.isArray(actual)) {
        match = actual.some((item) => deepEqual(item, expected));
      } else if (actual instanceof Set || actual instanceof Map) {
        match = (actual as any).has(expected);
      }
      if (isNot ? match : !match) {
        throw new Error(
          `Expected collection ${JSON.stringify(actual)} ${isNot ? "NOT to contain" : "to contain"} ${JSON.stringify(expected)}`
        );
      }
    },
    toMatch(pattern: RegExp | string): void {
      const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
      const match = regex.test(String(actual));
      if (isNot ? match : !match) {
        throw new Error(
          `Expected "${actual}" ${isNot ? "NOT to match" : "to match"} pattern ${pattern}`
        );
      }
    },
    toThrow(expected?: string | RegExp): void {
      if (typeof actual !== "function") {
        throw new Error(`expect(fn).toThrow() requires a function input`);
      }
      let threw = false;
      let thrownError: any;
      try {
        (actual as any)();
      } catch (err) {
        threw = true;
        thrownError = err;
      }
      if (isNot ? threw : !threw) {
        throw new Error(`Expected function ${isNot ? "NOT to throw" : "to throw an error"}`);
      }
      if (threw && expected) {
        const msg = String(thrownError?.message || thrownError);
        const match =
          expected instanceof RegExp ? expected.test(msg) : msg.includes(expected);
        if (isNot ? match : !match) {
          throw new Error(
            `Expected thrown message "${msg}" ${isNot ? "NOT to match" : "to match"} ${expected}`
          );
        }
      }
    },
    toBeTruthy(): void {
      const match = Boolean(actual);
      if (isNot ? match : !match) {
        throw new Error(`Expected ${actual} ${isNot ? "NOT to be truthy" : "to be truthy"}`);
      }
    },
    toBeFalsy(): void {
      const match = !Boolean(actual);
      if (isNot ? match : !match) {
        throw new Error(`Expected ${actual} ${isNot ? "NOT to be falsy" : "to be falsy"}`);
      }
    },
    toBeNull(): void {
      this.toBe(null as any);
    },
    toBeUndefined(): void {
      this.toBe(undefined as any);
    },
    toBeDefined(): void {
      const match = actual !== undefined;
      if (isNot ? match : !match) {
        throw new Error(`Expected ${actual} ${isNot ? "NOT to be defined" : "to be defined"}`);
      }
    },
    get not(): Expectation<T> {
      return expect(actual, !isNot);
    },
  };
  return matchers;
}

export interface RunResults {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  suites: Array<{
    name: string;
    passed: number;
    failed: number;
    cases: TestCase[];
  }>;
}

export async function runSuites(suitesToRun: TestSuite[] = defaultRegistry.getSuites()): Promise<RunResults> {
  const start = Date.now();
  let total = 0;
  let passed = 0;
  let failed = 0;
  const suiteResults: RunResults["suites"] = [];

  for (const suite of suitesToRun) {
    let sPassed = 0;
    let sFailed = 0;
    console.log(`\n\x1b[1m\x1b[36m▶ [SUITE] ${suite.name}\x1b[0m`);

    for (const testCase of suite.cases) {
      total++;
      const tStart = Date.now();
      try {
        const res = testCase.fn();
        if (res && typeof (res as any).then === "function") {
          await res;
        }
        testCase.status = "passed";
        testCase.durationMs = Date.now() - tStart;
        sPassed++;
        passed++;
        console.log(`  \x1b[32m✔\x1b[0m ${testCase.name} \x1b[90m(${testCase.durationMs}ms)\x1b[0m`);
      } catch (err: any) {
        testCase.status = "failed";
        testCase.error = err instanceof Error ? err : new Error(String(err));
        testCase.durationMs = Date.now() - tStart;
        sFailed++;
        failed++;
        console.log(`  \x1b[31m✖\x1b[0m ${testCase.name} \x1b[90m(${testCase.durationMs}ms)\x1b[0m`);
        console.log(`    \x1b[31mError: ${testCase.error.message}\x1b[0m`);
        if (testCase.error.stack) {
          const lines = testCase.error.stack.split("\n").slice(1, 4).join("\n    ");
          console.log(`    \x1b[90m${lines}\x1b[0m`);
        }
      }
    }

    suiteResults.push({
      name: suite.name,
      passed: sPassed,
      failed: sFailed,
      cases: suite.cases,
    });
  }

  const durationMs = Date.now() - start;
  return { total, passed, failed, durationMs, suites: suiteResults };
}

export function printSummary(results: RunResults, suiteTitle: string = "Test Run Summary"): void {
  const color = results.failed === 0 ? "\x1b[32m" : "\x1b[31m";
  console.log(`\n${color}======================================================================\x1b[0m`);
  console.log(`${color}\x1b[1m ${suiteTitle.toUpperCase()}\x1b[0m`);
  console.log(`${color}======================================================================\x1b[0m`);
  console.log(` Total Suites : ${results.suites.length}`);
  console.log(` Total Tests  : ${results.total}`);
  console.log(` Passed Tests : \x1b[32m${results.passed}\x1b[0m`);
  console.log(` Failed Tests : ${results.failed > 0 ? `\x1b[31m${results.failed}\x1b[0m` : `0`}`);
  console.log(` Duration     : ${results.durationMs}ms`);
  console.log(`${color}======================================================================\x1b[0m`);
  if (results.failed > 0) {
    console.log(`\x1b[31m\x1b[1mTEST RUN FAILED with ${results.failed} errors.\x1b[0m\n`);
  } else {
    console.log(`\x1b[32m\x1b[1mALL TESTS PASSED SUCCESSFULLY (100% PASS RATE).\x1b[0m\n`);
  }
}
