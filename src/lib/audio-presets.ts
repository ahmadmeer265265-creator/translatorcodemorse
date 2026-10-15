import { farnsworthLabel, type SpeedPair } from './farnsworth';

export type PresetId = 'custom' | 'slow' | 'beginner' | 'practice' | 'standard' | 'fast';

export type PresetDefinition = {
  id: Exclude<PresetId, 'custom'>;
  label: string;
  speed: number;
  /** Farnsworth overall speed; equal to speed means Off */
  farnsworth: number;
};

export const AUDIO_PRESETS: readonly PresetDefinition[] = [
  { id: 'slow', label: 'Slow', speed: 5, farnsworth: 5 },
  { id: 'beginner', label: 'Beginner', speed: 15, farnsworth: 5 },
  { id: 'practice', label: 'Practice', speed: 20, farnsworth: 12 },
  { id: 'standard', label: 'Standard', speed: 20, farnsworth: 20 },
  { id: 'fast', label: 'Fast', speed: 30, farnsworth: 30 },
] as const;

export function applyPreset(id: Exclude<PresetId, 'custom'>): SpeedPair {
  const preset = AUDIO_PRESETS.find((entry) => entry.id === id);
  if (!preset) return { speed: 20, farnsworth: 20 };
  return { speed: preset.speed, farnsworth: preset.farnsworth };
}

export function matchPreset(pair: SpeedPair): PresetId {
  for (const preset of AUDIO_PRESETS) {
    if (preset.speed === pair.speed && preset.farnsworth === pair.farnsworth) return preset.id;
  }
  return 'custom';
}

export function presetSelectValue(pair: SpeedPair): PresetId {
  return matchPreset(pair);
}

export function presetFarnsworthReadout(pair: SpeedPair): string {
  return farnsworthLabel(pair.speed, pair.farnsworth);
}
