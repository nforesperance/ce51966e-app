export const READING_WORDS_PER_MINUTE = 150;

export const TASK_DEFAULTS = {
  maxPoints: 100,
  prayer: {
    title: "Midnight prayer",
    durationMinutes: 45,
    targetStartTime: "00:00",
    fullMarksWindowMinutes: 5,
    zeroMarksWindowMinutes: 120,
    fullMarksEndWindowMinutes: 5,
    zeroMarksEndWindowMinutes: 120,
  },
  reading: {
    title: "Bible reading",
  },
} as const;
