/** Visible FAQ copy. The page schema imports this same list. */
export const americanTranslatorFaqs = [
  {
    question: 'Is American Morse the same code used in old war movies or by the navy?',
    answer:
      'No. Films and military history almost always use International Morse, since that is what ships, the military, and radio operators adopted after 1912. American Morse was a landline code, used over wires on the ground, not over radio or at sea.',
  },
  {
    question: 'Do I need a real telegraph key or sounder to use this tool?',
    answer:
      'No. Everything runs in your browser. The sound settings let you hear a telegraph sounder or a CW tone without any hardware.',
  },
  {
    question: 'Why does American Morse have more than one length of dash?',
    answer:
      'It comes from how the code was first built for a mechanical sounder, not a tone. A longer dash was a simple way to add letters and digits that a single dot and a single dash could not tell apart.',
  },
  {
    question: 'How do I type the long dashes for L and 0?',
    answer:
      'Type = for L, the long dash, and _ for 0, the extra-long dash. On the Type tab, the keys labeled “L long dash” and “0 extra-long dash” insert them. You can also paste the chart symbols ⸺ and ⸻. This page reads ⸺ as L and ⸻ as 0, then shows = and _.',
  },
  {
    question: 'Can this tool read American Morse from an audio recording?',
    answer:
      'Yes. Open the Listen tab above this article. Start listening uses the microphone, or you can drop in a WAV, MP3, or OGG file. Decoding stays in your browser and follows American Morse timing. The separate audio translator on this site is built for International Morse, so use this page for railroad Morse.',
  },
  {
    question: 'Why did my message come out as nonsense?',
    answer:
      'The most common cause is mixing up the two codes. Check whether the source was written in International Morse, since reading one code with the other code’s rules rarely gives a sensible result. The section above on converting between the two codes explains how to check.',
  },
] as const;
