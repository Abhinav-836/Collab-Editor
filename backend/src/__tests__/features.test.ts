import { describe, it, expect, vi } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  issueToken,
  verifyToken,
  validatePassword,
  roomAuthStore,
  canEnterRoom
} from '../services/roomAuth.js';
import { CodeRunner, prepareJava, findJavaMainClass, RunnerInputError, RunnerUnavailableError } from '../services/codeRunner.js';

describe('room passwords', () => {
  it('hashes and verifies passwords (salted, so equal passwords hash differently)', async () => {
    const h1 = await hashPassword('secret123');
    const h2 = await hashPassword('secret123');
    expect(h1).not.toBe(h2);
    expect(h1.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('secret123', h1)).toBe(true);
    expect(await verifyPassword('wrong', h1)).toBe(false);
    expect(await verifyPassword('secret123', 'garbage')).toBe(false);
  });

  it('validates password length', () => {
    expect(validatePassword('abc')).toMatch(/at least/);
    expect(validatePassword('abcd')).toBeNull();
    expect(validatePassword('x'.repeat(101))).toMatch(/at most/);
    expect(validatePassword(42)).toMatch(/text/);
  });

  it('tokens are bound to one room and expire', () => {
    const now = Date.now();
    const token = issueToken('roomA', now);
    expect(verifyToken('roomA', token, now)).toBe(true);
    expect(verifyToken('roomB', token, now)).toBe(false); // other room
    expect(verifyToken('roomA', token, now + 31 * 24 * 3600 * 1000)).toBe(false); // expired
    const [exp, sig] = token.split('.');
    expect(verifyToken('roomA', `${Number(exp) + 1000}.${sig}`, now)).toBe(false); // tampered expiry
    expect(verifyToken('roomA', null, now)).toBe(false);
    expect(verifyToken('roomA', 'nonsense', now)).toBe(false);
  });

  it('protected rooms need a valid token; open rooms do not', async () => {
    roomAuthStore.clear();
    await roomAuthStore.setHash('locked1', await hashPassword('pass1234'));
    expect(await canEnterRoom('locked1', null)).toBe(false);
    expect(await canEnterRoom('locked1', issueToken('otherRoom'))).toBe(false);
    expect(await canEnterRoom('locked1', issueToken('locked1'))).toBe(true);
    expect(await canEnterRoom('openRoom', null)).toBe(true);
  });
});

describe('Java preparation for javac prog.java', () => {
  it('drops public from top-level types and adds a launcher', () => {
    const src = `import java.util.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("hi");
    }
}`;
    const out = prepareJava(src);
    expect(out).not.toMatch(/^public class/m);
    expect(out).toContain('class Main {');
    expect(out).toContain('public static void main'); // method stays public
    expect(out).toMatch(/class prog \{[\s\S]*Main\.main\(args\);/);
  });

  it('finds the top-level class even with nested classes and tricky strings', () => {
    const src = `
public final class App {
  static class Helper { void x() { String s = "}{ class Fake {"; } }
  // class Commented {
  public static void main(String[] args) { new Helper(); }
}
class Other {}`;
    expect(findJavaMainClass(src)).toBe('App');
    expect(prepareJava(src)).toMatch(/^final class App/m);
  });

  it('leaves code without main alone (compiler will report it)', () => {
    expect(prepareJava('class A {}')).toBe('class A {}');
  });
});

describe('CodeRunner', () => {
  const list = [
    { name: 'cpython-3.14.0', language: 'Python', version: '3.14.0' },
    { name: 'cpython-3.9.1', language: 'Python', version: '3.9.1' },
    { name: 'cpython-head', language: 'Python', version: '' },
    { name: 'gcc-head', language: 'C++', version: '17.0.0 20261016 (experimental)' },
    { name: 'gcc-13.2.0', language: 'C++', version: '13.2.0' },
    { name: 'gcc-13.2.0-c', language: 'C', version: '13.2.0' },
    { name: 'clang-17.0.1', language: 'C++', version: '17.0.1' },
    { name: 'nodejs-18.20.4', language: 'JavaScript', version: '18.20.4' },
    { name: 'nodejs-20.17.0', language: 'JavaScript', version: '20.17.0' }
  ];

  const makeFetch = (compileResponse: object, status = 200) =>
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/list.json')) return new Response(JSON.stringify(list), { status: 200 });
      return new Response(JSON.stringify(compileResponse), { status });
    });

  it('picks the newest stable compiler and maps the output', async () => {
    const fetchMock = makeFetch({ status: '0', program_output: 'hello\n', program_error: '' });
    const runner = new CodeRunner(fetchMock as any, 'https://wb.test/api');
    const r = await runner.run('python', 'print("hello")', '');
    expect(r.compiler).toBe('cpython-3.14.0'); // not 3.9.1, not head
    expect(r.stdout).toBe('hello\n');
    expect(r.exitCode).toBe(0);

    const body = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(body).toMatchObject({ compiler: 'cpython-3.14.0', code: 'print("hello")', save: false });

    await runner.run('cpp', 'int main(){}');
    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string).compiler).toBe('gcc-13.2.0');
    await runner.run('javascript', '1');
    expect(JSON.parse((fetchMock.mock.calls[3][1] as RequestInit).body as string).compiler).toBe('nodejs-20.17.0');
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/list.json'))).toHaveLength(1); // cached
  });

  it('reports compile errors and non-zero exits', async () => {
    const runner = new CodeRunner(
      makeFetch({ status: '1', compiler_error: "prog.cc:1: error: expected ';'", program_output: '' }) as any,
      'https://wb.test/api'
    );
    const r = await runner.run('cpp', 'int main() { return 0 }');
    expect(r.exitCode).toBe(1);
    expect(r.compileOutput).toContain("expected ';'");
  });

  it('uses fallback compiler names if the list is unavailable', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/list.json')) return new Response('down', { status: 503 });
      return new Response(JSON.stringify({ status: '0', program_output: 'ok' }), { status: 200 });
    });
    const runner = new CodeRunner(fetchMock as any, 'https://wb.test/api');
    const r = await runner.run('go', 'package main');
    expect(r.compiler).toBe('go-1.23.2');
  });

  it('rejects unsupported languages and surfaces runner outages', async () => {
    const runner = new CodeRunner(makeFetch({}, 500) as any, 'https://wb.test/api');
    await expect(runner.run('html', '<p>')).rejects.toBeInstanceOf(RunnerInputError);
    await expect(runner.run('python', 'x')).rejects.toBeInstanceOf(RunnerUnavailableError);
  });
});