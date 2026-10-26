import { describe, expect, it } from 'vitest';
import { decodeMp3 } from 'audiobox/mp3';
import { encodeMp3FromTimeline, MP3_SAMPLE_RATES } from './mp3-encode';
import { buildTimeline, encodeWav, timelineDuration, WAV_LIMIT_MS, type Segment } from './morse-audio';
import { pcmFromWavBytes } from './wav-pcm';

const SOS = () => buildTimeline('... --- ...', { wpm: 20 });
const WAV_OPTS = { frequency: 700, volume: 0.8 };

function rms(pcm: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < pcm.length; i += 1) sum += pcm[i]! * pcm[i]!;
  return Math.sqrt(sum / Math.max(1, pcm.length));
}

describe('MP3 container', () => {
  it('produces a file starting with an MP3 frame sync', () => {
    const mp3 = encodeMp3FromTimeline(SOS(), WAV_OPTS);
    expect(mp3.length).toBeGreaterThan(400);
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1]! & 0xe0).toBe(0xe0);
  });

  it('decodes back to roughly the timeline duration', () => {
    const timeline = SOS();
    const mp3 = encodeMp3FromTimeline(timeline, WAV_OPTS);
    const decoded = decodeMp3(mp3);
    expect(decoded.sampleRate).toBe(44100);
    const decodedMs = (decoded.channelData[0]!.length / 44100) * 1000;
    expect(Math.abs(decodedMs - timelineDuration(timeline))).toBeLessThanOrEqual(80);
  });

  it('handles an empty/silent timeline without crashing', () => {
    const silent: Segment[] = [{ on: false, ms: 100 }];
    const mp3 = encodeMp3FromTimeline(silent, WAV_OPTS);
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1]! & 0xe0).toBe(0xe0);
    const decoded = decodeMp3(mp3);
    expect(decoded.sampleRate).toBe(44100);
    // All-silent PCM decodes to (near) zero energy, no NaNs.
    const pcm = decoded.channelData[0]!;
    for (let i = 0; i < pcm.length; i += 1) expect(Number.isFinite(pcm[i]!)).toBe(true);
    expect(rms(pcm)).toBeLessThan(0.01);
  });

  it('rejects timelines beyond the shared WAV limit', () => {
    const huge: Segment[] = [{ on: false, ms: WAV_LIMIT_MS + 1 }];
    expect(() => encodeMp3FromTimeline(huge, WAV_OPTS)).toThrow(RangeError);
  });

  it('rejects sample rates MPEG-1 Layer III cannot carry', () => {
    expect(MP3_SAMPLE_RATES).not.toContain(22050);
    expect(() => encodeMp3FromTimeline(SOS(), { ...WAV_OPTS, sampleRate: 22050 })).toThrow(RangeError);
  });
});

describe('MP3 respects the shared render settings', () => {
  it('volume scales the decoded signal without clipping', () => {
    const loud = decodeMp3(encodeMp3FromTimeline(SOS(), { frequency: 700, volume: 0.9 }));
    const quiet = decodeMp3(encodeMp3FromTimeline(SOS(), { frequency: 700, volume: 0.15 }));
    const loudPcm = loud.channelData[0]!;
    const quietPcm = quiet.channelData[0]!;
    let peak = 0;
    for (let i = 0; i < loudPcm.length; i += 1) peak = Math.max(peak, Math.abs(loudPcm[i]!));
    expect(peak).toBeLessThanOrEqual(1);
    const ratio = rms(loudPcm) / rms(quietPcm);
    // 0.9 / 0.15 = 6×; psychoacoustic encoding keeps tone energy close.
    expect(ratio).toBeGreaterThan(4.5);
    expect(ratio).toBeLessThan(7.5);
  });

  it('uses the same PCM the WAV path produces (no re-synthesis)', () => {
    // The MP3 path must encode exactly what encodeWav renders. Compare the
    // decoded MP3's energy against the WAV path's PCM of the same timeline.
    const timeline = SOS();
    const wav = encodeWav(timeline, { frequency: 550, volume: 0.8 });
    const wavPcm = pcmFromWavBytes(wav).channels[0]!;
    const decoded = decodeMp3(encodeMp3FromTimeline(timeline, { frequency: 550, volume: 0.8 }));
    const mp3Pcm = decoded.channelData[0]!;
    const wavRms = rms(wavPcm);
    const mp3Rms = rms(mp3Pcm);
    expect(wavRms).toBeGreaterThan(0.1);
    expect(Math.abs(mp3Rms - wavRms) / wavRms).toBeLessThan(0.35);
  });
});
