import type {
  ArtworkDNA,
  ArtworkPatternType,
  BackendHealthResponse,
  GenerateTrackOptions,
  GenerationStatusResponse,
  IMusicService,
  ServiceMode,
  TrackMetadata,
} from '../types/music';

const DEMO_AUDIO_POOL = [
  { url: '/audio/track-01.wav', duration: 34, bpm: 84, key: 'D Dorian' },
  { url: '/audio/track-02.wav', duration: 38, bpm: 96, key: 'F# Minor' },
  { url: '/audio/track-03.wav', duration: 32, bpm: 76, key: 'C Lydian' },
  { url: '/audio/track-04.wav', duration: 36, bpm: 90, key: 'A Aeolian' },
  { url: '/audio/track-05.wav', duration: 40, bpm: 80, key: 'E Minor' },
] as const;

const CURATED_TITLES = [
  'Echoes of Tomorrow',
  'Nocturne in Latent Space',
  'Velvet Synapse',
  'Glass Meridian',
  'Subtle Architecture',
  'Weightless Sequence',
  'Harmonic Drift',
  'Silent Tensor',
  'Ephemeral Weights',
  'Liminal Resonance',
  'Obsidian Harmonics',
  'Aether & Attention',
  'Chromatic Memory',
  'Parallel Cadence',
];

const TITLE_ADJECTIVES = [
  'Latent',
  'Synaptic',
  'Crystalline',
  'Nocturnal',
  'Quiet',
  'Orbital',
  'Tessellated',
  'Residual',
  'Modular',
  'Distant',
];

const TITLE_NOUNS = [
  'Solitude',
  'Trajectory',
  'Continuum',
  'Reflections',
  'Prelude',
  'Topology',
  'Equilibrium',
  'Horizon',
  'Harmonics',
  'Monolith',
];

const PATTERNS: ArtworkPatternType[] = [
  'harmonic-rings',
  'synaptic-mesh',
  'spectral-waves',
  'orbital-lattice',
  'tensor-grid',
];

export const GENERATION_MESSAGES = [
  'Composing something new...',
  'Connecting neural patterns...',
  'Your next sound is taking shape...',
] as const;

function createAbortError(): DOMException {
  return new DOMException('Track generation was cancelled.', 'AbortError');
}

function delayWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      window.clearTimeout(timer);
      reject(createAbortError());
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function buildArtworkDNA(seed: number, sequenceIndex: number): ArtworkDNA {
  const rand = seededRandom(seed);
  const pattern = PATTERNS[sequenceIndex % PATTERNS.length];

  return {
    seed,
    pattern,
    nodeCount: 16 + Math.floor(rand() * 20),
    waveFrequency: 1.5 + rand() * 3.5,
    harmonicRatio: 1.2 + rand() * 2.4,
    rotationSpeed: 0.12 + rand() * 0.25,
    ringCount: 5 + Math.floor(rand() * 7),
    accentIntensity: 0.65 + rand() * 0.35,
    symmetry: 3 + Math.floor(rand() * 6),
  };
}

class MusicService implements IMusicService {
  public readonly mode: ServiceMode;
  public readonly apiUrl: string;
  private readonly apiBaseUrl: string;
  private sequenceCounter = 0;
  private lastAudioIndex = -1;
  private trackStore = new Map<string, TrackMetadata>();
  private jobStore = new Map<string, GenerationStatusResponse>();

