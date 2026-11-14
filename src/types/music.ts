export type ServiceMode = 'mock' | 'api';

export type GenerationPhase =
  | 'idle'
  | 'sampling_tokens'
  | 'decoding_midi'
  | 'synthesizing_audio'
  | 'ready'
  | 'error';

export type ArtworkPatternType =
  | 'harmonic-rings'
  | 'synaptic-mesh'
  | 'spectral-waves'
  | 'orbital-lattice'
  | 'tensor-grid';

export interface ArtworkDNA {
  seed: number;
  pattern: ArtworkPatternType;
  nodeCount: number;
  waveFrequency: number;
  harmonicRatio: number;
  rotationSpeed: number;
  ringCount: number;
  accentIntensity: number;
  symmetry: number;
}

export interface TrackMetadata {
  id: string;
  sequenceNumber: number;
  title: string;
  subtitle: string;
  audioUrl: string;
  durationSeconds: number;
  bpm: number;
  musicalKey: string;
  tokenCount: number;
  temperature: number;
  createdAt: string;
  isMock: boolean;
  artwork: ArtworkDNA;
}

export interface GenerationStatusResponse {
  jobId: string;
  phase: GenerationPhase;
  message: string;
  progress: number;
  track?: TrackMetadata;
  error?: string;
}

export interface GenerateTrackOptions {
  signal?: AbortSignal;
  onStatusUpdate?: (status: GenerationStatusResponse) => void;
}

export interface IMusicService {
  readonly mode: ServiceMode;
  requestGeneration(options?: GenerateTrackOptions): Promise<TrackMetadata>;
  getGenerationStatus(jobId: string, signal?: AbortSignal): Promise<GenerationStatusResponse>;
  getAudioUrl(trackId: string): string;
  getTrackMetadata(trackId: string, signal?: AbortSignal): Promise<TrackMetadata>;
}
