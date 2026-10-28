import { describe, expect, it } from 'vitest';
import { transportButtons } from './audio-transport';

describe('transportButtons', () => {
  it('shows Play while idle or finished, and keeps Pause disabled', () => {
    for (const state of ['idle', 'finished'] as const) {
      const buttons = transportButtons(state, true);
      expect(buttons.pauseDisabled).toBe(true);
      expect(buttons.playDisabled).toBe(false);
      expect(buttons.playLabel).toBe('Play');
      expect(buttons.playIcon).toBe('#i-play');
      expect(buttons.playPlaying).toBe(false);
      expect(buttons.pauseLabel).toBe('Pause');
    }
  });

  it('switches the Play control to Stop when playback starts', () => {
    expect(transportButtons('playing', true)).toMatchObject({
      playDisabled: false,
      playLabel: 'Stop',
      playIcon: '#i-stop',
      playPlaying: true,
      pauseDisabled: false,
      pauseLabel: 'Pause',
    });
  });

  it('keeps Stop on the Play control while paused (Pause/Resume stays separate)', () => {
    expect(transportButtons('paused', true)).toMatchObject({
      playDisabled: false,
      playLabel: 'Stop',
      playIcon: '#i-stop',
      playPlaying: true,
      pauseDisabled: false,
      pauseLabel: 'Resume',
    });
  });

  it('reverts to Play on natural end (finished) and on a fresh idle session', () => {
    expect(transportButtons('finished', true).playLabel).toBe('Play');
    expect(transportButtons('idle', true).playLabel).toBe('Play');
    expect(transportButtons('finished', true).playIcon).toBe('#i-play');
    expect(transportButtons('idle', false).playDisabled).toBe(true);
  });
});
