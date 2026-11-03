/**
 * TextOperation — operational transformation for plain text.
 *
 * An operation is a list of components that walk over the whole document:
 *   - positive integer  n  → retain n characters
 *   - negative integer -n  → delete n characters
 *   - string           s  → insert s
 *
 * Because an operation always spans the entire document it knows its
 * baseLength (doc length before) and targetLength (doc length after),
 * which lets us validate every op and makes transform() provably
 * convergent (TP1). Port of the well-known ot.js algorithm.
 *
 * NOTE: this file is duplicated byte-for-byte in frontend/src/ot/textOperation.ts.
 * Keep the two copies identical.
 */

export type OpComponent = number | string;

const isRetain = (op: OpComponent): op is number => typeof op === 'number' && op > 0;
const isDelete = (op: OpComponent): op is number => typeof op === 'number' && op < 0;
const isInsert = (op: OpComponent): op is string => typeof op === 'string';

export class TextOperation {
  ops: OpComponent[] = [];
  baseLength = 0;
  targetLength = 0;

  retain(n: number): this {
    if (!Number.isInteger(n) || n < 0) throw new Error('retain expects a non-negative integer');
    if (n === 0) return this;
    this.baseLength += n;
    this.targetLength += n;
    const last = this.ops[this.ops.length - 1];
    if (last !== undefined && isRetain(last)) this.ops[this.ops.length - 1] = last + n;
    else this.ops.push(n);
    return this;
  }

  insert(str: string): this {
    if (typeof str !== 'string') throw new Error('insert expects a string');
    if (str === '') return this;
    this.targetLength += str.length;
    const ops = this.ops;
    const last = ops[ops.length - 1];
    if (last !== undefined && isInsert(last)) {
      ops[ops.length - 1] = last + str;
    } else if (last !== undefined && isDelete(last)) {
      // Canonical order: insert before delete at the same position.
      const prev = ops[ops.length - 2];
      if (prev !== undefined && isInsert(prev)) ops[ops.length - 2] = prev + str;
      else {
        ops[ops.length] = last;
        ops[ops.length - 2] = str;
      }
    } else {
      ops.push(str);
    }
    return this;
  }

  delete(n: number): this {
    if (!Number.isInteger(n)) throw new Error('delete expects an integer');
    if (n === 0) return this;
    if (n > 0) n = -n;
    this.baseLength -= n;
    const last = this.ops[this.ops.length - 1];
    if (last !== undefined && isDelete(last)) this.ops[this.ops.length - 1] = last + n;
    else this.ops.push(n);
    return this;
  }

  isNoop(): boolean {
    return this.ops.length === 0 || (this.ops.length === 1 && isRetain(this.ops[0]));
  }

  toJSON(): OpComponent[] {
    return this.ops;
  }

  static fromJSON(ops: unknown): TextOperation {
    if (!Array.isArray(ops)) throw new Error('operation must be an array');
    const o = new TextOperation();
    for (const op of ops) {
      if (typeof op === 'string') o.insert(op);
      else if (typeof op === 'number' && Number.isInteger(op)) {
        if (op > 0) o.retain(op);
        else o.delete(-op);
      } else throw new Error('invalid operation component');
    }
    return o;
  }

  /** Apply to a string. Throws if the op was built for a different length. */
  apply(str: string): string {
    if (str.length !== this.baseLength) {
      throw new Error(`base length mismatch (doc ${str.length}, op ${this.baseLength})`);
    }
    const parts: string[] = [];
    let idx = 0;
    for (const op of this.ops) {
      if (isRetain(op)) {
        parts.push(str.slice(idx, idx + op));
        idx += op;
      } else if (isInsert(op)) {
        parts.push(op);
      } else {
        idx -= op;
      }
    }
    return parts.join('');
  }

  /** Map a cursor offset through this op (used for remote cursors). */
  transformIndex(index: number): number {
    let newIndex = index;
    let remaining = index;
    for (const op of this.ops) {
      if (isRetain(op)) remaining -= op;
      else if (isInsert(op)) newIndex += op.length;
      else {
        newIndex -= Math.min(remaining, -op);
        remaining += op;
      }
      if (remaining < 0) break;
    }
    return newIndex;
  }

