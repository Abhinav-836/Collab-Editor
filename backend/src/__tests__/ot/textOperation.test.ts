import { describe, it, expect } from 'vitest';
import { TextOperation } from '../../ot/textOperation.js';
import { ServerDocument } from '../../ot/serverDocument.js';

// ---------- helpers ----------
let seed = 42;
const rand = () => {
  // deterministic LCG so failures are reproducible
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const randInt = (n: number) => Math.floor(rand() * n);
const randStr = () => {
  const chars = 'abc xyz\n{}()😀';
  let s = '';
  const len = 1 + randInt(4);
  for (let i = 0; i < len; i++) s += chars[randInt(chars.length)];
  return s;
};

/** Random op valid for a document of the given content. */
function randomOp(doc: string): TextOperation {
  const op = new TextOperation();
  let left = doc.length;
  while (left > 0) {
    const n = 1 + randInt(Math.min(left, 6));
    const r = rand();
    if (r < 0.2) op.insert(randStr());
    else if (r < 0.45) op.delete(n), (left -= n);
    else op.retain(n), (left -= n);
  }
  if (rand() < 0.4) op.insert(randStr());
  return op;
}

const insertAt = (doc: string, pos: number, s: string) =>
  new TextOperation().retain(pos).insert(s).retain(doc.length - pos);
const deleteAt = (doc: string, pos: number, n: number) =>
  new TextOperation().retain(pos).delete(n).retain(doc.length - pos - n);

// ---------- tests ----------
describe('TextOperation', () => {
  it('applies insert / delete / replace', () => {
    expect(insertAt('Hello World', 5, ' Beautiful').apply('Hello World')).toBe('Hello Beautiful World');
    expect(deleteAt('Hello Beautiful World', 5, 10).apply('Hello Beautiful World')).toBe('Hello World');
    const replace = new TextOperation().retain(6).delete(5).insert('There');
    expect(replace.apply('Hello World')).toBe('Hello There');
  });

  it('rejects ops built for a different document length', () => {
    expect(() => insertAt('abc', 1, 'x').apply('abcd')).toThrow();
  });

  it('round-trips through JSON', () => {
    const op = new TextOperation().retain(3).insert('hi').delete(2).retain(1);
    const back = TextOperation.fromJSON(JSON.parse(JSON.stringify(op)));
    expect(back.apply('abcdef')).toBe(op.apply('abcdef'));
  });

  it('rejects malformed JSON operations', () => {
    expect(() => TextOperation.fromJSON('nope')).toThrow();
    expect(() => TextOperation.fromJSON([1.5])).toThrow();
    expect(() => TextOperation.fromJSON([{}])).toThrow();
  });

  it('transforms concurrent inserts so both sides converge', () => {
    const doc = 'ab';
    const a = insertAt(doc, 0, 'X');
    const b = insertAt(doc, 2, 'Y');
    const [a1, b1] = TextOperation.transform(a, b);
    expect(b1.apply(a.apply(doc))).toBe('XabY');
    expect(a1.apply(b.apply(doc))).toBe('XabY');
  });

  it('handles an insert inside a concurrently deleted range', () => {
    const doc = 'abcdef';
    const del = deleteAt(doc, 1, 4); // remove "bcde"
    const ins = insertAt(doc, 3, 'X');
    const [del1, ins1] = TextOperation.transform(del, ins);
    expect(ins1.apply(del.apply(doc))).toBe(del1.apply(ins.apply(doc)));
    expect(ins1.apply(del.apply(doc))).toBe('aXf');
  });

  it('handles overlapping deletes', () => {
    const doc = 'abcdefgh';
    const a = deleteAt(doc, 2, 3);
    const b = deleteAt(doc, 3, 3);
    const [a1, b1] = TextOperation.transform(a, b);
    expect(b1.apply(a.apply(doc))).toBe('abgh');
    expect(a1.apply(b.apply(doc))).toBe('abgh');
  });

  it('satisfies TP1 and compose on 2,000 random pairs', () => {
    for (let i = 0; i < 2000; i++) {
      const doc = randStr() + randStr() + randStr();
      const a = randomOp(doc);
      const b = randomOp(doc);
      const [a1, b1] = TextOperation.transform(a, b);
      expect(b1.apply(a.apply(doc))).toBe(a1.apply(b.apply(doc)));

      const c = randomOp(a.apply(doc));
      expect(a.compose(c).apply(doc)).toBe(c.apply(a.apply(doc)));
    }
  });

  it('maps cursor indices through edits', () => {
    const doc = 'hello world';
    expect(insertAt(doc, 0, 'XX').transformIndex(5)).toBe(7);
    expect(insertAt(doc, 8, 'XX').transformIndex(5)).toBe(5);
    expect(deleteAt(doc, 0, 3).transformIndex(5)).toBe(2);
    expect(deleteAt(doc, 3, 5).transformIndex(5)).toBe(3);
  });
});

/**
 * Simulates the real protocol: N clients editing concurrently with random
 * network delays, using the same state machine as the browser client.
 */
class SimClient {
  doc: string;
  revision: number;
  outstanding: TextOperation | null = null;
  buffer: TextOperation | null = null;
  outbox: Array<{ revision: number; op: TextOperation }> = [];

  constructor(doc: string, revision: number) {
    this.doc = doc;
    this.revision = revision;
  }

  localEdit(op: TextOperation) {
    this.doc = op.apply(this.doc);
    if (!this.outstanding) {
      this.outstanding = op;
      this.outbox.push({ revision: this.revision, op });
    } else if (!this.buffer) this.buffer = op;
    else this.buffer = this.buffer.compose(op);
  }

  serverAck() {
    this.revision++;
    if (this.buffer) {
      this.outstanding = this.buffer;
      this.buffer = null;
      this.outbox.push({ revision: this.revision, op: this.outstanding });
    } else this.outstanding = null;
  }

  serverOp(op: TextOperation) {
    this.revision++;
    if (this.outstanding) {
      [this.outstanding, op] = TextOperation.transform(this.outstanding, op);
      if (this.buffer) [this.buffer, op] = TextOperation.transform(this.buffer, op);
    }
    this.doc = op.apply(this.doc);
  }
}

describe('ServerDocument + clients', () => {
  it('converges with 4 clients and random message delivery', () => {
    for (let round = 0; round < 50; round++) {
      const server = new ServerDocument('function greet() {}\n');
      const clients = Array.from({ length: 4 }, () => new SimClient(server.getContent(), 0));
      // per-client inbound queues of server messages (FIFO, like a socket)
      const inbox: Array<Array<{ kind: 'ack' } | { kind: 'op'; op: TextOperation }>> = clients.map(() => []);

      for (let step = 0; step < 200; step++) {
        const i = randInt(clients.length);
        const c = clients[i];
        const action = rand();
        if (action < 0.4) {
          c.localEdit(randomOp(c.doc));
        } else if (action < 0.7 && c.outbox.length) {
          const { revision, op } = c.outbox.shift()!;
          const accepted = server.receiveOperation(revision, op);
          inbox.forEach((q, j) => q.push(j === i ? { kind: 'ack' } : { kind: 'op', op: accepted }));
        } else if (inbox[i].length) {
          const msg = inbox[i].shift()!;
          if (msg.kind === 'ack') c.serverAck();
          else c.serverOp(msg.op);
        }
      }

      // Flush everything
      let progress = true;
      while (progress) {
        progress = false;
        clients.forEach((c, i) => {
          while (c.outbox.length) {
            const { revision, op } = c.outbox.shift()!;
            const accepted = server.receiveOperation(revision, op);
            inbox.forEach((q, j) => q.push(j === i ? { kind: 'ack' } : { kind: 'op', op: accepted }));
            progress = true;
          }
        });
        clients.forEach((c, i) => {
          while (inbox[i].length) {
            const msg = inbox[i].shift()!;
            if (msg.kind === 'ack') c.serverAck();
            else c.serverOp(msg.op);
            progress = true;
          }
        });
      }

      for (const c of clients) {
        expect(c.doc).toBe(server.getContent());
        expect(c.revision).toBe(server.getRevision());
      }
    }
  });

  it('rejects ops with a future revision or wrong base length', () => {
    const server = new ServerDocument('abc');
    expect(() => server.receiveOperation(5, insertAt('abc', 0, 'x'))).toThrow();
    expect(() => server.receiveOperation(0, insertAt('abcd', 0, 'x'))).toThrow();
    expect(server.getContent()).toBe('abc');
  });
});