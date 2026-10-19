/**
 * Generate Morse WAV fixtures for the fake-mic e2e test, using the site's own
 * encodeWav / buildTimeline so the signal matches the Play / Download WAV path.
 * Chromium --use-file-for-fake-audio-capture expects 16-bit stereo WAV.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tests', 'e2e', 'fixtures');
fs.mkdirSync(outDir, { recursive: true });

// Load TypeScript sources via vitest/vite is heavy; compile with a tiny
// dynamic import through node's --experimental-strip-types or esbuild.
import * as esbuild from 'esbuild';

async function loadLib(rel) {
  const src = path.join(root, 'src', 'lib', rel);
  const out = path.join(root, 'node_modules', '.cache', 'mic-e2e', rel.replace(/\.ts$/, '.mjs'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await esbuild.build({
    entryPoints: [src],
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    logLevel: 'silent',
  });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}

const { encode } = await loadLib('morse.ts');
const { buildTimeline, encodeWav } = await loadLib('morse-audio.ts');

/** Duplicate mono PCM16 WAV into stereo (Chromium fake-audio prefers stereo). */
function monoToStereo(mono) {
  const view = new DataView(mono.buffer, mono.byteOffset, mono.byteLength);
  const sampleRate = view.getUint32(24, true);
  const bits = view.getUint16(34, true);
  if (bits !== 16) throw new Error(`expected 16-bit PCM, got ${bits}`);
  const dataOffset = 44;
  const monoSamples = (mono.length - dataOffset) / 2;
  const dataBytes = monoSamples * 4; // stereo
  const out = new ArrayBuffer(44 + dataBytes);
  const o = new DataView(out);
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i += 1) o.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  o.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  o.setUint32(16, 16, true);
  o.setUint16(20, 1, true); // PCM
  o.setUint16(22, 2, true); // stereo
  o.setUint32(24, sampleRate, true);
  o.setUint32(28, sampleRate * 4, true); // byte rate
  o.setUint16(32, 4, true); // block align
  o.setUint16(34, 16, true);
  writeStr(36, 'data');
  o.setUint32(40, dataBytes, true);
  for (let i = 0; i < monoSamples; i += 1) {
    const sample = view.getInt16(dataOffset + i * 2, true);
    o.setInt16(44 + i * 4, sample, true);
    o.setInt16(44 + i * 4 + 2, sample, true);
  }
  return new Uint8Array(out);
}

/** Leading silence for AudioContext setup; trailing silence to flush letter/word gaps. */
function withPad(timeline, leadMs, trailMs) {
  return [{ on: false, ms: leadMs }, ...timeline, { on: false, ms: trailMs }];
}

function writeFixture(name, timeline, meta) {
  const mono = encodeWav(timeline, {
    frequency: 600,
    volume: 1,
    sampleRate: 44100,
    soundType: 'cw',
    waveform: 'sine',
  });
  const stereo = monoToStereo(mono);
  const file = path.join(outDir, name);
  fs.writeFileSync(file, stereo);
  // Also copy to a no-space path — Chromium's --use-file-for-fake-audio-capture
  // flag parsing breaks on paths with spaces (this project's Desktop path has them).
  const runtimeDir = 'D:\\mic-e2e-fixtures';
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.copyFileSync(file, path.join(runtimeDir, name));
  const durationMs = timeline.reduce((s, seg) => s + seg.ms, 0);
  console.log(`wrote ${name} (${stereo.length} bytes, ~${Math.round(durationMs)}ms) — ${meta}`);
  return { file, durationMs };
}

// Chromium starts looping the fake-capture WAV as soon as the browser
// launches — not when getUserMedia is called. A long lead silence gives the
// test time to open the page, switch to Listen (mic), and Start listening
// while still in silence, so the first Morse pass arrives cleanly.
const LEAD_MS = 10000;
const TRAIL_MS = 3000;

// 1. SOS — steady 20 WPM
{
  const morse = encode('SOS').output;
  const timeline = withPad(buildTimeline(morse, { wpm: 20 }), LEAD_MS, TRAIL_MS);
  writeFixture('sos.wav', timeline, `expected text SOS, morse=${morse}`);
}

// 2. PARIS — steady 20 WPM (calibration word)
{
  const morse = encode('PARIS').output;
  const timeline = withPad(buildTimeline(morse, { wpm: 20 }), LEAD_MS, TRAIL_MS);
  writeFixture('paris.wav', timeline, `expected text PARIS, morse=${morse}`);
}

// 3. HELLO with uneven timing (±18% per segment) — adaptive/jitter tolerance
{
  const morse = encode('HELLO').output;
  const base = buildTimeline(morse, { wpm: 18 });
  let seed = 17;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const uneven = base.map((seg) => ({
    on: seg.on,
    ms: Math.max(20, Math.round(seg.ms * (1 + (rand() - 0.5) * 0.36))),
  }));
  const timeline = withPad(uneven, LEAD_MS, TRAIL_MS);
  writeFixture('hello-uneven.wav', timeline, `expected text HELLO, morse=${morse}, jittered ±18%`);
}

console.log(`fixtures in ${outDir}`);
