import { describe, expect, it } from 'vitest';
import { changeFarnsworth, changeSpeed, farnsworthLabel } from './farnsworth';

describe('Farnsworth controls', () => {
  it('stays off and follows speed while the two values match', () => {
    const next = changeSpeed({ speed: 20, farnsworth: 20 }, 30);
    expect(next).toEqual({ speed: 30, farnsworth: 30 });
    expect(farnsworthLabel(next.speed, next.farnsworth)).toBe('Off');
  });

  it('turns on only when the Farnsworth control is set below speed', () => {
    const next = changeFarnsworth({ speed: 20, farnsworth: 20 }, 15);
    expect(next).toEqual({ speed: 20, farnsworth: 15 });
    expect(farnsworthLabel(next.speed, next.farnsworth)).toBe('15');
  });

  it('keeps an active Farnsworth value when speed rises', () => {
    const next = changeSpeed({ speed: 20, farnsworth: 15 }, 30);
    expect(next).toEqual({ speed: 30, farnsworth: 15 });
    expect(farnsworthLabel(next.speed, next.farnsworth)).toBe('15');
  });

  it('clamps an active Farnsworth value down to speed and reads Off', () => {
    const equal = changeSpeed({ speed: 20, farnsworth: 15 }, 15);
    const below = changeSpeed({ speed: 20, farnsworth: 15 }, 10);
    expect(equal).toEqual({ speed: 15, farnsworth: 15 });
    expect(below).toEqual({ speed: 10, farnsworth: 10 });
    expect(farnsworthLabel(below.speed, below.farnsworth)).toBe('Off');
  });

  it('does not leave the Farnsworth control above speed', () => {
    const next = changeFarnsworth({ speed: 20, farnsworth: 20 }, 40);
    expect(next).toEqual({ speed: 20, farnsworth: 20 });
    expect(farnsworthLabel(next.speed, next.farnsworth)).toBe('Off');
  });
});
