import fs from 'node:fs';
import path from 'node:path';

// MPEG Version Constants
const MPEG_VERSION_2_5 = 0;
const MPEG_VERSION_RESERVED = 1;
const MPEG_VERSION_2 = 2;
const MPEG_VERSION_1 = 3;

// Bitrate lookup tables (kbps) [version][layer][bitrateIndex]
const BITRATES: Record<number, Record<number, number[]>> = {
  [MPEG_VERSION_1]: {
    1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  },
  [MPEG_VERSION_2]: {
    1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  },
};
BITRATES[MPEG_VERSION_2_5] = BITRATES[MPEG_VERSION_2];

// Sample rate lookup tables (Hz) [version][sampleRateIndex]
const SAMPLE_RATES: Record<number, number[]> = {
  [MPEG_VERSION_1]: [44100, 48000, 32000],
  [MPEG_VERSION_2]: [22050, 24000, 16000],
  [MPEG_VERSION_2_5]: [11025, 12000, 8000],
};

// Samples per frame [version][layer]
const SAMPLES_PER_FRAME: Record<number, Record<number, number>> = {
  [MPEG_VERSION_1]: { 1: 384, 2: 1152, 3: 1152 },
  [MPEG_VERSION_2]: { 1: 384, 2: 1152, 3: 576 },
  [MPEG_VERSION_2_5]: { 1: 384, 2: 1152, 3: 576 },
};

// In-memory duration cache to eliminate redundant disk reads across builds and slide iterations
const durationCache = new Map<string, number>();

/**
 * Computes exact duration in seconds for an MP3 audio file.
 * Accurately parses Xing/Info headers, VBRI headers, or iterates MPEG audio frame headers.
 * Results are cached in-memory and rounded to 2 decimal places.
 *
 * @param filePath Absolute or relative path to the MP3 file on disk.
 * @returns Duration in seconds (e.g. 42.5).
 */
export function getMp3Duration(filePath: string): number {
  const resolvedPath = path.resolve(filePath);
  const cached = durationCache.get(resolvedPath);
  if (cached !== undefined) {
    return cached;
  }

  if (!fs.existsSync(resolvedPath)) {
    return 0;
  }

  let buf: Buffer;
  try {
    buf = fs.readFileSync(resolvedPath);
  } catch {
    return 0;
  }

  let offset = 0;

  // Skip ID3v2 header if present
  if (buf.length >= 10 && buf.subarray(0, 3).toString('ascii') === 'ID3') {
    const size =
      ((buf[6] & 0x7f) << 21) |
      ((buf[7] & 0x7f) << 14) |
      ((buf[8] & 0x7f) << 7) |
      (buf[9] & 0x7f);
    const footer = buf[5] & 0x10 ? 10 : 0;
    offset = 10 + size + footer;
  }

  let totalDuration = 0;
  let frameCount = 0;

  while (offset + 4 <= buf.length) {
    // Check MPEG Audio sync word (11 consecutive 1 bits: 0xFF followed by 0xE0 mask)
    if (buf[offset] === 0xff && (buf[offset + 1] & 0xe0) === 0xe0) {
      const versionBits = (buf[offset + 1] >> 3) & 0x03;
      const layerBits = (buf[offset + 1] >> 1) & 0x03;
      const layer = layerBits === 3 ? 1 : layerBits === 2 ? 2 : layerBits === 1 ? 3 : 0;

      if (versionBits !== MPEG_VERSION_RESERVED && layer !== 0) {
        const bitrateIdx = (buf[offset + 2] >> 4) & 0x0f;
        const sampleRateIdx = (buf[offset + 2] >> 2) & 0x03;
        const padding = (buf[offset + 2] >> 1) & 0x01;

        const sampleRate = SAMPLE_RATES[versionBits]?.[sampleRateIdx];
        const bitrateKbps = BITRATES[versionBits]?.[layer]?.[bitrateIdx];
        const samples = SAMPLES_PER_FRAME[versionBits]?.[layer];

        if (sampleRate && bitrateKbps && bitrateKbps > 0 && samples) {
          // On the first valid frame, check for Xing / Info or VBRI VBR headers
          if (frameCount === 0) {
            const channelMode = (buf[offset + 3] >> 6) & 0x03;
            const isMono = channelMode === 3;
            const sideInfoLen =
              versionBits === MPEG_VERSION_1 ? (isMono ? 17 : 32) : isMono ? 9 : 17;
            const xingOffset = offset + 4 + sideInfoLen;

            if (xingOffset + 8 <= buf.length) {
              const tag = buf.subarray(xingOffset, xingOffset + 4).toString('ascii');
              if (tag === 'Xing' || tag === 'Info') {
                const flags = buf.readUInt32BE(xingOffset + 4);
                if (flags & 1) {
                  const xingFrames = buf.readUInt32BE(xingOffset + 8);
                  const result = Math.round(((xingFrames * samples) / sampleRate) * 100) / 100;
                  durationCache.set(resolvedPath, result);
                  return result;
                }
              }
            }

            // Check Fraunhofer VBRI header (always at offset + 36)
            const vbriOffset = offset + 4 + 32;
            if (vbriOffset + 18 <= buf.length) {
              const tag = buf.subarray(vbriOffset, vbriOffset + 4).toString('ascii');
              if (tag === 'VBRI') {
                const vbriFrames = buf.readUInt32BE(vbriOffset + 14);
                const result = Math.round(((vbriFrames * samples) / sampleRate) * 100) / 100;
                durationCache.set(resolvedPath, result);
                return result;
              }
            }
          }

          // Calculate frame length
          let frameLength = 0;
          if (layer === 1) {
            frameLength = Math.floor(((12 * bitrateKbps * 1000) / sampleRate + padding) * 4);
          } else {
            const mult = versionBits === MPEG_VERSION_1 ? 144 : 72;
            frameLength = Math.floor((mult * bitrateKbps * 1000) / sampleRate) + padding;
          }

          if (frameLength > 0) {
            totalDuration += samples / sampleRate;
            frameCount++;
            offset += frameLength;
            continue;
          }
        }
      }
    }
    offset++;
  }

  const result = Math.round(totalDuration * 100) / 100;
  durationCache.set(resolvedPath, result);
  return result;
}
