/**
 * Inverse of morse-audio.ts's encodeWav container: parse the PCM16
 * little-endian WAV bytes it produces back into float32 channel data.
 * Shared by the MP3 encoder (WAV render -> MP3) and the synthetic-audio
 * test builder.
 */
export function pcmFromWavBytes(wav: Uint8Array): { channels: Float32Array[]; sampleRate: number } {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  if (wav.length < 44) return { channels: [new Float32Array(0)], sampleRate: 44100 };
  const channelsCount = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const frames = (wav.length - 44) / 2 / channelsCount;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < channelsCount; ch += 1) channels.push(new Float32Array(frames));
  for (let frame = 0; frame < frames; frame += 1) {
    for (let ch = 0; ch < channelsCount; ch += 1) {
      channels[ch]![frame] = view.getInt16(44 + (frame * channelsCount + ch) * 2, true) / 32768;
    }
  }
  return { channels, sampleRate };
}
