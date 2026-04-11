import { ChallengeRow } from './types';

type Props = {
  loading: boolean;
  items: ChallengeRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function ChallengeSidebarList({ loading, items, selectedId, onSelect }: Props) {
  return (
    <aside className="rounded-xl border bg-background p-2.5 space-y-2 max-h-[620px] overflow-auto">
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun exercice pour le moment.</p>
      ) : (
        items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`w-full text-left rounded-lg border p-2 space-y-1 ${selectedId === item.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-xs line-clamp-1">{item.title}</p>
              <span className="text-[10px] rounded-full border px-1.5 py-0.5">{item.isPublished ? 'Publié' : 'Brouillon'}</span>
            </div>
            <p className="text-[11px] opacity-80">{item.kind === 'code' ? 'Code' : 'Théorie'} • {item.difficulty} • {item.estimatedMinutes} min</p>
          </button>
        ))
      )}
    </aside>
  );
}