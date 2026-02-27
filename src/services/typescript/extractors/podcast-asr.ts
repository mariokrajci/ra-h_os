import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createReadStream } from 'fs';
import OpenAI from 'openai';

export type WhisperLocalModel = 'whisper-small' | 'whisper-medium';

export interface ASRResult {
  transcript: string;
  model: string;
  cost_usd?: number;
}

async function downloadAudioToTemp(audioUrl: string): Promise<string> {
  const res = await fetch(audioUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' },
  });
  if (!res.ok) throw new Error(`Failed to download audio: ${res.status} ${audioUrl}`);

  const contentType = res.headers.get('content-type') || 'audio/mpeg';
  const ext = contentType.includes('ogg') ? '.ogg' : contentType.includes('wav') ? '.wav' : '.mp3';
  const tempPath = join(tmpdir(), `rah-podcast-${Date.now()}${ext}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(tempPath, buffer);
  return tempPath;
}

export async function transcribeWithLocalWhisper(
  audioUrl: string,
  model: WhisperLocalModel = 'whisper-small'
): Promise<ASRResult> {
  // Polyfill AudioContext for Node.js — transformers.js uses the Web Audio API
  // to decode audio from file paths, which doesn't exist in Node.js environments.
  // node-web-audio-api implements it using native codecs (MP3, WAV, OGG, etc.).
  if (typeof AudioContext === 'undefined') {
    const { AudioContext: NodeAudioContext } = await import('node-web-audio-api');
    (globalThis as any).AudioContext = NodeAudioContext;
  }

  // Dynamic import so the large @huggingface/transformers package
  // is only loaded when local ASR is actually requested.
  const { pipeline } = await import('@huggingface/transformers');

  const modelId = model === 'whisper-medium'
    ? 'Xenova/whisper-medium'
    : 'Xenova/whisper-small';

  const tempPath = await downloadAudioToTemp(audioUrl);

  try {
    const transcriber = await pipeline('automatic-speech-recognition', modelId);
    const raw = await transcriber(tempPath, { return_timestamps: false });
    const text = Array.isArray(raw) ? (raw[0]?.text ?? '') : raw.text;
    return {
      transcript: text.trim(),
      model: modelId,
    };
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

export async function transcribeWithOpenAIApi(
  audioUrl: string,
  durationMinutes?: number
): Promise<ASRResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const tempPath = await downloadAudioToTemp(audioUrl);

  try {
    const client = new OpenAI({ apiKey });
    const transcription = await client.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'text',
    });

    const cost_usd = durationMinutes ? Math.round(durationMinutes * 0.006 * 100) / 100 : undefined;

    return {
      transcript: typeof transcription === 'string' ? transcription.trim() : '',
      model: 'whisper-1',
      cost_usd,
    };
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

export function estimateAsrCost(durationMinutes: number | undefined): string | null {
  if (!durationMinutes) return null;
  return `$${(durationMinutes * 0.006).toFixed(2)}`;
}
