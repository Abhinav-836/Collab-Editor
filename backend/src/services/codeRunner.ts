/**
 * Runs code on Wandbox (https://wandbox.org) — a free, keyless compile service.
 * (The public Piston API stopped being free on Feb 15, 2026.)
 *
 * Compiler versions on Wandbox change over time, so instead of hard-coding
 * names we look them up from /list.json (cached) and fall back to known names.
 */

const API_BASE = (process.env.CODE_RUNNER_URL || 'https://wandbox.org/api').replace(/\/+$/, '');
const LIST_TTL_MS = 6 * 60 * 60 * 1000;
const RUN_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 64 * 1024;
export const MAX_CODE_CHARS = 100_000;
export const MAX_STDIN_CHARS = 20_000;

interface LanguageSpec {
  /** Wandbox "language" field */
  wandboxLanguage: string;
  /** Compiler name prefix we prefer (e.g. gcc- not clang-) */
  prefix: string;
  /** Used if the list can't be fetched */
  fallback: string;
}

const LANGUAGES: Record<string, LanguageSpec> = {
  javascript: { wandboxLanguage: 'JavaScript', prefix: 'nodejs-', fallback: 'nodejs-20.17.0' },
  typescript: { wandboxLanguage: 'TypeScript', prefix: 'typescript-', fallback: 'typescript-5.6.2' },
  python: { wandboxLanguage: 'Python', prefix: 'cpython-', fallback: 'cpython-3.14.0' },
  java: { wandboxLanguage: 'Java', prefix: 'openjdk-', fallback: 'openjdk-jdk-22+36' },
  cpp: { wandboxLanguage: 'C++', prefix: 'gcc-', fallback: 'gcc-13.2.0' },
  go: { wandboxLanguage: 'Go', prefix: 'go-', fallback: 'go-1.23.2' },
  rust: { wandboxLanguage: 'Rust', prefix: 'rust-', fallback: 'rust-1.82.0' }
};

export const RUNNABLE_LANGUAGES = Object.keys(LANGUAGES);

export interface RunResult {
  /** Process exit status, or null if killed by a signal */
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  /** Compiler warnings/errors (compiled languages) */
  compileOutput: string;
  compiler: string;
  durationMs: number;
}

type FetchFn = typeof fetch;

/** Numeric-aware compare: "3.14.0" > "3.9.1", "20.17.0" > "18.20.4" */
const compareVersions = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export class CodeRunner {
  private compilers: Map<string, string> | null = null;
  private listFetchedAt = 0;

  constructor(private fetchFn: FetchFn = fetch, private apiBase = API_BASE) {}

  /** Pick the newest stable compiler per language from Wandbox's list. */
  private async resolveCompiler(language: string): Promise<string> {
    const spec = LANGUAGES[language];
    if (!this.compilers || Date.now() - this.listFetchedAt > LIST_TTL_MS) {
      try {
        const res = await this.fetchFn(`${this.apiBase}/list.json`, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list = (await res.json()) as Array<{ name: string; language: string; version: string }>;
        const picked = new Map<string, string>();
        for (const [lang, s] of Object.entries(LANGUAGES)) {
          const candidates = list.filter(
            (c) =>
              c.language === s.wandboxLanguage &&
              c.name.startsWith(s.prefix) &&
              !/head|-c$/.test(c.name) && // skip nightly builds and C-mode gcc
              /^\d/.test(c.version || '')
          );
          candidates.sort((a, b) => compareVersions(b.version, a.version));
          if (candidates[0]) picked.set(lang, candidates[0].name);
        }
        this.compilers = picked;
        this.listFetchedAt = Date.now();
      } catch (err) {
        console.warn('⚠️ Could not fetch Wandbox compiler list, using defaults:', (err as Error).message);
        this.compilers = this.compilers ?? new Map();
        this.listFetchedAt = Date.now() - LIST_TTL_MS + 5 * 60 * 1000; // retry in 5 min
      }
    }
    return this.compilers.get(language) ?? spec.fallback;
  }

  async run(language: string, code: string, stdin = ''): Promise<RunResult> {
    if (!LANGUAGES[language]) throw new RunnerInputError(`Running ${language} isn't supported`);
    const compiler = await this.resolveCompiler(language);
    const source = language === 'java' ? prepareJava(code) : code;

    const started = Date.now();
    let res: Response;
    try {
      res = await this.fetchFn(`${this.apiBase}/compile.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compiler, code: source, stdin, save: false }),
        signal: AbortSignal.timeout(RUN_TIMEOUT_MS)
      });
    } catch (err) {
      const timedOut = (err as Error).name === 'TimeoutError';
      throw new RunnerUnavailableError(timedOut ? 'The code runner timed out' : 'The code runner is unreachable');
    }
    if (!res.ok) throw new RunnerUnavailableError(`The code runner returned HTTP ${res.status}`);

    const data = (await res.json()) as Record<string, string | undefined>;
    const status = data.status !== undefined && data.status !== '' ? Number(data.status) : null;
    return {
      exitCode: Number.isFinite(status) ? status : null,
      signal: data.signal || null,
      stdout: truncate(data.program_output ?? ''),
      stderr: truncate(data.program_error ?? ''),
      compileOutput: truncate([data.compiler_output, data.compiler_error].filter(Boolean).join('')),
      compiler,
      durationMs: Date.now() - started
    };
  }
}

export class RunnerInputError extends Error {}
export class RunnerUnavailableError extends Error {}

const truncate = (s: string) =>
  s.length > MAX_OUTPUT_CHARS ? `${s.slice(0, MAX_OUTPUT_CHARS)}\n… (output truncated)` : s;

/**
 * Wandbox compiles Java as `javac prog.java`. A `public class Main` would fail
 * ("class Main is public, should be declared in a file named Main.java"), so:
 *   1. drop `public` from top-level classes/interfaces/enums/records, and
 *   2. add a `prog` launcher that calls the real main class.
 */
export function prepareJava(code: string): string {
  const unpublic = code.replace(
    /^public\s+((?:(?:abstract|final|sealed|non-sealed|strictfp)\s+)*(?:class|interface|enum|record)\s)/gm,
    '$1'
  );
  const mainClass = findJavaMainClass(unpublic);
  if (!mainClass || mainClass === 'prog') return unpublic;
  return `${unpublic}\n\nclass prog {\n  public static void main(String[] args) throws Exception {\n    ${mainClass}.main(args);\n  }\n}\n`;
}

/** Name of the TOP-LEVEL type that contains `static void main(` (nested classes are skipped). */
export function findJavaMainClass(code: string): string | null {
  // Blank out comments and string/char literals so their braces don't count
  const clean = code.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g,
    (m) => m.replace(/[^\n]/g, ' ')
  );
  const mainIdx = clean.search(/static\s+(?:public\s+)?void\s+main\s*\(/);
  if (mainIdx < 0) return null;

  let depth = 0;
  let current: string | null = null;
  const declRe = /\b(?:class|enum|record|interface)\s+([A-Za-z_$][\w$]*)/y;
  for (let i = 0; i < mainIdx; i++) {
    const ch = clean[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      declRe.lastIndex = i;
      const m = declRe.exec(clean);
      if (m && (i === 0 || !/[\w$]/.test(clean[i - 1]))) {
        current = m[1];
        i += m[0].length - 1;
      }
    }
  }
  return current;
}

export const codeRunner = new CodeRunner();