  constructor() {
    const rawMode = (import.meta.env.VITE_MUSIC_SERVICE_MODE as string | undefined)?.toLowerCase();
    // Default to 'api' so the frontend communicates with the local FastAPI backend
    this.mode = rawMode === 'mock' ? 'mock' : 'api';

    const rawApiUrl =
      (import.meta.env.VITE_API_URL as string | undefined) ||
      (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
      'http://localhost:8000';

    const cleanOrigin = rawApiUrl.replace(/\/+$/, '').replace(/\/api(\/v1)?$/, '');
    this.apiUrl = cleanOrigin;
    this.apiBaseUrl = `${cleanOrigin}/api`;
  }

  public async checkHealth(signal?: AbortSignal): Promise<BackendHealthResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`, { signal });
      if (!response.ok) {
        throw new Error(`Health check returned status ${response.status}`);
      }
      return (await response.json()) as BackendHealthResponse;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      throw new Error(
        `Backend unavailable at ${this.apiUrl}. Start the FastAPI server and try again.`
      );
    }
  }

  public async requestGeneration(options?: GenerateTrackOptions): Promise<TrackMetadata> {
    if (this.mode === 'api') {
      return this.requestApiGeneration(options);
    }
    return this.requestMockGeneration(options);
  }

  public async getGenerationStatus(
    jobId: string,
    signal?: AbortSignal
  ): Promise<GenerationStatusResponse> {
    if (this.mode === 'api') {
      let response: Response;
      try {
        response = await fetch(`${this.apiBaseUrl}/generations/${jobId}`, { signal });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw err;
        }
        throw new Error(
          `Connection to backend lost (${this.apiUrl}). Check if FastAPI is running.`
        );
      }

      if (!response.ok) {
        let detail = `Failed to fetch generation status (${response.status})`;
        try {
          const body = (await response.json()) as { detail?: string };
          if (body.detail) detail = body.detail;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(detail);
      }
      return (await response.json()) as GenerationStatusResponse;
    }

    const status = this.jobStore.get(jobId);
    if (!status) {
      throw new Error(`Generation job "${jobId}" not found.`);
    }
    return status;
  }

  public getAudioUrl(trackId: string): string {
    if (this.mode === 'api') {
      return `${this.apiBaseUrl}/tracks/${trackId}/audio`;
    }
    const cached = this.trackStore.get(trackId);
    return cached?.audioUrl ?? DEMO_AUDIO_POOL[0].url;
  }

  public async getTrackMetadata(trackId: string, signal?: AbortSignal): Promise<TrackMetadata> {
    if (this.mode === 'api') {
      const response = await fetch(`${this.apiBaseUrl}/tracks/${trackId}`, { signal });
      if (!response.ok) {
        throw new Error(`Failed to retrieve track metadata (${response.status})`);
      }
      const track = (await response.json()) as TrackMetadata;
      return this.normalizeTrackAudioUrl(track);
    }

    const cached = this.trackStore.get(trackId);
    if (!cached) {
      throw new Error(`Track "${trackId}" not found in session store.`);
    }
    return cached;
  }

  private normalizeTrackAudioUrl(track: TrackMetadata): TrackMetadata {
    let resolvedUrl = track.audioUrl;
    if (resolvedUrl.startsWith('/')) {
      resolvedUrl = `${this.apiUrl}${resolvedUrl}`;
    } else if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://')) {
      resolvedUrl = this.getAudioUrl(track.id);
    }
    return {
      ...track,
      audioUrl: resolvedUrl,
    };
  }

  private async cancelRemoteGeneration(jobId: string): Promise<void> {
    try {
      await fetch(`${this.apiBaseUrl}/generations/${jobId}`, {
        method: 'DELETE',
      });
    } catch {
      // Ignore cleanup errors when aborting
    }
  }

  /**
   * HTTP integration with the local Python/FastAPI backend:
   * - POST /api/generate -> { id: string, jobId: string, status: string }
   * - GET  /api/generations/{id} -> GenerationStatusResponse
   * - GET  /api/tracks/{id}/audio -> WAV stream
   */
  private async requestApiGeneration(options?: GenerateTrackOptions): Promise<TrackMetadata> {
    const { signal, onStatusUpdate } = options ?? {};

    let createRes: Response;
    try {
      createRes = await fetch(`${this.apiBaseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_previous: true }),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      throw new Error(
        `Backend unavailable at ${this.apiUrl}. Ensure the local FastAPI server is running.`
      );
    }

    if (!createRes.ok) {
      let detail = `Unable to start generation (${createRes.status})`;
      try {
        const errBody = (await createRes.json()) as { detail?: string };
        if (errBody.detail) detail = errBody.detail;
      } catch {
        // ignore JSON parse error
      }
      throw new Error(detail);
    }

    const created = (await createRes.json()) as { id?: string; jobId?: string };
    const generationId = created.id || created.jobId;
    if (!generationId) {
      throw new Error('Backend did not return a valid generation identifier.');
    }

    const onAbort = () => {
      void this.cancelRemoteGeneration(generationId);
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      while (true) {
        const status = await this.getGenerationStatus(generationId, signal);
        onStatusUpdate?.(status);

        const isCompleted = status.status === 'completed' || status.phase === 'ready';
        if (isCompleted && status.track) {
          const normalizedTrack = this.normalizeTrackAudioUrl(status.track);
          this.trackStore.set(normalizedTrack.id, normalizedTrack);
          return normalizedTrack;
        }

        if (status.status === 'failed' || status.phase === 'error') {
          throw new Error(status.error || 'Neural generation failed on the local backend.');
        }

        await delayWithSignal(400, signal);
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  private async requestMockGeneration(options?: GenerateTrackOptions): Promise<TrackMetadata> {
    const { signal, onStatusUpdate } = options ?? {};
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const stages: Array<{
      phase: GenerationStatusResponse['phase'];
      message: string;
      progress: number;
      durationMs: number;
    }> = [
      {
        phase: 'sampling_tokens',
        message: GENERATION_MESSAGES[0],
        progress: 0.28,
        durationMs: 680,
      },
      {
        phase: 'decoding_midi',
        message: GENERATION_MESSAGES[1],
        progress: 0.64,
        durationMs: 720,
      },
      {
        phase: 'synthesizing_audio',
        message: GENERATION_MESSAGES[2],
        progress: 0.92,
        durationMs: 650,
      },
    ];

    for (const stage of stages) {
      const status: GenerationStatusResponse = {
        jobId,
        status: 'generating',
        phase: stage.phase,
        message: stage.message,
        progress: stage.progress,
      };
      this.jobStore.set(jobId, status);
      onStatusUpdate?.(status);
      await delayWithSignal(stage.durationMs, signal);
    }

    const track = this.createMockTrack();
    this.trackStore.set(track.id, track);

    const completedStatus: GenerationStatusResponse = {
      jobId,
      status: 'completed',
      phase: 'ready',
      message: 'Composition ready',
      progress: 1,
      track,
    };
    this.jobStore.set(jobId, completedStatus);
    onStatusUpdate?.(completedStatus);

    return track;
  }

  private createMockTrack(): TrackMetadata {
    const seq = this.sequenceCounter++;
    const seed = Math.floor(Date.now() % 1000000) + seq * 7919;
    const rand = seededRandom(seed);

    let audioIndex = seq % DEMO_AUDIO_POOL.length;
    if (audioIndex === this.lastAudioIndex) {
      audioIndex = (audioIndex + 1) % DEMO_AUDIO_POOL.length;
    }
    this.lastAudioIndex = audioIndex;

    const sample = DEMO_AUDIO_POOL[audioIndex];

    let title: string;
    if (seq < CURATED_TITLES.length) {
      title = CURATED_TITLES[seq];
    } else {
      const adj = TITLE_ADJECTIVES[Math.floor(rand() * TITLE_ADJECTIVES.length)];
      const noun = TITLE_NOUNS[Math.floor(rand() * TITLE_NOUNS.length)];
      title = `${adj} ${noun}`;
    }

    const tokenCount = 512 + Math.floor(rand() * 512);
    const temperature = Number((0.82 + rand() * 0.26).toFixed(2));
    const id = `nrf-${(seed % 0xfffff).toString(16).padStart(5, '0')}`;

    return {
      id,
      sequenceNumber: seq + 1,
      title,
      subtitle: 'Generated by GPT-2 · Original composition',
      audioUrl: sample.url,
      durationSeconds: sample.duration,
      bpm: sample.bpm,
      musicalKey: sample.key,
      tokenCount,
      temperature,
      createdAt: new Date().toISOString(),
      isMock: true,
      artwork: buildArtworkDNA(seed, seq),
    };
  }
}

export const musicService = new MusicService();
