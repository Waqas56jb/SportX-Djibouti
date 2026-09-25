import { logger } from '../utils/logger.js';

type Task = () => Promise<unknown>;

/**
 * Minimal in-process job runner. Work is deferred off the request path and retried once.
 * The interface (enqueue / schedule) is what a real queue (BullMQ, pg-boss, SQS…) would expose,
 * so callers do not change when one is introduced.
 */
class JobRunner {
  private pending = new Set<Promise<unknown>>();
  private timers: NodeJS.Timeout[] = [];

  enqueue(name: string, task: Task, attempt = 1): void {
    const p = Promise.resolve()
      .then(task)
      .catch((err) => {
        logger.warn({ err, job: name, attempt }, 'job failed');
        if (attempt < 2) setTimeout(() => this.enqueue(name, task, attempt + 1), 2_000).unref();
      })
      .finally(() => this.pending.delete(p));
    this.pending.add(p);
  }

  /** Recurring job. */
  schedule(name: string, everyMs: number, task: Task): void {
    const t = setInterval(() => this.enqueue(name, task), everyMs);
    t.unref();
    this.timers.push(t);
  }

  /** Awaits in-flight jobs (graceful shutdown, tests). */
  async drain(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  stop(): void {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }
}

export const jobs = new JobRunner();
