/** Visible FAQ copy. The page schema imports this same list. */
export const machineFaqs = [
  {
    question: 'What is a Morse code machine called?',
    answer:
      'Depends on exactly what you mean. A physical sending device is usually called a telegraph key, bug, or paddle depending on the type, while an online tool like this one is informally just called a "Morse code machine" or a Morse simulator.',
  },
  {
    question: 'Who invented the Morse code machine?',
    answer:
      'Samuel Morse and his collaborator Alfred Vail developed the original code and telegraph system in the 1830s and 1840s. The semi-automatic "bug" key most people picture today came later, patented by Horace Martin and first sold by the Vibroplex Company in 1905.',
  },
  {
    question: "Whatever happened to the Boy Scouts' Morse Code Machine?",
    answer:
      'It was a Flash game on the Boys\' Life website, now Scoutlife.org. It disappeared around the middle of the 2010s, and nobody has confirmed exactly why, though Flash being phased out on phones and tablets is the likely reason. It was never replaced, which is the gap this page\'s tool is built to fill.',
  },
  {
    question: "What's the difference between a machine, a keyer, and a key?",
    answer:
      'A key is the physical switch you press, from a simple straight key to a paddle. A keyer is the electronics behind a paddle that times the dots and dashes automatically, and "machine" is the loosest term of the three, usually used informally for any of the above or for an online simulator like this one.',
  },
  {
    question: 'Which Morse code does this machine use?',
    answer:
      'It uses International Morse code, the standard used worldwide. If you want the older railroad version, try the American Morse code translator.',
  },
  {
    question: 'Do I need a license to use a Morse code machine?',
    answer:
      'No. A license is only needed if you transmit Morse over amateur radio frequencies. Practicing, learning, or using an online tool like this one needs no license at all.',
  },
  {
    question: 'Can I build my own Morse code practice key?',
    answer:
      'Yes, a basic version can be built in minutes from a clothespin, a couple of thumbtacks, a battery, and a buzzer. The DIY section above walks through exactly how.',
  },
  {
    question: 'Can you still buy a physical Morse key?',
    answer:
      "Yes, companies like Vibroplex still manufacture and sell straight keys, bugs, and paddles today, and vintage keys are also widely available from collectors. None are required though, since this page's tool works without buying anything.",
  },
  {
    question: 'Can I practice without buying a machine?',
    answer:
      "Yes, that's exactly what the free tool on this page is for. It covers tapping out Morse, listening practice, and checking your own sending accuracy without any hardware at all.",
  },
] as const;
