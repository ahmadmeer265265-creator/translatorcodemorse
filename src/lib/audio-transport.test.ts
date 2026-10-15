import { describe, expect, it } from 'vitest';
import { transportButtons } from './audio-transport';

describe('transportButtons', () => {
  it('keeps Pause and Stop disabled while idle or finished, even if Morse is playable', () => {
    for (const state of ['idle', 'finished'] as const) {
      const buttons = transportButtons(state, true);
      expect(buttons.pauseDisabled).toBe(true);
      expect(buttons.stopDisabled).toBe(true);
      expect(buttons.playDisabled).toBe(false);
      expect(buttons.pauseLabel).toBe('Pause');
    }
  });

  it('enables Pause/Stop while playing and labels Resume while paused', () => {
    expect(transportButtons('playing', true)).toMatchObject({
      pauseDisabled: false,
      stopDisabled: false,
      playDisabled: true,
      pauseLabel: 'Pause',
    });
    expect(transportButtons('paused', true)).toMatchObject({
      pauseDisabled: false,
      stopDisabled: false,
      pauseLabel: 'Resume',
    });
  });
});
