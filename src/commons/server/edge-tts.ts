import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import type { Duplex } from 'node:stream';

const BASE_HOST = 'speech.platform.bing.com';
const BASE_PATH = '/consumer/speech/synthesize/readaloud/edge/v1';
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR_VERSION = '143';
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;

const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;

const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
] as const;

const SHA256_STATE = [
  0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a,
  0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2,
] as const;

const SHA256_SCHEDULE = [
  0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba,
  0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6,
  0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33,
  0xd258b060, 0x72766564,
] as const;

const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

const SHA256_ADJUSTMENT = 0xc9dc06a7;
const SHA256_BLOCK_CONSTANTS = SHA256_ROUND_CONSTANTS.map((c, i) =>
  i === 14 ? SHA256_ADJUSTMENT : c
);

const SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80;
const SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0;

const CS64_COEFFICIENTS: ReadonlyArray<readonly [number, number]> = [
  [0xe82e91b1, 0xb32700d0],
  [0x44de24c6, 0x88dff51d],
  [0x3beb65bc, 0x29514038],
  [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5],
  [0x314ef5d5, 0x26e55f3c],
  [0xe92491b1, 0x607801c6],
  [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da],
  [0xda79fa60, 0x207cc464],
  [0xbed20560, 0x3c3c74f3],
  [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1],
  [0xcb49e3c6, 0xc5626167],
];

const CS64_FACTOR = 0x82893933;
const CS64_ADJUSTMENT0 = 0xf2f90b1a;
const CS64_ADJUSTMENT1 = 0x0b1a0000;

function u32(val: number): number {
  return val >>> 0;
}

function mul32(a: number, b: number): number {
  return Math.imul(a, b) >>> 0;
}

function rotr32(val: number, bits: number): number {
  const v = val >>> 0;
  return ((v >>> bits) | (v << (32 - bits))) >>> 0;
}

function rol16(val: number): number {
  const v = val >>> 0;
  return ((v << 16) | (v >>> 16)) >>> 0;
}

function sigma0(val: number): number {
  const v = val >>> 0;
  return (rotr32(v, 7) ^ rotr32(v, 18) ^ (v >>> 3)) >>> 0;
}

function sigma1(val: number): number {
  const v = val >>> 0;
  return (rotr32(v, 17) ^ rotr32(v, 19) ^ (v >>> 10)) >>> 0;
}

function bigSigma0(val: number): number {
  const v = val >>> 0;
  return (rotr32(v, 2) ^ rotr32(v, 13) ^ rotr32(v, 22)) >>> 0;
}

function bigSigma1(val: number): number {
  const v = val >>> 0;
  return (rotr32(v, 6) ^ rotr32(v, 11) ^ rotr32(v, 25)) >>> 0;
}

function sha256Rounds(state: readonly number[], words: readonly number[], firstRound = 0): number[] {
  let [a, b, c, d, e, f, g, h] = state.map(u32);
  const constants = firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS;

  for (let i = firstRound; i < 64; i++) {
    const ch = (g ^ (e & (f ^ g))) >>> 0;
    const maj = ((a & b) | (c & (a | b))) >>> 0;
    const t1 = u32(h + bigSigma1(e) + ch + constants[i] + words[i]);
    const t2 = u32(bigSigma0(a) + maj);
    h = g;
    g = f;
    f = e;
    e = u32(d + t1);
    d = c;
    c = b;
    b = a;
    a = u32(t1 + t2);
  }

  return [a, b, c, d, e, f, g, h];
}

function expandSha256Schedule(words: number[], firstWord = 16): void {
  for (let i = firstWord; i < 64; i++) {
    const s1 = sigma1(words[i - 2]);
    const s0 = sigma0(words[i - 15]);
    words.push(u32(s1 + words[i - 7] + s0 + words[i - 16]));
  }
}

