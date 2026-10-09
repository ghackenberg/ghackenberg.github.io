/**
 * Types and interfaces for the WebGPU In-Browser LLM Runtime.
 *
 * Supports Transformers.js-based causal text generation with WebGPU acceleration,
 * WASM fallback, fine-grained model caching, streaming generation, and Qwen2.5 chat templates.
 */

import type { UnifiedAvatarContext } from '@commons/client/context/types.ts';
import type { ClientSearchResult } from '@commons/client/search/types.ts';

/**
 * Execution device for model inference
 */
export type LLMDevice = 'webgpu' | 'wasm' | 'cpu';

/**
 * Quantization precision or dtype
 */
export type ModelDtype = 'q4' | 'fp16' | 'fp32' | 'q8' | 'q4f16';

/**
 * Lifecycle state of the in-browser LLM runtime
 */
export type LLMStatus =
  | 'idle'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'generating'
  | 'error';

/**
 * Address tone detected from user input
 */
export type AddressTone = 'du' | 'sie' | 'neutral';

/**
 * Supported conversational language
 */
export type SupportedLanguage = 'de' | 'en';

/**
 * Specification and metadata for an in-browser model
 */
export interface ModelConfig {
  id: string;
  name: string;
  sizeBytes: number;
  dtype: ModelDtype;
  contextLength: number;
  defaultDevice: LLMDevice;
  vramRequiredBytes?: number;
  description: string;
}

/**
 * Canonical model registry for the avatar runtime
 */
export const SUPPORTED_MODELS: Record<string, ModelConfig> = {
  'qwen-0.5b': {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    name: 'Qwen2.5-0.5B-Instruct (q4)',
    sizeBytes: 395_000_000,
    dtype: 'q4',
    contextLength: 32_768,
    defaultDevice: 'webgpu',
    vramRequiredBytes: 550_000_000,
    description: 'Ultra-fast, lightweight model ideal for immediate client-side inference on all devices.',
  },
  'qwen-1.5b': {
    id: 'onnx-community/Qwen2.5-1.5B-Instruct',
    name: 'Qwen2.5-1.5B-Instruct (q4)',
    sizeBytes: 1_050_000_000,
    dtype: 'q4',
    contextLength: 32_768,
    defaultDevice: 'webgpu',
    vramRequiredBytes: 1_400_000_000,
    description: 'Higher reasoning depth and nuanced synthesis for powerful WebGPU desktop clients.',
  },
};

/**
 * Default model identifier
 */
export const DEFAULT_MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';

/**
 * Fine-grained asset download and cache loading progress
 */
export interface DownloadProgress {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready' | 'progress_total' | string;
  file?: string;
  name?: string;
  progress: number; // 0 to 100
  loaded?: number; // Bytes loaded
  total?: number; // Total bytes expected
}

/**
 * Sampling and generation options
 */
export interface GenerationOptions {
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
  repetitionPenalty?: number;
  stopSequences?: string[];
  doSample?: boolean;
  onToken?: (token: string, accumulatedText: string) => void;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Individual token or chunk emitted during streaming generation
 */
export interface StreamChunk {
  id: string;
  token: string;
  text: string;
  isDone: boolean;
  usage?: TokenUsage;
}

/**
 * Storage quota estimate from Cache API / OPFS
 */
export interface StorageEstimateInfo {
  quota: number;
  usage: number;
  percentUsed: number;
  available: number;
}

/**
 * Single chat message within a conversation
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Grounded prompt builder options
 */
export interface GroundedPromptOptions {
  userQuery: string;
  context?: UnifiedAvatarContext;
  ragResults?: ClientSearchResult[];
  chatHistory?: ChatMessage[];
  forceTone?: AddressTone;
  forceLang?: SupportedLanguage;
}

/**
 * Grounded prompt builder output
 */
export interface GroundedPromptResult {
  systemPrompt: string;
  userPrompt: string;
  chatMessages: ChatMessage[];
  fullChatPrompt: string;
  detectedTone: AddressTone;
  detectedLang: SupportedLanguage;
}

// ============================================================================
// Web Worker Messaging Protocol
// ============================================================================

export interface WorkerInitMessage {
  type: 'init';
  modelId?: string;
  dtype?: ModelDtype;
  device?: LLMDevice;
}

export type WorkerGenerationOptions = Omit<GenerationOptions, 'onToken'>;

export interface WorkerGenerateMessage {
  type: 'generate';
  id: string;
  prompt: string;
  options?: WorkerGenerationOptions;
}

export interface WorkerAbortMessage {
  type: 'abort';
  id?: string;
}

export interface WorkerResetMessage {
  type: 'reset';
}

export interface WorkerCheckCacheMessage {
  type: 'check_cache';
  modelId?: string;
}

export interface WorkerPurgeCacheMessage {
  type: 'purge_cache';
  modelId?: string;
}

export type WorkerInMessage =
  | WorkerInitMessage
  | WorkerGenerateMessage
  | WorkerAbortMessage
  | WorkerResetMessage
  | WorkerCheckCacheMessage
  | WorkerPurgeCacheMessage;

export interface WorkerStatusMessage {
  type: 'status';
  status: LLMStatus;
  message?: string;
  device?: LLMDevice;
  modelId?: string;
}

export interface WorkerProgressMessage {
  type: 'progress';
  progress: DownloadProgress;
}

export interface WorkerChunkMessage {
  type: 'chunk';
  id: string;
  chunk: StreamChunk;
}

export interface WorkerCompleteMessage {
  type: 'complete';
  id: string;
  fullText: string;
  usage?: TokenUsage;
}

export interface WorkerErrorMessage {
  type: 'error';
  id?: string;
  error: string;
}

export interface WorkerCacheStatusMessage {
  type: 'cache_status';
  isCached: boolean;
  modelId: string;
  storageEstimate?: StorageEstimateInfo;
}

export type WorkerOutMessage =
  | WorkerStatusMessage
  | WorkerProgressMessage
  | WorkerChunkMessage
  | WorkerCompleteMessage
  | WorkerErrorMessage
  | WorkerCacheStatusMessage;
