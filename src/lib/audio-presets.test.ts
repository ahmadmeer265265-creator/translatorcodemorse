import { describe, expect, it } from 'vitest';
import { applyPreset, matchPreset, presetFarnsworthReadout } from './audio-presets';

describe('audio presets', () => {
  it('applies Slow / Beginner / Practice / Standard / Fast', () => {
    expect(applyPreset('slow')).toEqual({ speed: 5, farnsworth: 5 });
    expect(applyPreset('beginner')).toEqual({ speed: 15, farnsworth: 5 });
    expect(applyPreset('practice')).toEqual({ speed: 20, farnsworth: 12 });
    expect(applyPreset('standard')).toEqual({ speed: 20, farnsworth: 20 });
    expect(applyPreset('fast')).toEqual({ speed: 30, farnsworth: 30 });
  });

  it('matches a preset or returns Custom when sliders differ', () => {
    expect(matchPreset({ speed: 20, farnsworth: 20 })).toBe('standard');
    expect(matchPreset({ speed: 20, farnsworth: 12 })).toBe('practice');
    expect(matchPreset({ speed: 21, farnsworth: 20 })).toBe('custom');
  });

  it('labels Farnsworth Off when equal to speed', () => {
    expect(presetFarnsworthReadout({ speed: 20, farnsworth: 20 })).toBe('Off');
    expect(presetFarnsworthReadout({ speed: 20, farnsworth: 12 })).toBe('12');
  });
});