function sha256Init(data7: Buffer): number[] {
  const w14 = ((data7[0] << 16) | (data7[1] << 8) | data7[2]) >>> 0;
  const w15 = data7.readUInt32BE(3);
  const words: number[] = new Array(14).fill(0);
  words.push(w14, w15);

  for (let index = 16; index < 30; index++) {
    let value = SHA256_SCHEDULE[index - 16] >>> 0;
    if (index - 2 >= 14) {
      const s1 = sigma1(words[index - 2]);
      value = u32(value + (index === 16 ? (s1 ^ SHA256_SIGMA1_ADJUSTMENT) >>> 0 : s1));
    }
    if (index - 7 >= 14) {
      value = u32(value + words[index - 7]);
    }
    if (index - 15 >= 14) {
      const s0 = sigma0(words[index - 15]);
      value = u32(value + (index === 29 ? (s0 ^ SHA256_SIGMA0_ADJUSTMENT) >>> 0 : s0));
    }
    words.push(value);
  }

  words.push(
    u32(
      sigma1(words[28]) +
        words[23] +
        sigma0(words[15]) +
        words[14] +
        SHA256_ADJUSTMENT -
        SHA256_ROUND_CONSTANTS[14]
    )
  );

  expandSha256Schedule(words, 31);
  const working = sha256Rounds(SHA256_STATE, words, 14);
  return SHA256_INITIAL.map((x, i) => u32(x + working[i]));
}

function sha256Digest(data: Buffer): Buffer {
  const length = 57 + data.length;
  const padZeroCount = (55 - (length % 64) + 64) % 64;
  const tail = data.subarray(7);
  const padded = Buffer.alloc(tail.length + 1 + padZeroCount + 8);
  tail.copy(padded, 0);
  padded[tail.length] = 0x80;
  padded.writeBigUInt64BE(BigInt(length * 8), padded.length - 8);

  let state = sha256Init(data.subarray(0, 7));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words: number[] = [];
    for (let i = 0; i < 16; i++) {
      words.push(padded.readUInt32BE(offset + i * 4));
    }
    expandSha256Schedule(words, 16);
    const working = sha256Rounds(state, words, 0);
    state = state.map((x, i) => u32(x + working[i]));
  }

  const out = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    out.writeUInt32BE(state[i], i * 4);
  }
  return out;
}

function wordsLe4Even(data: Buffer): number[] {
  const rem = (4 - (data.length % 4)) % 4;
  const padded = rem > 0 ? Buffer.concat([data, Buffer.alloc(rem)]) : data;
  const words: number[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    words.push(padded.readUInt32LE(i));
  }
  if (words.length % 2 === 1) {
    words.push(0);
  }
  return words;
}

function cs64Digest(data: Buffer, digest: Buffer): [number, number] {
  const keyA = (digest.readUInt32LE(0) | 1) >>> 0;
  const keyB = (digest.readUInt32LE(4) | 1) >>> 0;
  const factors: [number, number] = [mul32(keyA, CS64_FACTOR), mul32(keyB, CS64_FACTOR)];

  const terms: number[] = CS64_COEFFICIENTS.map(([coeff], idx) => mul32(coeff, factors[idx % 2]));
  const offsets: number[] = CS64_COEFFICIENTS.map(([, offset]) => offset >>> 0);

  const words = wordsLe4Even(Buffer.concat([Buffer.from([0x00]), data]));
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    let term = mul32(word, index % 2 === 0 ? keyA : keyB);
    let offset = mul32(rol16(word), index % 2 === 0 ? 0xef0569fb : 0xc31713db);
    if (index === 0) {
      term = u32(term + mul32(CS64_ADJUSTMENT0, factors[0]));
      offset = u32(offset + CS64_ADJUSTMENT1);
    }
    terms.push(term);
    offsets.push(offset);
  }

  let swapAcc = 0;
  let swapLast = 0;
  let state = 0;
  let acc = 0;

  for (let index = 0; index < terms.length; index += 2) {
    const x = terms[index];
    const y = terms[index + 1];

    let t = rol16(u32(offsets[index] + x));
    let q = mul32(t, 0x76f50f34);
    swapAcc = u32(swapAcc + u32(mul32(rol16(q), 0xc3efea97) + q));

    t = rol16(u32(offsets[index + 1] + y));
    q = mul32(t, 0x1881ce3c);
    swapLast = u32(mul32(rol16(q), 0x35bd1ec9) + q);
    swapAcc = u32(swapAcc + swapLast);

    state = u32(mul32(state, keyA) + x);
    state = mul32(rol16(state), 0xcf98b111);
    state = mul32(rol16(state), 0x87085b9f);
    state = mul32(rol16(state), 0x12ceb96d);
    state = mul32(rol16(state), 0x257e1d83);
    acc = u32(acc + state);

    t = u32(mul32(state, keyB) + y);
    t = mul32(rol16(t), 0xa27416f5);
    t = mul32(rol16(t), 0xd38396ff);
    state = mul32(rol16(mul32(rol16(t), 0x7c932b89)), 0xbfa49f69);
    acc = u32(acc + state);
  }

  return [(swapLast ^ state) >>> 0, (swapAcc ^ acc) >>> 0];
}