  /** a.compose(b): one op with the same effect as applying a then b. */
  compose(b: TextOperation): TextOperation {
    const a = this;
    if (a.targetLength !== b.baseLength) {
      throw new Error('compose: first.targetLength must equal second.baseLength');
    }
    const out = new TextOperation();
    const ops1 = a.ops.slice();
    const ops2 = b.ops.slice();
    let i1 = 0;
    let i2 = 0;
    let op1: OpComponent | undefined = ops1[i1++];
    let op2: OpComponent | undefined = ops2[i2++];

    while (true) {
      if (op1 === undefined && op2 === undefined) break;

      if (op1 !== undefined && isDelete(op1)) {
        out.delete(op1);
        op1 = ops1[i1++];
        continue;
      }
      if (op2 !== undefined && isInsert(op2)) {
        out.insert(op2);
        op2 = ops2[i2++];
        continue;
      }
      if (op1 === undefined || op2 === undefined) {
        throw new Error('compose: operations have incompatible lengths');
      }

      if (isRetain(op1) && isRetain(op2)) {
        if (op1 > op2) { out.retain(op2); op1 = op1 - op2; op2 = ops2[i2++]; }
        else if (op1 === op2) { out.retain(op1); op1 = ops1[i1++]; op2 = ops2[i2++]; }
        else { out.retain(op1); op2 = op2 - op1; op1 = ops1[i1++]; }
      } else if (isInsert(op1) && isDelete(op2)) {
        if (op1.length > -op2) { op1 = op1.slice(-op2); op2 = ops2[i2++]; }
        else if (op1.length === -op2) { op1 = ops1[i1++]; op2 = ops2[i2++]; }
        else { op2 = op2 + op1.length; op1 = ops1[i1++]; }
      } else if (isInsert(op1) && isRetain(op2)) {
        if (op1.length > op2) { out.insert(op1.slice(0, op2)); op1 = op1.slice(op2); op2 = ops2[i2++]; }
        else if (op1.length === op2) { out.insert(op1); op1 = ops1[i1++]; op2 = ops2[i2++]; }
        else { out.insert(op1); op2 = op2 - op1.length; op1 = ops1[i1++]; }
      } else if (isRetain(op1) && isDelete(op2)) {
        if (op1 > -op2) { out.delete(op2); op1 = op1 + op2; op2 = ops2[i2++]; }
        else if (op1 === -op2) { out.delete(op2); op1 = ops1[i1++]; op2 = ops2[i2++]; }
        else { out.delete(op1); op2 = op2 + op1; op1 = ops1[i1++]; }
      } else {
        throw new Error('compose: unexpected component combination');
      }
    }
    return out;
  }

  /**
   * transform(a, b) → [a', b'] such that apply(apply(S, a), b') === apply(apply(S, b), a').
   * When both insert at the same position, a's insert goes first.
   */
  static transform(a: TextOperation, b: TextOperation): [TextOperation, TextOperation] {
    if (a.baseLength !== b.baseLength) {
      throw new Error('transform: both operations must have the same base length');
    }
    const a1 = new TextOperation();
    const b1 = new TextOperation();
    const ops1 = a.ops.slice();
    const ops2 = b.ops.slice();
    let i1 = 0;
    let i2 = 0;
    let op1: OpComponent | undefined = ops1[i1++];
    let op2: OpComponent | undefined = ops2[i2++];

    while (true) {
      if (op1 === undefined && op2 === undefined) break;

      if (op1 !== undefined && isInsert(op1)) {
        a1.insert(op1);
        b1.retain(op1.length);
        op1 = ops1[i1++];
        continue;
      }
      if (op2 !== undefined && isInsert(op2)) {
        a1.retain(op2.length);
        b1.insert(op2);
        op2 = ops2[i2++];
        continue;
      }
      if (op1 === undefined || op2 === undefined) {
        throw new Error('transform: operations have incompatible lengths');
      }

      let minl: number;
      if (isRetain(op1) && isRetain(op2)) {
        if (op1 > op2) { minl = op2; op1 = op1 - op2; op2 = ops2[i2++]; }
        else if (op1 === op2) { minl = op2; op1 = ops1[i1++]; op2 = ops2[i2++]; }
        else { minl = op1; op2 = op2 - op1; op1 = ops1[i1++]; }
        a1.retain(minl);
        b1.retain(minl);
      } else if (isDelete(op1) && isDelete(op2)) {
        // Both deleted the same text — nothing left to do for this span.
        if (-op1 > -op2) { op1 = op1 - op2; op2 = ops2[i2++]; }
        else if (op1 === op2) { op1 = ops1[i1++]; op2 = ops2[i2++]; }
        else { op2 = op2 - op1; op1 = ops1[i1++]; }
      } else if (isDelete(op1) && isRetain(op2)) {
        if (-op1 > op2) { minl = op2; op1 = op1 + op2; op2 = ops2[i2++]; }
        else if (-op1 === op2) { minl = op2; op1 = ops1[i1++]; op2 = ops2[i2++]; }
        else { minl = -op1; op2 = op2 + op1; op1 = ops1[i1++]; }
        a1.delete(minl);
      } else if (isRetain(op1) && isDelete(op2)) {
        if (op1 > -op2) { minl = -op2; op1 = op1 + op2; op2 = ops2[i2++]; }
        else if (op1 === -op2) { minl = op1; op1 = ops1[i1++]; op2 = ops2[i2++]; }
        else { minl = op1; op2 = op2 + op1; op1 = ops1[i1++]; }
        b1.delete(minl);
      } else {
        throw new Error('transform: unexpected component combination');
      }
    }
    return [a1, b1];
  }
}