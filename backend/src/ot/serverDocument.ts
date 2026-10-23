import { TextOperation } from './textOperation.js';

/** Max characters a single room document may hold (~1 MB of UTF-16). */
export const MAX_DOCUMENT_LENGTH = 500_000;
/** How many past operations we keep for transforming late ops. */
const MAX_HISTORY = 2_000;

export class StaleRevisionError extends Error {}

/**
 * Authoritative server copy of a document.
 *
 * Every accepted operation gets a revision number. A client sends the
 * revision its op was based on; we transform the op against everything
 * that was accepted after that revision, apply it, and return the
 * transformed op so it can be broadcast.
 */
export class ServerDocument {
  private content: string;
  private history: TextOperation[] = [];
  /** Revision number of history[0]. Grows as old history is trimmed. */
  private historyStart = 0;

  constructor(initialContent = '') {
    this.content = initialContent;
  }

  getContent(): string {
    return this.content;
  }

  /** Current revision = number of operations ever accepted. */
  getRevision(): number {
    return this.historyStart + this.history.length;
  }

  receiveOperation(revision: number, operation: TextOperation): TextOperation {
    const current = this.getRevision();
    if (!Number.isInteger(revision) || revision < 0 || revision > current) {
      throw new Error(`invalid revision ${revision} (current ${current})`);
    }
    if (revision < this.historyStart) {
      throw new StaleRevisionError(`revision ${revision} is older than retained history`);
    }

    let op = operation;
    for (const concurrent of this.history.slice(revision - this.historyStart)) {
      [op] = TextOperation.transform(op, concurrent);
    }

    const next = op.apply(this.content); // throws on length mismatch
    if (next.length > MAX_DOCUMENT_LENGTH) {
      throw new Error('document size limit exceeded');
    }

    this.content = next;
    this.history.push(op);
    if (this.history.length > MAX_HISTORY) {
      const drop = this.history.length - MAX_HISTORY;
      this.history.splice(0, drop);
      this.historyStart += drop;
    }
    return op;
  }
}