let clockSkewSeconds = 0;

export function generateSecMsGecV2(unixTimestampSec?: number): string {
  let ticks = unixTimestampSec !== undefined ? unixTimestampSec : Date.now() / 1000 + clockSkewSeconds;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= S_TO_NS / 100;

  const strToHash = Buffer.from(`${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`, 'ascii');
  const digest = sha256Digest(strToHash);
  const [cs0, cs1] = cs64Digest(strToHash, digest);
  const csBuf = Buffer.alloc(8);
  csBuf.writeUInt32LE(cs0, 0);
  csBuf.writeUInt32LE(cs1, 4);

  return `${csBuf.toString('hex').toUpperCase()}-${digest.toString('hex').toUpperCase()}`;
}

export interface EdgeTtsChunk {
  type: 'audio' | 'WordBoundary';
  data?: Buffer;
  offset?: number;
  duration?: number;
  text?: string;
}

export interface EdgeTtsOptions {
  voice?: string;
  rate?: string;
  pitch?: string;
  volume?: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function encodeWsTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  const maskKey = crypto.randomBytes(4);
  let header: Buffer;

  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text frame
    header[1] = 0x80 | payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    masked[i] = payload[i] ^ maskKey[i % 4];
  }

  return Buffer.concat([header, maskKey, masked]);
}

