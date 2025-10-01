import { randomUUID } from 'crypto';

type StoredAudio = {
  id: string;
  data: Buffer;
  createdAt: number;
};

const voicemailStore: Map<string, StoredAudio> = new Map();

export function storeVoicemailMp3(data: Buffer): string {
  const id = randomUUID().replace(/-/g, '');
  voicemailStore.set(id, { id, data, createdAt: Date.now() });
  return id;
}

export function getVoicemailMp3(id: string): Buffer | undefined {
  const rec = voicemailStore.get(id);
  return rec?.data;
}


