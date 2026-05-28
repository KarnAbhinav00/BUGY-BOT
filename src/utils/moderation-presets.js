function buildPresetList(baseTerms, targetCount, prefix = '') {
  const results = new Set();

  for (let index = 0; results.size < targetCount; index += 1) {
    const base = baseTerms[index % baseTerms.length];
    const cycle = Math.floor(index / baseTerms.length);
    const variants = [
      `${prefix}${base}`,
      `${prefix}${base}${cycle}`,
      `${prefix}${base}${cycle + 1}`,
      `${prefix}${base}_${cycle}`
    ];

    for (const variant of variants) {
      results.add(variant.toLowerCase());

      if (results.size >= targetCount) {
        break;
      }
    }
  }

  return [...results].slice(0, targetCount);
}

const englishBaseTerms = [
  'abuse', 'annoying', 'arrogant', 'awful', 'backstabber', 'bastard', 'belittle', 'bigot', 'bitch', 'blame',
  'boor', 'brat', 'buffoon', 'bullshit', 'cheater', 'clown', 'coward', 'crap', 'cringe', 'damn',
  'dick', 'disgusting', 'dumb', 'dunce', 'evil', 'fool', 'garbage', 'greedy', 'gross', 'hate',
  'idiot', 'ignorant', 'jerk', 'lazy', 'loser', 'mean', 'mess', 'miserable', 'moron', 'nasty',
  'noisy', 'obnoxious', 'offensive', 'pathetic', 'piss', 'poor', 'rough', 'rude', 'scam', 'selfish',
  'shit', 'silly', 'smelly', 'stupid', 'swear', 'trash', 'ugly', 'unfair', 'vile', 'villain',
  'weak', 'weird', 'worse', 'worthless', 'wicked', 'yell', 'suck', 'sucks', 'sucker', 'idiotic',
  'toxic', 'nonsense', 'nutcase', 'freak', 'lunatic', 'clumsy', 'hateful', 'dirty', 'foul', 'crappy'
];

const hinglishBaseTerms = [
  'chutiya', 'madarchod', 'behenchod', 'bhosdike', 'lund', 'gandu', 'harami', 'bkl', 'kamina', 'kutta',
  'bakwaas', 'faltu', 'bakchod', 'bakwas', 'lodu', 'pagal', 'nalayak', 'bewakoof', 'baklol', 'ghatiya',
  'bekar', 'gadha', 'ullu', 'jhatu', 'bakwasi', 'ghuskhori', 'chor', 'tharki', 'kanjoos', 'bakaiti',
  'faltu', 'ghamandi', 'badtameez', 'zeher', 'gandi', 'sasti', 'lootera', 'dhokebaaz', 'farzi', 'jhutha',
  'bevakoof', 'bakheda', 'bakhedi', 'bakwaas', 'bakwas', 'kanjoos', 'bekaar', 'ghatiya', 'ulta', 'ullu',
  'pakau', 'bakchod', 'ghamand', 'bakaiti', 'nalayak', 'bakheda', 'dhakkan', 'sadu', 'mohra', 'nakli'
];

const blockedLinkPresets = [
  'discord.gg', 'discord.com/invite', 't.me/', 'telegram.me/', 'wa.me/', 'chat.whatsapp.com', 'tinyurl.com', 'bit.ly',
  'grabify.link', 'iplogger.org', 'cutt.ly', 'linktr.ee', 'beacons.ai', 'shorturl.at', 'rb.gy', 'is.gd',
  'youtu.be', 'example.com', 'freegift', 'free-nitro', 'freebie', 'phishing'
];

const englishPresets = buildPresetList(englishBaseTerms, 2000);
const hinglishPresets = buildPresetList(hinglishBaseTerms, 2000);

module.exports = {
  blockedLinkPresets,
  englishBaseTerms,
  englishPresets,
  hinglishBaseTerms,
  hinglishPresets
};