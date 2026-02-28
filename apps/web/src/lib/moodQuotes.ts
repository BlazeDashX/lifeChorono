// Mood-matched quotes — static, deterministic, no API cost
// 12 quotes per score level, randomly selected per session

export type MoodScore = 1 | 2 | 3 | 4 | 5;

interface MoodMeta {
  emoji: string;
  label: string;
  subline: string;
  quotes: string[];
}

export const MOOD_DATA: Record<MoodScore, MoodMeta> = {
  1: {
    emoji: '😔',
    label: 'Very low',
    subline: 'Tough days are part of the journey too.',
    quotes: [
      "You don't have to be positive all the time. It's perfectly okay to feel sad, angry, annoyed, or down.",
      'Even the darkest night will end and the sun will rise.',
      'Rock bottom became the solid foundation on which I rebuilt my life.',
      'Sometimes you need to step outside, get some air, and remind yourself of who you are.',
      'Every moment of darkness is just the universe preparing you for a brighter chapter.',
      'You are allowed to be both a masterpiece and a work in progress simultaneously.',
      'Difficult roads often lead to beautiful destinations.',
      'The pain you feel today is the strength you feel tomorrow.',
      'Be gentle with yourself. You are a child of the universe.',
      "It's okay to not be okay — as long as you don't give up.",
      'Storms make trees take deeper roots.',
      'Even the smallest step forward is still a step forward.',
    ],
  },
  2: {
    emoji: '😕',
    label: 'Low',
    subline: 'Low energy is not lost energy.',
    quotes: [
      'You are braver than you believe, stronger than you seem, and smarter than you think.',
      'Start where you are. Use what you have. Do what you can.',
      "Believe you can and you're halfway there.",
      'The comeback is always stronger than the setback.',
      "You don't have to see the whole staircase, just take the first step.",
      'Small progress is still progress.',
      'Every day may not be good, but there is something good in every day.',
      'Strength grows in the moments when you think you cannot go on but you keep going anyway.',
      'One step at a time is all it takes to get you there.',
      'You have survived 100% of your worst days so far.',
      'Persistence is the twin sister of excellence.',
      'Slow progress is better than no progress.',
    ],
  },
  3: {
    emoji: '😐',
    label: 'Okay',
    subline: 'Steady is underrated. Keep going.',
    quotes: [
      'Success is the sum of small efforts repeated day in and day out.',
      'Consistency is the key to achieving and maintaining momentum.',
      'You do not rise to the level of your goals. You fall to the level of your systems.',
      'The secret of getting ahead is getting started.',
      'Excellence is not a destination but a continuous journey.',
      "It's not about perfect. It's about effort.",
      'Discipline is choosing between what you want now and what you want most.',
      'Show up every day. That alone puts you ahead.',
      'The only bad workout is the one that didn\'t happen.',
      'Progress, not perfection.',
      'Ordinary efforts compounded over time produce extraordinary results.',
      'Good things take time. Stay consistent.',
    ],
  },
  4: {
    emoji: '🙂',
    label: 'Good',
    subline: 'Good energy — use it well.',
    quotes: [
      'Momentum is a powerful force. Keep it going.',
      'You are capable of amazing things.',
      'The harder you work for something, the greater you will feel when you achieve it.',
      'Push yourself because no one else is going to do it for you.',
      'Dream big, work hard, stay focused.',
      'Your positive action combined with positive thinking results in success.',
      'Make today so awesome that yesterday gets jealous.',
      'Do something today that your future self will thank you for.',
      'Energy flows where attention goes.',
      'A good day is a collection of good decisions.',
      'You are on the right track. Stay the course.',
      'Great things never come from comfort zones.',
    ],
  },
  5: {
    emoji: '😄',
    label: 'Great',
    subline: "You're in the zone — make the most of it.",
    quotes: [
      'The only limit to our realization of tomorrow is our doubts of today.',
      'Act as if what you do makes a difference. It does.',
      'Success usually comes to those who are too busy to be looking for it.',
      "Don't watch the clock; do what it does. Keep going.",
      'The future belongs to those who believe in the beauty of their dreams.',
      'You have the power to create the life you want.',
      'Today is your day. Own it.',
      'Champions keep playing until they get it right.',
      'The best time for new beginnings is now.',
      'Your energy is contagious — spread it.',
      'Greatness is not a destination. It is a daily decision.',
      'You are unstoppable when you believe in yourself.',
    ],
  },
};

/**
 * Get a date-seeded quote for a given score.
 * Same score on different days shows a different quote.
 * Same score on the same day always shows the same quote.
 */
export function getDailyQuote(score: MoodScore): string {
  const quotes = MOOD_DATA[score].quotes;
  const today = new Date();
  const seed =
    today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 +
    today.getDate();
  return quotes[seed % quotes.length];
}