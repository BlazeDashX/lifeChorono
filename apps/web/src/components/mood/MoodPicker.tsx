'use client';

// Score scale: 1–5 (matches API @Min(1) @Max(5))
// Controlled component — parent owns state and submission.
// No API calls. No side effects. No internal state.

export type MoodScore = 1 | 2 | 3 | 4 | 5;

const MOOD_OPTIONS: {
  value: MoodScore;
  emoji: string;
  label: string;
}[] = [
  { value: 1, emoji: '😔', label: 'Very low' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

interface MoodPickerProps {
  value: MoodScore | null;
  onChange: (score: MoodScore) => void;
  disabled?: boolean;
}

export function MoodPicker({
  value,
  onChange,
  disabled = false,
}: MoodPickerProps) {
  return (
    <div role="group" aria-label="How are you feeling?">
      <div className="flex justify-between gap-1 sm:gap-2">
        {MOOD_OPTIONS.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={option.label}
              onClick={() => onChange(option.value)}
              className={[
                'flex flex-1 flex-col items-center gap-1 rounded-xl border py-2 px-1',
                'transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelected
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border bg-transparent hover:border-primary/40 hover:bg-muted/50',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                aria-hidden="true"
                className={[
                  'text-2xl transition-transform duration-150',
                  isSelected && !disabled ? 'scale-110' : 'scale-100',
                ].join(' ')}
              >
                {option.emoji}
              </span>
              <span
                className={[
                  'text-[10px] font-medium leading-none',
                  isSelected ? 'text-primary' : 'text-muted-foreground',
                ].join(' ')}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
