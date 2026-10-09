/**
 * Dedicated Web Worker for In-Browser WebGPU LLM Inference.
 *
 * Runs Transformers.js text-generation pipelines in a background thread with:
 * 1. WebGPU hardware acceleration and automatic WASM fallback.
 * 2. Fine-grained download & loading progress reporting.
 * 3. Real-time token streaming via TextStreamer.
 * 4. Interruptible generation and cancellation support.
 */

import {
  pipeline,
  TextStreamer,
  InterruptableStoppingCriteria,
  type TextGenerationPipeline,
  type ProgressInfo,
} from '@huggingface/transformers';
import {
  DEFAULT_MODEL_ID,
  type DownloadProgress,
  type LLMDevice,
  type ModelDtype,
  type WorkerGenerationOptions,
  type WorkerInMessage,
  type WorkerOutMessage,
} from './types.ts';
import { isModelCached, purgeModelCache, getStorageQuota } from './model-cache.ts';

let generator: TextGenerationPipeline | null = null;
let currentModelId = '';
let currentDevice: LLMDevice = 'webgpu';
let currentDtype: ModelDtype = 'q4';
let stoppingCriteria: InterruptableStoppingCriteria | null = null;
let isGenerating = false;

function postWorkerMessage(message: WorkerOutMessage): void {
  self.postMessage(message);
}

function handleProgress(info: ProgressInfo): void {
  const progressPercent =
    'progress' in info && typeof info.progress === 'number'
      ? Math.round(info.progress * 100) / 100
      : 0;
  const loadedVal = 'loaded' in info ? info.loaded : undefined;
  const totalVal = 'total' in info ? info.total : undefined;
  const fileVal = 'file' in info ? info.file : undefined;
  const nameVal = 'name' in info ? info.name : undefined;

  const progressPayload: DownloadProgress = {
    status: info.status,
    file: fileVal,
    name: nameVal,
    progress: progressPercent,
    loaded: loadedVal,
    total: totalVal,
  };

  postWorkerMessage({
    type: 'progress',
    progress: progressPayload,
  });
}

/**
 * Loads text-generation pipeline with WebGPU acceleration and automatic WASM fallback.
 */
async function loadPipeline(
  modelId: string,
  dtype: ModelDtype,
  requestedDevice: LLMDevice
): Promise<{ pipeline: TextGenerationPipeline; activeDevice: LLMDevice }> {
  if (requestedDevice === 'webgpu') {
    try {
      postWorkerMessage({
        type: 'status',
        status: 'loading',
        message: 'Initializing WebGPU acceleration...',
        device: 'webgpu',
        modelId,
      });

      const pipe = (await pipeline('text-generation', modelId, {
        device: 'webgpu',
        dtype,
        progress_callback: handleProgress,
      })) as TextGenerationPipeline;

      return { pipeline: pipe, activeDevice: 'webgpu' };
    } catch (gpuErr) {
      const msg = gpuErr instanceof Error ? gpuErr.message : String(gpuErr);
      console.warn('[LLMWorker] WebGPU unavailable or failed, falling back to WASM:', msg);
    }
  }

  // Fallback to WASM
  postWorkerMessage({
    type: 'status',
    status: 'loading',
    message: 'Initializing WASM fallback runtime...',
    device: 'wasm',
    modelId,
  });

  const pipe = (await pipeline('text-generation', modelId, {
    device: 'wasm',
    dtype,
    progress_callback: handleProgress,
  })) as TextGenerationPipeline;

  return { pipeline: pipe, activeDevice: 'wasm' };
}

/**
 * Initializes or switches the model pipeline.
 */
