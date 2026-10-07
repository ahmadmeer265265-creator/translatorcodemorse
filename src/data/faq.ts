export const homeFaqs = [
  {
    question: 'What is Morse code?',
    answer:
      'Morse code is a way to write letters, numbers, and punctuation as dots and dashes. A dash lasts three times as long as a dot.',
  },
  {
    question: 'How do I convert text to Morse code here?',
    answer:
      'Type or paste into the Text panel. The Morse code panel fills in as you type. Letters in a word are separated by one space, and words are separated by a slash.',
  },
  {
    question: 'How do I convert Morse code back to text?',
    answer:
      'Type dots and dashes into the Morse code panel. Use a space between letters. Use a slash, a vertical bar, or at least three spaces between words.',
  },
  {
    question: 'Which characters can this translator encode?',
    answer:
      'It encodes A to Z, digits 0 to 9, and . , ? \' ! / ( ) & : ; = + - _ " $ @. Lowercase letters are treated as uppercase.',
  },
  {
    question: 'What happens to a character it does not know?',
    answer:
      'That character is left out of the Morse code, and the status line lists what was skipped. An unknown dot-and-dash pattern becomes a question mark.',
  },
  {
    question: 'How is SOS written in Morse code?',
    answer: 'SOS is ... --- ... with a single space between the letters and no slash, because it is one word.',
    answerHtml:
      '<a class="text-accent underline underline-offset-4" href="/sos-in-morse-code/">SOS</a> is ... --- ... with a single space between the letters and no slash, because it is one word.',
  },
  {
    question: 'Does a share link put my text in the search index?',
    answer:
      'No. Copy share link puts the text in the page hash, after #text=. Browsers do not send the hash to the server, and this site does not turn it into a separate page.',
  },
  {
    question: 'Is this Morse code translator free?',
    answer:
      'Yes. It runs in your browser, it does not ask you to sign in, and the text you type is not uploaded.',
  },
  {
    question: 'How do I play Morse code as sound?',
    answer:
      'Type or paste a message so the Morse code panel has dots and dashes, then press Play. Stop ends the sound immediately. The status line says Playing, Stopped, or Finished.',
  },
  {
    question: 'What does WPM mean in Morse code?',
    answer:
      'WPM means words per minute. Speed is defined by the word PARIS, which takes 50 units including the word space after it. At 20 WPM one unit is 60 milliseconds, so PARIS takes three seconds.',
  },
  {
    question: 'What is Farnsworth spacing?',
    answer:
      'Farnsworth spacing keeps dots and dashes at the Speed you chose and lengthens the gaps between letters and between words. Set Farnsworth below Speed to turn it on. When it matches Speed, the control reads Off and the gaps stay standard.',
  },
  {
    question: 'Can I download Morse code as audio?',
    answer:
      'Yes. Download WAV builds a mono 16-bit WAV file from the Morse code panel and saves it as morse-code.wav. The download uses the Speed, Farnsworth, Tone, and Volume settings on the page. A message longer than five minutes is not downloaded; the status line shows how long it would be.',
  },
] as const;
