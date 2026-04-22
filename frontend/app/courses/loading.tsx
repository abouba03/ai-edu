export default function CoursesLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-xl border bg-card p-4 lg:p-5 space-y-2.5">
        <div className="h-3 w-32 bg-muted rounded" />
        <div className="h-6 w-48 bg-muted rounded" />
        <div className="h-3 w-80 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 space-y-2.5">
            <div className="h-4 w-40 bg-muted rounded" />
            <div className="grid grid-cols-3 gap-1.5">
              <div className="h-10 bg-muted rounded-md" />
              <div className="h-10 bg-muted rounded-md" />
              <div className="h-10 bg-muted rounded-md" />
            </div>
            <div className="h-1.5 bg-muted rounded-full" />
            <div className="h-7 bg-muted rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
