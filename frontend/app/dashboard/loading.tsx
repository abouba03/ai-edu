export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="border-2 border-[#1C293C] p-6 lg:p-8">
        <div className="h-4 w-40 bg-muted rounded mb-3" />
        <div className="h-9 w-72 bg-muted rounded mb-2" />
        <div className="h-4 w-96 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-2 border-[#1C293C] p-4 h-24 bg-muted/30 rounded" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border-2 border-[#1C293C] p-5 h-48 bg-muted/20 rounded" />
        <div className="border-2 border-[#1C293C] p-5 h-48 bg-muted/20 rounded" />
      </div>
    </div>
  );
}
