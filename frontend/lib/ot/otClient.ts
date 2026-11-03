import { TextOperation } from './textOperation';

/**
 * Client side of the OT protocol (same state machine as ot.js):
 *
 *   synchronized ──local edit──▶ awaiting ack ──local edit──▶ awaiting ack + buffer
 *        ▲                          │                               │
 *        └──────────── ack ─────────┘◀──────────── ack ─────────────┘ (buffer is sent)
 *
 * Only one operation is in flight at a time. Remote operations are
 * transformed against the in-flight and buffered ones before being
 * applied to the editor, so every client converges to the server's text.
 */
export class OTClient {
  revision: number;
  private outstanding: TextOperation | null = null;
  private buffer: TextOperation | null = null;

  constructor(
    revision: number,
    private sendOperation: (revision: number, op: TextOperation) => void,
    private applyToEditor: (op: TextOperation) => void
  ) {
    this.revision = revision;
  }

  get hasPending(): boolean {
    return this.outstanding !== null;
  }

  /** User typed something (already applied to the editor). */
  applyClient(op: TextOperation): void {
    if (op.isNoop()) return;
    if (!this.outstanding) {
      this.outstanding = op;
      this.sendOperation(this.revision, op);
    } else if (!this.buffer) {
      this.buffer = op;
    } else {
      this.buffer = this.buffer.compose(op);
    }
  }

  /** Another user's operation arrived from the server. */
  applyServer(op: TextOperation): void {
    this.revision++;
    if (this.outstanding) {
      [this.outstanding, op] = TextOperation.transform(this.outstanding, op);
      if (this.buffer) {
        [this.buffer, op] = TextOperation.transform(this.buffer, op);
      }
    }
    this.applyToEditor(op);
  }

  /** Server confirmed our in-flight operation. */
  serverAck(): void {
    this.revision++;
    if (this.buffer) {
      this.outstanding = this.buffer;
      this.buffer = null;
      this.sendOperation(this.revision, this.outstanding);
    } else {
      this.outstanding = null;
    }
  }

  /** Map a remote cursor (in server coordinates) into our local document. */
  transformIndex(index: number): number {
    let i = index;
    if (this.outstanding) i = this.outstanding.transformIndex(i);
    if (this.buffer) i = this.buffer.transformIndex(i);
    return i;
  }
}