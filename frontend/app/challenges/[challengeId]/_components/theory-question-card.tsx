'use client';

type TheoryQuestion = {
  question: string;
  choices: string[];
};

type Props = {
  index: number;
  question: TheoryQuestion;
  value: string;
  onChange: (value: string) => void;
};

function normalizeChoice(value: string) {
  return value.trim().toLowerCase();
}

function detectQuestionType(choices: string[]) {
  if (choices.length === 0) return 'open' as const;

  if (choices.length === 2) {
    const normalized = choices.map(normalizeChoice);
    const trueFalsePairs = [
      ['vrai', 'faux'],
      ['true', 'false'],
      ['yes', 'no'],
      ['oui', 'non'],
    ];

    const isTrueFalse = trueFalsePairs.some((pair) => pair.every((item) => normalized.includes(item)));
    if (isTrueFalse) return 'truefalse' as const;
  }

  return 'mcq' as const;
}

export function TheoryQuestionCard({ index, question, value, onChange }: Props) {
  const type = detectQuestionType(question.choices);

  return (
    <article className="rounded-xl border bg-background p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{index + 1}. {question.question}</p>
        <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
          {type === 'truefalse' ? 'Vrai/Faux' : type === 'mcq' ? 'QCM' : 'Réponse libre'}
        </span>
      </div>

      {type === 'truefalse' && (
        <div className="grid grid-cols-2 gap-2">
          {question.choices.map((choice) => {
            const selected = value === choice;
            return (
              <button
                key={choice}
                type="button"
                onClick={() => onChange(choice)}
                className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${selected ? 'border-primary bg-primary/10 text-foreground' : 'bg-card hover:bg-accent'}`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      )}

      {type === 'mcq' && (
        <div className="space-y-1.5 text-sm">
          {question.choices.map((choice) => (
            <label key={choice} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/60">
              <input
                type="radio"
                name={`theory-q-${index}`}
                value={choice}
                checked={value === choice}
                onChange={() => onChange(choice)}
              />
              <span>{choice}</span>
            </label>
          ))}
        </div>
      )}

      {type === 'open' && (
        <input
          className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ta réponse"
        />
      )}
    </article>
  );
}
