/**
 * Main-thread Singleton Client for WebGPU In-Browser LLM Inference.
 *
 * Exposes a typed API to:
 * - Initialize and switch lightweight SLMs (Qwen2.5-0.5B / 1.5B).
 * - Monitor fine-grained model download and caching progress.
 * - Execute real-time streaming text generation.
 * - Manage cancellation and worker lifecycle.
 */

import {
  DEFAULT_MODEL_ID,
  type DownloadProgress,
  type GenerationOptions,
  type LLMDevice,
  type LLMStatus,
  type ModelDtype,
  type StorageEstimateInfo,
  type WorkerInMessage,
  type WorkerOutMessage,
} from './types.ts';
import { isModelCached, purgeModelCache, getStorageQuota } from './model-cache.ts';

type StatusListener = (
  status: LLMStatus,
  message?: string,
  device?: LLMDevice
) => void;

type ProgressListener = (progress: DownloadProgress) => void;

interface PendingGeneration {
  resolve: (fullText: string) => void;
  reject: (err: Error) => void;
  onToken?: (token: string, accumulatedText: string) => void;
  accumulatedText: string;
}

interface PendingInit {
  resolve: () => void;
  reject: (err: Error) => void;
}

export class LLMClient {
  private static instance: LLMClient | null = null;
  private worker: Worker | null = null;
  private status: LLMStatus = 'idle';
  private statusMessage?: string;
  private currentDevice: LLMDevice = 'webgpu';
  private currentModelId: string = DEFAULT_MODEL_ID;

  private statusListeners: StatusListener[] = [];
  private progressListeners: ProgressListener[] = [];
  private pendingGenerations: Map<string, PendingGeneration> = new Map();
  private pendingInit: PendingInit | null = null;
  private requestCounter = 0;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Retrieves the singleton LLMClient instance.
   */
  public static getInstance(): LLMClient {
    if (!LLMClient.instance) {
      LLMClient.instance = new LLMClient();
    }
    return LLMClient.instance;
  }

  /**
   * Checks whether the current runtime environment supports Web Workers and LLM execution.
   */
  public isSupported(): boolean {
    return typeof Worker !== 'undefined';
  }

  /**
   * Returns the current lifecycle status.
   */
  public getStatus(): LLMStatus {
    return this.status;
  }

  /**
   * Returns the current status message.
   */
  public getStatusMessage(): string | undefined {
    return this.statusMessage;
  }

  /**
   * Returns the active compute device (webgpu, wasm, cpu).
   */
  public getCurrentDevice(): LLMDevice {
    return this.currentDevice;
  }

  /**
   * Returns the active model identifier.
   */
  public getCurrentModelId(): string {
    return this.currentModelId;
  }

