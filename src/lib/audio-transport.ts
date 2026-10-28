export type PlaybackState = 'idle' | 'playing' | 'paused' | 'finished';

export type TransportButtons = {
  playDisabled: boolean;
  playLabel: 'Play' | 'Stop';
  playIcon: '#i-play' | '#i-stop';
  playPlaying: boolean;
  pauseDisabled: boolean;
  pauseLabel: 'Pause' | 'Resume';
  wavDisabled: boolean;
};

/** Play stays enabled while a session is active so the same control can Stop. */
export function transportButtons(state: PlaybackState, canPlay: boolean): TransportButtons {
  const active = state === 'playing' || state === 'paused';
  return {
    playDisabled: !(canPlay || active),
    playLabel: active ? 'Stop' : 'Play',
    playIcon: active ? '#i-stop' : '#i-play',
    playPlaying: active,
    pauseDisabled: !active,
    pauseLabel: state === 'paused' ? 'Resume' : 'Pause',
    wavDisabled: !canPlay,
  };
}
