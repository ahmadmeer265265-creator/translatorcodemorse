/**
 * Round 2 golden converter outputs. Must stay byte-identical after every phase.
 */
import { encode } from '../src/lib/morse.ts';

const cases = [
  ['HELLO WORLD', 'HELLO WORLD'],
  ['SOS', 'SOS'],
  ['0123456789', '0123456789'],
  ['punctuation', '.,?/@'],
  ['unknown', 'SOS\u{1F600}'],
];

for (const [label, input] of cases) {
  const result = encode(input);
  console.log(`${label}\t${JSON.stringify(result.output)}\tunsupported=${JSON.stringify(result.unsupported)}`);
}
