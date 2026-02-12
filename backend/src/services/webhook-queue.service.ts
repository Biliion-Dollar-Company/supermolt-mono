import Redis from 'ioredis';
import { Queue, Worker, QueueEvents, type Job } from 'bullmq';
import { webhookQueueDepth, webhookQueueEnqueued, webhookQueueProcessed } from './metrics.service';

export interface SolanaWebhookJobData {
  rawBody: string;
  heliusSignature: string;
}

interface QueueStats {
  mode: 'redis' | 'memory';
  queued: number;
  activeWorkers: number;
  concurrency: number;
  maxQueueLength: number;
  processedJobs: number;
  failedJobs: number;
}

type LocalJob = () => Promise<void>;
type SolanaProcessor = (data: SolanaWebhookJobData) => Promise<void>;

class WebhookQueueService {
  private readonly queueName = process.env.WEBHOOK_QUEUE_NAME || 'supermolt:solana:webhooks';
  private readonly concurrency = parseInt(process.env.WEBHOOK_QUEUE_CONCURRENCY || '4', 10);
  private readonly maxQueueLength = parseInt(process.env.WEBHOOK_QUEUE_MAX || '2000', 10);
  private readonly redisUrl = process.env.WEBHOOK_QUEUE_REDIS_URL || process.env.REDIS_URL || '';

  private mode: 'redis' | 'memory' = 'memory';
  private initialized = false;
  private processor: SolanaProcessor | null = null;

  private redisConnection: Redis | null = null;
  private queue: Queue<SolanaWebhookJobData> | null = null;
  private worker: Worker<SolanaWebhookJobData> | null = null;
  private events: QueueEvents | null = null;

  private localQueue: LocalJob[] = [];
  private localActiveWorkers = 0;
  private processedJobs = 0;
  private failedJobs = 0;

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    if (!this.redisUrl) {
      console.log('[WEBHOOK_QUEUE] WEBHOOK_QUEUE_REDIS_URL/REDIS_URL not set, using memory queue');
      return;
    }

    try {
      this.redisConnection = new Redis(this.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      });

      this.redisConnection.on('error', (err) => {
        console.error('[WEBHOOK_QUEUE] Redis connection error:', err);
      });

      this.queue = new Queue<SolanaWebhookJobData>(this.queueName, {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 2000,
          removeOnFail: 5000,
        },
      });

      this.events = new QueueEvents(this.queueName, {
        connection: this.redisConnection.duplicate(),
      });
      this.events.on('failed', () => {
        this.failedJobs += 1;
        webhookQueueProcessed.labels('redis', 'failed').inc();
      });
      this.events.on('completed', () => {
        this.processedJobs += 1;
        webhookQueueProcessed.labels('redis', 'success').inc();
      });

      this.mode = 'redis';
      console.log(`[WEBHOOK_QUEUE] Redis mode enabled (${this.queueName})`);

      if (this.processor) {
        await this.startWorker();
      }
    } catch (error) {
      console.error('[WEBHOOK_QUEUE] Failed to initialize Redis mode, falling back to memory:', error);
      this.mode = 'memory';
    }
  }

  async registerSolanaProcessor(processor: SolanaProcessor) {
    this.processor = processor;
    await this.initialize();

    if (this.mode === 'redis') {
      await this.startWorker();
    }
  }

  private async startWorker() {
    if (!this.processor) return;
    if (!this.redisConnection) return;
    if (this.worker) return;

    this.worker = new Worker<SolanaWebhookJobData>(
      this.queueName,
      async (job: Job<SolanaWebhookJobData>) => {
        await this.processor!(job.data);
      },
      {
        connection: this.redisConnection.duplicate(),
        concurrency: this.concurrency,
      }
    );

    this.worker.on('error', (err) => {
      console.error('[WEBHOOK_QUEUE] Worker error:', err);
    });
  }

  async enqueueSolanaWebhook(data: SolanaWebhookJobData): Promise<boolean> {
    await this.initialize();

    if (this.mode === 'redis' && this.queue) {
      try {
        const waiting = await this.queue.getWaitingCount();
        const delayed = await this.queue.getDelayedCount();
        if (waiting + delayed >= this.maxQueueLength) {
          webhookQueueDepth.labels('redis').set(waiting + delayed);
          webhookQueueEnqueued.labels('redis', 'rejected').inc();
          return false;
        }

        await this.queue.add('process', data, {
          jobId: data.heliusSignature,
        });
        webhookQueueEnqueued.labels('redis', 'accepted').inc();
        return true;
      } catch (error) {
        console.error('[WEBHOOK_QUEUE] Redis enqueue failed, falling back to memory enqueue:', error);
      }
    }

    return this.enqueueMemory(async () => {
      if (!this.processor) {
        throw new Error('No webhook processor registered');
      }
      await this.processor(data);
    });
  }

  private enqueueMemory(job: LocalJob): boolean {
    if (this.localQueue.length >= this.maxQueueLength) {
      webhookQueueDepth.labels('memory').set(this.localQueue.length);
      webhookQueueEnqueued.labels('memory', 'rejected').inc();
      return false;
    }
    this.localQueue.push(job);
    webhookQueueDepth.labels('memory').set(this.localQueue.length);
    webhookQueueEnqueued.labels('memory', 'accepted').inc();
    this.pumpMemory();
    return true;
  }

  private pumpMemory() {
    while (this.localActiveWorkers < this.concurrency && this.localQueue.length > 0) {
      const next = this.localQueue.shift();
      if (!next) break;

      this.localActiveWorkers += 1;
      next()
        .then(() => {
          this.processedJobs += 1;
          webhookQueueProcessed.labels('memory', 'success').inc();
        })
        .catch((error) => {
          this.failedJobs += 1;
          webhookQueueProcessed.labels('memory', 'failed').inc();
          console.error('[WEBHOOK_QUEUE] Memory job failed:', error);
        })
        .finally(() => {
          this.localActiveWorkers -= 1;
          webhookQueueDepth.labels('memory').set(this.localQueue.length);
          this.pumpMemory();
        });
    }
  }

  async getStats(): Promise<QueueStats> {
    if (this.mode === 'redis' && this.queue) {
      let queued = 0;
      try {
        const [waiting, delayed] = await Promise.all([
          this.queue.getWaitingCount(),
          this.queue.getDelayedCount(),
        ]);
        queued = waiting + delayed;
        webhookQueueDepth.labels('redis').set(queued);
      } catch {
        queued = 0;
        webhookQueueDepth.labels('redis').set(0);
      }

      return {
        mode: 'redis',
        queued,
        activeWorkers: this.worker ? this.concurrency : 0,
        concurrency: this.concurrency,
        maxQueueLength: this.maxQueueLength,
        processedJobs: this.processedJobs,
        failedJobs: this.failedJobs,
      };
    }

    webhookQueueDepth.labels('memory').set(this.localQueue.length);
    return {
      mode: 'memory',
      queued: this.localQueue.length,
      activeWorkers: this.localActiveWorkers,
      concurrency: this.concurrency,
      maxQueueLength: this.maxQueueLength,
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs,
    };
  }
}

export const webhookQueue = new WebhookQueueService();