  /**
   * Registers a status change listener.
   */
  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    listener(this.status, this.statusMessage, this.currentDevice);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Registers a download progress listener.
   */
  public onProgress(listener: ProgressListener): () => void {
    this.progressListeners.push(listener);
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== listener);
    };
  }

  private setStatus(status: LLMStatus, message?: string, device?: LLMDevice): void {
    this.status = status;
    this.statusMessage = message;
    if (device) {
      this.currentDevice = device;
    }
    for (const listener of this.statusListeners) {
      listener(this.status, this.statusMessage, this.currentDevice);
    }
  }

  private ensureWorker(): Worker {
    if (!this.isSupported()) {
      throw new Error('Web Workers are not supported in this environment.');
    }

    if (!this.worker) {
      this.worker = new Worker(new URL('./llm-worker.ts', import.meta.url), { type: 'module' });

      this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (err: ErrorEvent) => {
        const errorText = err.message || 'LLM Worker runtime error';
        console.error('[LLMClient] Worker error:', errorText);
        this.setStatus('error', errorText);

        try {
          this.worker?.terminate();
        } catch {}
        this.worker = null;

        if (this.pendingInit) {
          this.pendingInit.reject(new Error(errorText));
          this.pendingInit = null;
        }

        for (const [id, pending] of this.pendingGenerations.entries()) {
          pending.reject(new Error(errorText));
          this.pendingGenerations.delete(id);
        }
      };
    }

    return this.worker;
  }

  private handleWorkerMessage(msg: WorkerOutMessage): void {
    switch (msg.type) {
      case 'status': {
        this.setStatus(msg.status, msg.message, msg.device);
        if (msg.modelId) {
          this.currentModelId = msg.modelId;
        }

        if (msg.status === 'ready' && this.pendingInit) {
          this.pendingInit.resolve();
          this.pendingInit = null;
        } else if (msg.status === 'error' && this.pendingInit) {
          this.pendingInit.reject(new Error(msg.message || 'Worker initialization failed'));
          this.pendingInit = null;
        }
        break;
      }

      case 'progress': {
        for (const listener of this.progressListeners) {
          listener(msg.progress);
        }
        break;
      }

      case 'chunk': {
        const pending = this.pendingGenerations.get(msg.id);
        if (pending) {
          pending.accumulatedText = msg.chunk.text;
          if (pending.onToken) {
            pending.onToken(msg.chunk.token, msg.chunk.text);
          }
        }
        break;
      }

      case 'complete': {
        const pending = this.pendingGenerations.get(msg.id);
        if (pending) {
          this.pendingGenerations.delete(msg.id);
          pending.resolve(msg.fullText);
        }
        break;
      }

      case 'error': {
        if (msg.id) {
          const pending = this.pendingGenerations.get(msg.id);
          if (pending) {
            this.pendingGenerations.delete(msg.id);
            pending.reject(new Error(msg.error));
          }
        } else if (this.pendingInit) {
          this.pendingInit.reject(new Error(msg.error));
          this.pendingInit = null;
        }
        break;
      }

      case 'cache_status': {
        // Cache status reporting handled via dedicated caller promises if needed
        break;
      }
    }
  }

  /**
   * Initializes or reconfigures the in-browser model pipeline.
   */
  public async initModel(
    modelId: string = DEFAULT_MODEL_ID,
    device: LLMDevice = 'webgpu',
    dtype: ModelDtype = 'q4'
  ): Promise<void> {
    const worker = this.ensureWorker();

    if (
      this.status === 'ready' &&
      this.currentModelId === modelId &&
      this.currentDevice === device
    ) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.pendingInit = { resolve, reject };

      const initMsg: WorkerInMessage = {
        type: 'init',
        modelId,
        dtype,
        device,
      };

      worker.postMessage(initMsg);
    });
  }

  /**
   * Streams text generation from a formatted prompt.
   */
  public async streamGenerate(
    prompt: string,
    options?: GenerationOptions
  ): Promise<string> {
    if (this.status === 'idle') {
      await this.initModel(this.currentModelId, this.currentDevice);
    }

    const worker = this.ensureWorker();
    this.requestCounter++;
    const id = `gen_${Date.now()}_${this.requestCounter}`;

    return new Promise<string>((resolve, reject) => {
      this.pendingGenerations.set(id, {
        resolve,
        reject,
        onToken: options?.onToken,
        accumulatedText: '',
      });

      const genMsg: WorkerInMessage = {
        type: 'generate',
        id,
        prompt,
        options: {
          maxNewTokens: options?.maxNewTokens,
          temperature: options?.temperature,
          topP: options?.topP,
          repetitionPenalty: options?.repetitionPenalty,
          stopSequences: options?.stopSequences,
          doSample: options?.doSample,
        },
      };

      worker.postMessage(genMsg);
    });
  }

  /**
   * Aborts active generation.
   */
  public abort(id?: string): void {
    if (this.worker) {
      const abortMsg: WorkerInMessage = {
        type: 'abort',
        id,
      };
      this.worker.postMessage(abortMsg);
    }

    if (id) {
      const pending = this.pendingGenerations.get(id);
      if (pending) {
        this.pendingGenerations.delete(id);
        pending.resolve(pending.accumulatedText);
      }
    } else {
      for (const [genId, pending] of this.pendingGenerations.entries()) {
        pending.resolve(pending.accumulatedText);
        this.pendingGenerations.delete(genId);
      }
    }
  }

  /**
   * Resets the worker state to idle.
   */
  public reset(): void {
    if (this.worker) {
      const resetMsg: WorkerInMessage = {
        type: 'reset',
      };
      this.worker.postMessage(resetMsg);
    }
  }

  /**
   * Checks whether the target model weights are cached.
   */
  public async checkCache(
    modelId: string = DEFAULT_MODEL_ID
  ): Promise<{ isCached: boolean; modelId: string; storageEstimate?: StorageEstimateInfo }> {
    const cached = await isModelCached(modelId);
    const storageEstimate = await getStorageQuota();
    return {
      isCached: cached,
      modelId,
      storageEstimate,
    };
  }

  /**
   * Purges the model cache.
   */
  public async purgeCache(modelId?: string): Promise<boolean> {
    return purgeModelCache(modelId);
  }

  /**
   * Terminates the background worker and cleans up listeners.
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.setStatus('idle', 'Worker terminated.');
    this.pendingGenerations.clear();
    this.pendingInit = null;
  }
}

/**
 * Returns the default singleton LLMClient instance.
 */
export function getLLMClient(): LLMClient {
  return LLMClient.getInstance();
}