async function openEdgeTtsTurn(
  textChunk: string,
  voice: string,
  rate: string,
  pitch: string,
  volume: string,
  offsetCompensation: number
): Promise<{ chunks: EdgeTtsChunk[]; nextOffsetCompensation: number }> {
  const connectionId = crypto.randomUUID().replace(/-/g, '');
  const secMsGec = generateSecMsGecV2();
  const wsKey = crypto.randomBytes(16).toString('base64');
  const muid = crypto.randomBytes(16).toString('hex').toUpperCase();

  const reqPath = `${BASE_PATH}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      host: BASE_HOST,
      port: 443,
      path: reqPath,
      method: 'GET',
      headers: {
        Host: BASE_HOST,
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: `muid=${muid};`,
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': wsKey,
      },
    });

    req.on('response', (res) => {
      const dateHeader = res.headers['date'];
      if (res.statusCode === 403 && typeof dateHeader === 'string') {
        const serverSec = new Date(dateHeader).getTime() / 1000;
        if (Number.isFinite(serverSec)) {
          const clientSec = Date.now() / 1000 + clockSkewSeconds;
          clockSkewSeconds += serverSec - clientSec;
        }
      }
      reject(new Error(`Edge TTS handshake HTTP ${res.statusCode}`));
    });

    req.on('error', (err) => reject(err));

    req.on('upgrade', (_res, socket: Duplex, head: Buffer) => {
      const chunks: EdgeTtsChunk[] = [];
      let chunkAudioBytes = 0;
      let rxBuffer: Buffer = head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);
      let settled = false;

      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (err) {
          reject(err);
        } else {
          // 48kbps CBR MP3 => 6000 bytes/sec => * 10,000,000 ticks/sec
          const durationTicks = Math.floor((chunkAudioBytes * 8 * 10_000_000) / 48_000);
          resolve({ chunks, nextOffsetCompensation: offsetCompensation + durationTicks });
        }
      };

      const timestamp = new Date().toUTCString();
      const configMsg =
        `X-Timestamp:${timestamp}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`;

      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${voice}'>` +
        `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
        `${escapeXml(textChunk)}` +
        `</prosody></voice></speak>`;

      const ssmlMsg =
        `X-RequestId:${ crypto.randomUUID().replace(/-/g, '') }\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${timestamp}Z\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml;

      socket.write(encodeWsTextFrame(configMsg));
      socket.write(encodeWsTextFrame(ssmlMsg));

      const processFrames = () => {
        while (rxBuffer.length >= 2) {
          const byte0 = rxBuffer[0];
          const byte1 = rxBuffer[1];
          const opcode = byte0 & 0x0f;
          const isMasked = (byte1 & 0x80) !== 0;
          let payloadLen = byte1 & 0x7f;
          let offset = 2;

          if (payloadLen === 126) {
            if (rxBuffer.length < 4) return;
            payloadLen = rxBuffer.readUInt16BE(2);
            offset = 4;
          } else if (payloadLen === 127) {
            if (rxBuffer.length < 10) return;
            payloadLen = Number(rxBuffer.readBigUInt64BE(2));
            offset = 10;
          }

          const maskBytes = isMasked ? 4 : 0;
          if (rxBuffer.length < offset + maskBytes + payloadLen) return;

          let payload = rxBuffer.subarray(offset + maskBytes, offset + maskBytes + payloadLen);
          if (isMasked) {
            const mask = rxBuffer.subarray(offset, offset + 4);
            const unmasked = Buffer.alloc(payloadLen);
            for (let i = 0; i < payloadLen; i++) {
              unmasked[i] = payload[i] ^ mask[i % 4];
            }
            payload = unmasked;
          }

          rxBuffer = rxBuffer.subarray(offset + maskBytes + payloadLen);

          if (opcode === 0x01) {
            // Text frame
            const text = payload.toString('utf8');
            const sepIdx = text.indexOf('\r\n\r\n');
            if (sepIdx !== -1) {
              const headerPart = text.slice(0, sepIdx);
              const bodyPart = text.slice(sepIdx + 4);
              if (headerPart.includes('Path:audio.metadata')) {
                try {
                  const parsed = JSON.parse(bodyPart) as {
                    Metadata?: Array<{
                      Type?: string;
                      Data?: { Offset?: number; Duration?: number; text?: { Text?: string } };
                    }>;
                  };
                  for (const meta of parsed.Metadata || []) {
                    if (meta.Type === 'WordBoundary' && meta.Data) {
                      chunks.push({
                        type: 'WordBoundary',
                        offset: (meta.Data.Offset || 0) + offsetCompensation,
                        duration: meta.Data.Duration || 0,
                        text: unescapeXml(meta.Data.text?.Text || ''),
                      });
                    }
                  }
                } catch {
                  // Ignore malformed metadata frame
                }
              } else if (headerPart.includes('Path:turn.end')) {
                finish();
                return;
              }
            }
          } else if (opcode === 0x02) {
            // Binary frame
            if (payload.length >= 2) {
              const headerLen = payload.readUInt16BE(0);
              if (payload.length >= headerLen + 2) {
                const headerStr = payload.subarray(2, 2 + headerLen).toString('utf8');
                const audioData = payload.subarray(2 + headerLen);
                if (headerStr.includes('Path:audio') && audioData.length > 0) {
                  chunkAudioBytes += audioData.length;
                  chunks.push({ type: 'audio', data: Buffer.from(audioData) });
                }
              }
            }
          } else if (opcode === 0x08) {
            // Close frame
            finish();
            return;
          } else if (opcode === 0x09) {
            // Ping -> Pong
            const pong = Buffer.alloc(2 + payload.length);
            pong[0] = 0x8a;
            pong[1] = payload.length;
            payload.copy(pong, 2);
            socket.write(pong);
          }
        }
      };

      if (rxBuffer.length > 0) {
        processFrames();
      }

      socket.on('data', (chunk: Buffer) => {
        rxBuffer = Buffer.concat([rxBuffer, chunk]);
        processFrames();
      });

      socket.on('end', () => finish());
      socket.on('error', (err) => finish(err));
    });

    req.end();
  });
}

export class EdgeTtsCommunicate {
  private readonly text: string;
  private readonly voice: string;
  private readonly rate: string;
  private readonly pitch: string;
  private readonly volume: string;

  constructor(text: string, options: EdgeTtsOptions = {}) {
    this.text = text;
    this.voice = options.voice || 'de-DE-FlorianMultilingualNeural';
    this.rate = options.rate || '+0%';
    this.pitch = options.pitch || '+0Hz';
    this.volume = options.volume || '+0%';
  }

