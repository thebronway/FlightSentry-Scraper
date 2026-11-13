import { getSettings } from '@/db/settings';

interface QueueItem<T> {
  task: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

const pendingQueue: QueueItem<unknown>[] = [];
let activeWorker = false;
let lastCompletedTimestamp = 0;

function randomJitterMs(minMs: number, maxMs: number): number {
  const safeMin = Math.max(0, Math.floor(minMs));
  const safeMax = Math.max(safeMin, Math.floor(maxMs));
  if (safeMax === safeMin) return safeMin;
  return safeMin + Math.floor(Math.random() * (safeMax - safeMin + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processNext(): Promise<void> {
  if (activeWorker) return;
  const next = pendingQueue.shift();
  if (!next) return;

  activeWorker = true;
  try {
    // Apply randomized human-like jitter delay between consecutive scrapes
    if (lastCompletedTimestamp > 0) {
      const settings = getSettings();
      const targetDelay = randomJitterMs(
        settings.minJitterMs,
        settings.maxJitterMs
      );
      const elapsed = Date.now() - lastCompletedTimestamp;
      if (elapsed < targetDelay) {
        await sleep(targetDelay - elapsed);
      }
    }

    const result = await next.task();
    lastCompletedTimestamp = Date.now();
    next.resolve(result);
  } catch (err) {
    lastCompletedTimestamp = Date.now();
    next.reject(err);
  } finally {
    activeWorker = false;
    if (pendingQueue.length > 0) {
      void processNext();
    }
  }
}

export function getQueueDepth(): number {
  return pendingQueue.length + (activeWorker ? 1 : 0);
}

export function enqueueScrape<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    pendingQueue.push({
      task: task as () => Promise<unknown>,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    void processNext();
  });
}