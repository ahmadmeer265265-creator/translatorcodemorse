/**
 * Bytes of the checked-in sample PNGs. Built into this module so Try sample
 * does not fetch them. The matching files live in src/assets/image-translator/.
 */
export const SAMPLE_SOS_PNG = "iVBORw0KGgoAAAANSUhEUgAAAHgAAAASCAIAAAAfaY25AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAY0lEQVRYhe3VMQrAIBAFUQ/wCwvvf1XtJM1CQJwUmYdVEAyDrG0K0ZhjZGiIoSGGhhj6u9CjZ6+T75Xx2F8tcv+b/zzvYOiSoeONdnTE0RFndH76GOoGQ0MMDTE0xNAQQ0/GAoWYR6Sq+KxuAAAAAElFTkSuQmCC";
export const SAMPLE_HELLO_PNG = "iVBORw0KGgoAAAANSUhEUgAAANAAAAASCAIAAACl5secAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAjElEQVRoge3UMQrDMBBFQR8ghYu9/1XtwiGkMShg/axgBldC4IV9aDsgaEv+DARHlOCIEhxRguPfwdX++nwzzu88df/7/O5Lzt9hnvrxvzPuXwQnuDfBLfyidJunvHDjC1txwd3mKcGNL2zFBXebpwQ3vrAVF9xtnuocHMwjOKIER5TgiBIcUYLjSDoB/MzijXOpVRoAAAAASUVORK5CYII=";

function fileFromPngBase64(filename: string, base64: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: 'image/png' });
}

export type SampleName = 'sos' | 'hello';

export function sampleFile(name: SampleName): File {
  if (name === 'hello') return fileFromPngBase64('sample-hello.png', SAMPLE_HELLO_PNG);
  return fileFromPngBase64('sample-sos.png', SAMPLE_SOS_PNG);
}