  async *stream(): AsyncGenerator<EdgeTtsChunk, void, void> {
    let offsetCompensation = 0;
    let result: { chunks: EdgeTtsChunk[]; nextOffsetCompensation: number };
    try {
      result = await openEdgeTtsTurn(
        this.text,
        this.voice,
        this.rate,
        this.pitch,
        this.volume,
        offsetCompensation
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes('HTTP 403')) {
        // Retry once after automatic clock-skew adjustment from server Date header
        result = await openEdgeTtsTurn(
          this.text,
          this.voice,
          this.rate,
          this.pitch,
          this.volume,
          offsetCompensation
        );
      } else {
        throw err;
      }
    }

    offsetCompensation = result.nextOffsetCompensation;
    for (const chunk of result.chunks) {
      yield chunk;
    }
  }
}

export interface TtsLexicon {
  acronyms: Record<string, string>;
  phonetics: Record<string, string>;
}

export const GENERATOR_VERSION = 'v5-florian-minimal';

export function getSlideAudioCacheDir(presentationId: string): string {
  return path.resolve('.cache/slides-audio', presentationId);
}

let cachedLexicon: TtsLexicon | null = null;

export function loadTtsLexicon(): TtsLexicon {
  if (cachedLexicon) return cachedLexicon;
  const lexiconPath = path.resolve('src/content/presentations/tts-lexicon.json');
  if (fs.existsSync(lexiconPath)) {
    try {
      cachedLexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf8')) as TtsLexicon;
      return cachedLexicon;
    } catch {
      // Fallback to empty lexicon
    }
  }
  cachedLexicon = { acronyms: {}, phonetics: {} };
  return cachedLexicon;
}

export function applyLexicon(text: string, lexicon: Partial<TtsLexicon>): string {
  if (!text) return '';
  let result = text;
  const allMappings: Record<string, string> = {
    ...(lexicon.phonetics || {}),
    ...(lexicon.acronyms || {}),
  };
  const sortedKeys = Object.keys(allMappings).sort((a, b) => b.length - a.length);
  for (const term of sortedKeys) {
    const replacement = allMappings[term];
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu');
    result = result.replace(regex, replacement);
  }
  return result;
}

function normalizeWord(w?: string): string {
  return (w || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

interface WordBoundary {
  offsetSec: number;
  durationSec: number;
  text: string;
}

function findAnchorWordBoundary(
  targetWord: string | undefined,
  seedIndex: number,
  wordBoundaries: WordBoundary[]
): number {
  if (!targetWord || wordBoundaries.length === 0) {
    return Math.min(Math.max(0, seedIndex), wordBoundaries.length - 1);
  }
  const targetNorm = normalizeWord(targetWord);
  if (!targetNorm) {
    return Math.min(Math.max(0, seedIndex), wordBoundaries.length - 1);
  }
  const minIdx = Math.max(0, seedIndex - 12);
  const maxIdx = Math.min(wordBoundaries.length, seedIndex + 30);
  let bestIdx = -1;
  let minDistance = Infinity;

  for (let i = minIdx; i < maxIdx; i++) {
    const boundaryNorm = normalizeWord(wordBoundaries[i].text);
    if (boundaryNorm === targetNorm) {
      const dist = Math.abs(i - seedIndex);
      if (dist < minDistance) {
        minDistance = dist;
        bestIdx = i;
      }
    }
  }
  if (bestIdx !== -1) return bestIdx;

  for (let i = minIdx; i < maxIdx; i++) {
    const boundaryNorm = normalizeWord(wordBoundaries[i].text);
    if (boundaryNorm && (targetNorm.startsWith(boundaryNorm) || boundaryNorm.startsWith(targetNorm))) {
      const dist = Math.abs(i - seedIndex);
      if (dist < minDistance) {
        minDistance = dist;
        bestIdx = i;
      }
    }
  }
  if (bestIdx !== -1) return bestIdx;

  return Math.min(Math.max(0, seedIndex), wordBoundaries.length - 1);
}

interface CueExtraction {
  id: string;
  startWordIndex: number;
  endWordIndex?: number;
  wordAfter?: string;
  wordBefore?: string;
}

export function extractCuesAndCleanText(rawVoiceover: string): {
  cleanText: string;
  cues: CueExtraction[];
} {
  const tagRegex = /\{cue:([a-zA-Z0-9_-]+)\}|\{\/cue\}/g;
  let cleanText = '';
  const cues: CueExtraction[] = [];
  const openSpans: CueExtraction[] = [];

  let lastIndex = 0;
  let currentWordCount = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(rawVoiceover)) !== null) {
    const textBefore = rawVoiceover.slice(lastIndex, match.index);
    if (textBefore) {
      cleanText += textBefore;
      const words = textBefore.trim().split(/\s+/).filter(Boolean);
      currentWordCount += words.length;
    }
    lastIndex = tagRegex.lastIndex;

    if (match[0].startsWith('{cue:')) {
      const id = match[1];
      const textAfter = rawVoiceover.slice(lastIndex).replace(/\{cue:[^}]+\}|\{\/cue\}/g, '').trim();
      const firstWord =
        textAfter.split(/\s+/)[0]?.replace(/^[^\p{L}\p{N}]+/gu, '').replace(/[^\p{L}\p{N}]+$/gu, '') || '';
      const cueObj: CueExtraction = {
        id,
        startWordIndex: currentWordCount,
        wordAfter: firstWord,
      };
      cues.push(cueObj);
      openSpans.push(cueObj);
    } else if (match[0] === '{/cue}') {
      const lastSpan = openSpans.pop();
      if (lastSpan) {
        lastSpan.endWordIndex = currentWordCount;
        const cleanBefore = cleanText.trim();
        const lastWord =
          cleanBefore.split(/\s+/).pop()?.replace(/^[^\p{L}\p{N}]+/gu, '').replace(/[^\p{L}\p{N}]+$/gu, '') || '';
        lastSpan.wordBefore = lastWord;
      }
    }
  }

  const trailingText = rawVoiceover.slice(lastIndex);
  if (trailingText) {
    cleanText += trailingText;
  }

  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  return { cleanText, cues };
}

