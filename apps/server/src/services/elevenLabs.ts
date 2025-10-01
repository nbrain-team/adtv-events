// Minimal helper to generate a TTS mp3 via ElevenLabs and return a URL.
// For production you'd proxy storage to S3/GCS; here we only expose direct URL if provided by ElevenLabs or return raw bytes.

export type GenerateTtsInput = {
  script: string;
  voiceId?: string;
  modelId?: string;
};

export type GenerateTtsResult = {
  ok: boolean;
  audioUrl?: string;
  raw?: any;
};

export async function generateTtsMp3(input: GenerateTtsInput): Promise<GenerateTtsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY || '';
  const voiceId = input.voiceId || process.env.ELEVENLABS_VOICE_ID || '';
  const modelId = input.modelId || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
  const base = process.env.ELEVENLABS_API_BASE_URL || 'https://api.elevenlabs.io/v1';

  if (!apiKey || !voiceId) {
    return { ok: false, raw: { error: 'missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID' } };
  }

  const url = `${base.replace(/\/$/, '')}/text-to-speech/${voiceId}`;
  const body = {
    text: input.script,
    model_id: modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    output_format: 'mp3_44100_128',
  } as any;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, raw: errText };
  }

  // In minimal form we cannot host the file; return a data URL for quick use or instruct caller to upload.
  const arrayBuf = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString('base64');
  const dataUrl = `data:audio/mpeg;base64,${base64}`;
  return { ok: true, audioUrl: dataUrl };
}


