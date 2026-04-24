export interface EmojiMenuItem {
  url: string
  value: number
  title: string
}

export const createEmojiList = (t: (key: string) => string): EmojiMenuItem[] => [
  {
    url: '/msgAction/like.png',
    value: 1,
    title: t('home.chat_reaction.like')
  },
  {
    url: '/msgAction/slightly-frowning-face.png',
    value: 2,
    title: t('home.chat_reaction.unsatisfied')
  },
  {
    url: '/msgAction/heart-on-fire.png',
    value: 3,
    title: t('home.chat_reaction.heart')
  },
  {
    url: '/msgAction/enraged-face.png',
    value: 4,
    title: t('home.chat_reaction.angry')
  },
  {
    url: '/emoji/party-popper.webp',
    value: 5,
    title: t('home.chat_reaction.party')
  },
  {
    url: '/emoji/rocket.webp',
    value: 6,
    title: t('home.chat_reaction.rocket')
  },
  {
    url: '/msgAction/face-with-tears-of-joy.png',
    value: 7,
    title: t('home.chat_reaction.lol')
  },
  {
    url: '/msgAction/clapping.png',
    value: 8,
    title: t('home.chat_reaction.clap')
  },
  {
    url: '/msgAction/rose.png',
    value: 9,
    title: t('home.chat_reaction.flower')
  },
  {
    url: '/msgAction/bomb.png',
    value: 10,
    title: t('home.chat_reaction.bomb')
  },
  {
    url: '/msgAction/exploding-head.png',
    value: 11,
    title: t('home.chat_reaction.question')
  },
  {
    url: '/msgAction/victory-hand.png',
    value: 12,
    title: t('home.chat_reaction.victory')
  },
  {
    url: '/msgAction/flashlight.png',
    value: 13,
    title: t('home.chat_reaction.light')
  },
  {
    url: '/msgAction/pocket-money.png',
    value: 14,
    title: t('home.chat_reaction.red_envelope')
  }
]
