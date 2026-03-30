// src/lib/queue/worker.ts
// BullMQ worker — processes scrape jobs from the queue.
// Run with: npx ts-node src/lib/queue/worker.ts
//
// The cron scheduler fires "scrape-all" daily at 3am UTC.
// Individual sources can also be queued on-demand from the Admin UI.

import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { runScrapeJob } from '../scraper/scrape-runner';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required by BullMQ
});

const prisma = new PrismaClient();

// ── Queue definitions ──────────────────────────────────────

export const scrapeQueue = new Queue('scrape', { connection });

// Scheduled cron: run all scrapers daily at 3am UTC
export async function scheduleDailySync() {
  await scrapeQueue.add(
    'scrape-all',
    { all: true },
    {
      repeat: { pattern: '0 3 * * *' }, // 3:00 AM UTC daily
      jobId: 'daily-sync',
    }
  );
  console.log('[Queue] Daily scrape scheduled: 3:00 AM UTC');
}

// ── Worker ─────────────────────────────────────────────────

const worker = new Worker(
  'scrape',
  async job => {
    console.log(`[Worker] Processing job: ${job.name} (${job.id})`);

    if (job.data.all) {
      // Scrape all active sources
      const sources = await prisma.dealerSource.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      console.log(`[Worker] Running ${sources.length} scrapers`);
      for (const source of sources) {
        try {
          await runScrapeJob(source.id);
          // Pause between sources to be polite
          await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
        } catch (err: any) {
          console.error(`[Worker] Failed ${source.name}: ${err.message}`);
          // Continue with next source even if one fails
        }
      }
    } else if (job.data.sourceId) {
      await runScrapeJob(job.data.sourceId);
    }
  },
  {
    connection,
    concurrency: 1, // one scrape job at a time to be polite
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

worker.on('completed', job => {
  console.log(`[Worker] Job completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job failed: ${job?.id} — ${err.message}`);
});

// Start scheduler and keep alive
async function main() {
  console.log('[Worker] Starting Chrono Consigliere scrape worker…');
  await scheduleDailySync();
  console.log('[Worker] Ready. Waiting for jobs…');
}

main().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down…');
  await worker.close();
  await connection.quit();
  process.exit(0);
});