function safeWriteJson<T>(filePath: string, data: T): void {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return;
    } catch (e) {
      if (attempt === 3) throw e;
      const end = Date.now() + 150;
      while (Date.now() < end) {}
    }
  }
}

function safeWriteBuffer(filePath: string, buffer: Buffer): void {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      fs.writeFileSync(filePath, buffer);
      return;
    } catch (e) {
      if (attempt === 3) throw e;
      const end = Date.now() + 200;
      while (Date.now() < end) {}
    }
  }
}

// Concurrency semaphore (max 2 parallel Edge-TTS WebSocket requests)
let activeSynthesisCount = 0;
const synthesisWaitQueue: Array<() => void> = [];

async function withSynthesisSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  if (activeSynthesisCount >= 2) {
    await new Promise<void>((resolve) => synthesisWaitQueue.push(resolve));
  }
  activeSynthesisCount++;
  try {
    return await fn();
  } finally {
    activeSynthesisCount--;
    const next = synthesisWaitQueue.shift();
    if (next) next();
  }
}

const presentationAudioCaches = new Map<string, Record<string, string>>();
const inFlightSlideSyntheses = new Map<string, Promise<{ mp3Path: string; cuesPath: string; synthesized: boolean }>>();

export function getPresentationAudioCache(presentationId: string): Record<string, string> {
  const existing = presentationAudioCaches.get(presentationId);
  if (existing) return existing;
  const audioDir = getSlideAudioCacheDir(presentationId);
  const cacheFile = path.join(audioDir, '.cache.json');
  let cache: Record<string, string> = {};
  if (fs.existsSync(cacheFile)) {
    try {
      cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as Record<string, string>;
    } catch {
      cache = {};
    }
  }
  presentationAudioCaches.set(presentationId, cache);
  return cache;
}

export function savePresentationAudioCache(presentationId: string, cache: Record<string, string>): void {
  const audioDir = getSlideAudioCacheDir(presentationId);
  fs.mkdirSync(audioDir, { recursive: true });
  const cacheFile = path.join(audioDir, '.cache.json');
  presentationAudioCaches.set(presentationId, cache);
  safeWriteJson(cacheFile, cache);
}

