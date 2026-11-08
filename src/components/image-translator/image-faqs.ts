/** Visible FAQ copy. The page schema imports this same list. */
export const imageTranslatorFaqs = [
  {
    question:
      'My image has dots and dashes, but when I check it against a Morse chart, nothing makes sense. Why?',
    answer:
      'It is almost always a timing problem, not a reading problem. In real Morse, a dash is always three times as long as a dot, and the gaps between letters and words follow their own fixed ratios. Puzzle makers and hand-drawn images do not always stick to this. If the proportions in your image are inconsistent, even a careful manual count will produce garbage. Let the decoder measure the widths for you, then check the result in the editable field rather than counting by eye.',
  },
  {
    question: 'How do I tell a dot from a dash when they look almost the same length?',
    answer:
      'By eye, this is genuinely hard, especially in a blurry or low-resolution photo. The decoder does not guess from a fixed ruler. It compares every mark in the image to the others and classifies the short ones as dots and the long ones as dashes, relative to each other. That is also why a tightly cropped, high-contrast image works better than a wide photo with lots of empty space around the code.',
  },
  {
    question: 'Is this actually Morse code, or could it be something else?',
    answer:
      'Not every dot-and-dash pattern in a puzzle is the real Morse. Semaphore, Braille, and invented ciphers can look similar at a glance. If this tool returns nothing readable, or only a string of single letters with no real words, that is a sign the source may not follow International Morse rules at all. Compare a few characters against the chart above as a quick sanity check.',
  },
  {
    question: 'I see a forward slash ( / ) in my Morse. Is that a real part of the code?',
    answer:
      'No. A slash is a printed convention to show a word gap, since a still image cannot show a pause in time. In an actual transmitted signal, there is no symbol at all, just a longer silence - and that longer silence is what this tool looks for. If your image shows the word gap as plain empty space, the tool finds it on its own. If your image shows an actual slash character drawn between the words, the tool reads it as a stray mark rather than a separator, so it is best to crop it out or widen the gap in its place before uploading.',
  },
  {
    question: 'Why does my result have extra or missing letters?',
    answer:
      'This almost always comes down to one gap being measured as slightly too wide or too narrow. A gap that should separate two letters can get read as a letter-internal gap, or the other way around. Open the editable Morse field, compare it to the image, and adjust the spacing around the character that looks wrong. You do not need to re-upload anything.',
  },
  {
    question: 'Can I upload a photo I took with my phone, or does it need to be a clean screenshot?',
    answer:
      'Both work, but not equally well. A screenshot or a saved image usually decodes better, because there is no camera angle, blur, or lighting to correct for. A phone photo can still work well if it is sharp, evenly lit, and shot straight on rather than at an angle.',
  },
  {
    question: 'Is my image uploaded anywhere, or does it stay on my device?',
    answer:
      'Everything runs in your browser. Your image is never sent to a server, so nothing about it leaves your device at any point.',
  },
  {
    question: 'Does this work for handwritten Morse, like dots and dashes drawn by hand?',
    answer:
      'It can, but results vary more than with printed or digital marks. A hand-drawn gap is rarely as consistent as a computer-generated one, and that inconsistency is exactly what the tool uses to tell a letter apart from another. Clear, evenly spaced handwriting works better than quick or cramped writing.',
  },
  {
    question: 'What if only part of my image decodes and the rest is blank?',
    answer:
      'This usually means one section of the image has worse lighting or contrast than the rest, not that the tool stopped partway through. Crop the image down to just the row of Morse code, and check that nothing is cut off at the edges of the photo.',
  },
  {
    question: 'Can this tool decode something that is not real Morse code, like a made-up puzzle cipher?',
    answer:
      'No, and it should not try to. It is built to recognize the timing and spacing rules of International Morse code specifically. A cipher that reuses the look of dots and dashes but follows its own invented rules needs to be solved by hand, or decoded against whatever system the puzzle itself defines.',
  },
] as const;
