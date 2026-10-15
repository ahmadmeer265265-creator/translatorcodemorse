export type PlaybackState = 'idle' | 'playing' | 'paused' | 'finished';

export type TransportButtons = {
  playDisabled: boolean;
  pauseDisabled: boolean;
  stopDisabled: boolean;
  pauseLabel: 'Pause' | 'Resume';
  wavDisabled: boolean;
};

/** Pure transport enablement — Pause/Stop only while playing or paused. */
export function transportButtons(state: PlaybackState, canPlay: boolean): TransportButtons {
  const active = state === 'playing' || state === 'paused';
  return {
    playDisabled: !canPlay || active,
    pauseDisabled: !active,
    stopDisabled: !active,
    pauseLabel: state === 'paused' ? 'Resume' : 'Pause',
    wavDisabled: !canPlay,
  };
}