export async function ensureSlideAudio(
  presentationId: string,
  slideId: string,
  rawVoiceover: string,
  options?: { force?: boolean; voice?: string }
): Promise<{ mp3Path: string; cuesPath: string; synthesized: boolean }> {
  const audioDir = getSlideAudioCacheDir(presentationId);
  fs.mkdirSync(audioDir, { recursive: true });

  const mp3Path = path.join(audioDir, `${slideId}.mp3`);
  const cuesPath = path.join(audioDir, `${slideId}.cues.json`);

  if (!rawVoiceover.trim()) {
    return { mp3Path, cuesPath, synthesized: false };
  }

  const lexicon = loadTtsLexicon();
  const { cleanText, cues } = extractCuesAndCleanText(rawVoiceover);
  const spokenText = applyLexicon(cleanText, lexicon);
  const normalizedVo = rawVoiceover.replace(/\s+/g, ' ').trim();
  const hash = crypto.createHash('md5').update(`${GENERATOR_VERSION}:${spokenText}:${normalizedVo}`).digest('hex');

  const cache = getPresentationAudioCache(presentationId);
  const force = Boolean(options?.force);

  if (!force && cache[slideId] === hash && fs.existsSync(mp3Path) && fs.existsSync(cuesPath)) {
    return { mp3Path, cuesPath, synthesized: false };
  }

  const flightKey = `${presentationId}/${slideId}:${hash}`;
  const existingFlight = inFlightSlideSyntheses.get(flightKey);
  if (existingFlight) {
    return existingFlight;
  }

  const taskPromise = withSynthesisSemaphore(async () => {
    const selectedVoice = options?.voice || 'de-DE-FlorianMultilingualNeural';
    console.log(`  ▶ [Edge-TTS] Synthesizing audio for ${presentationId}/${slideId} (${selectedVoice})...`);

    const communicate = new EdgeTtsCommunicate(spokenText, {
      voice: selectedVoice,
      rate: '+0%',
      pitch: '+0Hz',
    });

    const audioChunks: Buffer[] = [];
    const wordBoundaries: WordBoundary[] = [];

    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        audioChunks.push(Buffer.from(chunk.data));
      } else if (chunk.type === 'WordBoundary') {
        const sec = (chunk.offset || 0) / 10000000;
        const dur = (chunk.duration || 0) / 10000000;
        wordBoundaries.push({ offsetSec: sec, durationSec: dur, text: chunk.text || '' });
      }
    }

    if (audioChunks.length > 0) {
      const finalAudioBuffer = Buffer.concat(audioChunks);
      safeWriteBuffer(mp3Path, finalAudioBuffer);

      const cuesMap: Record<string, { start: number; duration?: number; end?: number }> = {};
      for (const cue of cues) {
        if (wordBoundaries.length === 0) {
          cuesMap[cue.id] = { start: 0, duration: 0.5 };
          continue;
        }
        const targetAfter = cue.wordAfter ? applyLexicon(cue.wordAfter, lexicon).trim().split(/\s+/)[0] : '';
        const startIndex = findAnchorWordBoundary(targetAfter, cue.startWordIndex, wordBoundaries);
        const startBoundary = wordBoundaries[startIndex];
        const startSec = Number(startBoundary.offsetSec.toFixed(2));

        if (cue.endWordIndex !== undefined) {
          const targetBefore = cue.wordBefore ? applyLexicon(cue.wordBefore, lexicon).trim().split(/\s+/).pop() : '';
          const endIndex = Math.max(
            startIndex,
            findAnchorWordBoundary(targetBefore, cue.endWordIndex - 1, wordBoundaries)
          );
          const endBoundary = wordBoundaries[endIndex];
          const endSec = Number(((endBoundary.offsetSec || 0) + (endBoundary.durationSec || 0)).toFixed(2));
          const durationSec = Number(Math.max(0.1, endSec - startSec).toFixed(2));
          cuesMap[cue.id] = {
            start: startSec,
            duration: durationSec,
            end: endSec,
          };
        } else {
          cuesMap[cue.id] = {
            start: startSec,
          };
        }
      }

      safeWriteJson(cuesPath, cuesMap);
      cache[slideId] = hash;
      savePresentationAudioCache(presentationId, cache);
      console.log(
        `    ✓ [Edge-TTS] Saved ${slideId}.mp3 (${(finalAudioBuffer.length / 1024).toFixed(1)} KB) and ${Object.keys(cuesMap).length} cues.`
      );
    }

    return { mp3Path, cuesPath, synthesized: true };
  }).finally(() => {
    inFlightSlideSyntheses.delete(flightKey);
  });

  inFlightSlideSyntheses.set(flightKey, taskPromise);
  return taskPromise;
}