async function initModel(
  modelId: string = DEFAULT_MODEL_ID,
  dtype: ModelDtype = 'q4',
  device: LLMDevice = 'webgpu'
): Promise<void> {
  if (generator && currentModelId === modelId && currentDevice === device && currentDtype === dtype) {
    postWorkerMessage({
      type: 'status',
      status: 'ready',
      message: `Model ${modelId} is already initialized on ${device}.`,
      device,
      modelId,
    });
    return;
  }

  try {
    postWorkerMessage({
      type: 'status',
      status: 'downloading',
      message: `Loading model ${modelId}...`,
      device,
      modelId,
    });

    const result = await loadPipeline(modelId, dtype, device);
    generator = result.pipeline;
    currentModelId = modelId;
    currentDevice = result.activeDevice;
    currentDtype = dtype;

    postWorkerMessage({
      type: 'status',
      status: 'ready',
      message: `Model ${modelId} ready on ${result.activeDevice}.`,
      device: result.activeDevice,
      modelId,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    postWorkerMessage({
      type: 'status',
      status: 'error',
      message: `Failed to load model ${modelId}: ${errorMsg}`,
      modelId,
    });
    postWorkerMessage({
      type: 'error',
      error: errorMsg,
    });
  }
}

/**
 * Executes streaming text generation with TextStreamer.
 */
async function generate(
  id: string,
  prompt: string,
  options?: WorkerGenerationOptions
): Promise<void> {
  if (!generator) {
    postWorkerMessage({
      type: 'error',
      id,
      error: 'Model pipeline is not initialized.',
    });
    return;
  }

  if (isGenerating) {
    stoppingCriteria?.interrupt();
  }

  isGenerating = true;
  stoppingCriteria = new InterruptableStoppingCriteria();

  postWorkerMessage({
    type: 'status',
    status: 'generating',
    message: 'Generating response...',
    device: currentDevice,
    modelId: currentModelId,
  });

  let accumulatedText = '';
  let tokenCount = 0;

  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunkText: string) => {
      accumulatedText += chunkText;
      tokenCount++;
      postWorkerMessage({
        type: 'chunk',
        id,
        chunk: {
          id,
          token: chunkText,
          text: accumulatedText,
          isDone: false,
        },
      });
    },
  });

  try {
    const maxNewTokens = options?.maxNewTokens ?? 512;
    const temperature = options?.temperature ?? 0.25;
    const topP = options?.topP ?? 0.9;
    const repetitionPenalty = options?.repetitionPenalty ?? 1.15;
    const doSample = options?.doSample ?? true;

    await generator(prompt, {
      max_new_tokens: maxNewTokens,
      temperature,
      top_p: topP,
      repetition_penalty: repetitionPenalty,
      do_sample: doSample,
      streamer,
      stopping_criteria: [stoppingCriteria],
      return_full_text: false,
    });

    isGenerating = false;

    postWorkerMessage({
      type: 'complete',
      id,
      fullText: accumulatedText,
      usage: {
        completionTokens: tokenCount,
      },
    });

    postWorkerMessage({
      type: 'status',
      status: 'ready',
      message: 'Generation completed.',
      device: currentDevice,
      modelId: currentModelId,
    });
  } catch (err) {
    isGenerating = false;
    const errorMsg = err instanceof Error ? err.message : String(err);
    postWorkerMessage({
      type: 'error',
      id,
      error: errorMsg,
    });
    postWorkerMessage({
      type: 'status',
      status: 'ready',
      message: `Generation ended with error: ${errorMsg}`,
      device: currentDevice,
      modelId: currentModelId,
    });
  }
}

/**
 * Web Worker message router.
 */
self.onmessage = async (event: MessageEvent<WorkerInMessage>): Promise<void> => {
  const msg = event.data;

  switch (msg.type) {
    case 'init': {
      await initModel(msg.modelId, msg.dtype, msg.device);
      break;
    }

    case 'generate': {
      await generate(msg.id, msg.prompt, msg.options);
      break;
    }

    case 'abort': {
      if (stoppingCriteria && isGenerating) {
        stoppingCriteria.interrupt();
        isGenerating = false;
      }
      postWorkerMessage({
        type: 'status',
        status: 'ready',
        message: 'Generation aborted by user.',
        device: currentDevice,
        modelId: currentModelId,
      });
      break;
    }

    case 'reset': {
      if (stoppingCriteria && isGenerating) {
        stoppingCriteria.interrupt();
        isGenerating = false;
      }
      postWorkerMessage({
        type: 'status',
        status: 'ready',
        message: 'Worker reset to idle.',
        device: currentDevice,
        modelId: currentModelId,
      });
      break;
    }

    case 'check_cache': {
      const targetModel = msg.modelId ?? DEFAULT_MODEL_ID;
      const cached = await isModelCached(targetModel);
      const estimate = await getStorageQuota();
      postWorkerMessage({
        type: 'cache_status',
        isCached: cached,
        modelId: targetModel,
        storageEstimate: estimate,
      });
      break;
    }

    case 'purge_cache': {
      const targetModel = msg.modelId;
      await purgeModelCache(targetModel);
      const estimate = await getStorageQuota();
      postWorkerMessage({
        type: 'cache_status',
        isCached: false,
        modelId: targetModel ?? DEFAULT_MODEL_ID,
        storageEstimate: estimate,
      });
      break;
    }
  }
};
