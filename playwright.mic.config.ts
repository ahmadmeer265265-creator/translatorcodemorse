/**
 * Notes for the fake-mic Morse e2e (scoped; not a full Playwright Test suite).
 *
 * Run:  npm run test:mic-e2e
 *
 * That script:
 *   1. Generates WAV fixtures via scripts/generate-mic-e2e-fixtures.mjs
 *      (site encodeWav / buildTimeline → stereo PCM16 under tests/e2e/fixtures
 *       and D:\mic-e2e-fixtures for Chromium flags — paths with spaces break
 *       --use-file-for-fake-audio-capture).
 *   2. Builds the site (npm run build → verify-dist).
 *   3. Serves dist/ and drives Chromium with playwright's chromium.launch args:
 *        --use-fake-device-for-media-stream
 *        --use-fake-ui-for-media-stream
 *        --use-file-for-fake-audio-capture=<wav>
 *      See tests/e2e/mic-decoder.spec.mjs + scripts/run-mic-e2e.mjs.
 *
 * Uses the existing `playwright` package (browser API) rather than
 * @playwright/test to avoid an extra lockfile dependency.
 */
export {};
