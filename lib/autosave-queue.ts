export type AutosaveStatus =
  "idle" | "waiting" | "saving" | "saved" | "invalid" | "error";
export type SaveResult =
  { success: true; version: number } | { success: false; error: string };

// Serialize writes and retain only the latest unsaved snapshot.
export class AutosaveQueue<T> {
  private next: T | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private ready = false;
  private revision = 0;
  private dirty = false;

  constructor(
    private version: number,
    private save: (value: T, version: number) => Promise<SaveResult>,
    private notify: (status: AutosaveStatus, error?: string) => void,
  ) {}

  get unsaved() {
    return this.dirty || this.running;
  }

  acceptVersion(version: number) {
    if (!this.unsaved) this.version = Math.max(this.version, version);
  }

  schedule(value: T, delay: number) {
    clearTimeout(this.timer);
    this.revision++;
    this.next = value;
    this.dirty = true;
    this.ready = delay === 0;
    this.notify("waiting");
    if (delay === 0) void this.flush();
    else this.timer = setTimeout(() => void this.flush(), delay);
  }

  invalidate() {
    clearTimeout(this.timer);
    this.revision++;
    this.next = undefined;
    this.ready = false;
    this.dirty = true;
    this.notify("invalid");
  }

  async flush() {
    clearTimeout(this.timer);
    this.ready = true;
    if (this.running || this.next === undefined) return;
    const snapshot = this.next;
    const revision = this.revision;
    this.next = undefined;
    this.running = true;
    this.notify("saving");
    try {
      const result = await this.save(snapshot, this.version);
      if (!result.success) throw new Error(result.error);
      this.version = result.version;
      if (revision === this.revision) {
        this.dirty = false;
        this.notify("saved");
      }
    } catch (error) {
      // An unconfirmed write must never be retried with a guessed version.
      clearTimeout(this.timer);
      this.next = undefined;
      this.notify(
        "error",
        error instanceof Error
          ? error.message
          : "Enregistrement non confirmé. Actualisez avant de réessayer.",
      );
    } finally {
      this.running = false;
    }
    if (this.ready && this.next !== undefined) await this.flush();
  }
}
