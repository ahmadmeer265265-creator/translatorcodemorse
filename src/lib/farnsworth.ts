export type SpeedPair = {
  speed: number;
  farnsworth: number;
};

const MIN_SPEED = 5;
const MAX_SPEED = 40;

function clampSpeed(value: number): number {
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(value)));
}

export function farnsworthLabel(speed: number, farnsworth: number): string {
  return farnsworth >= speed ? 'Off' : String(farnsworth);
}

export function changeSpeed(current: SpeedPair, nextSpeed: number): SpeedPair {
  const speed = clampSpeed(nextSpeed);
  if (current.farnsworth >= current.speed || speed <= current.farnsworth) {
    return { speed, farnsworth: speed };
  }
  return { speed, farnsworth: current.farnsworth };
}

export function changeFarnsworth(current: SpeedPair, nextFarnsworth: number): SpeedPair {
  const requested = clampSpeed(nextFarnsworth);
  return { speed: current.speed, farnsworth: Math.min(requested, current.speed) };
}
