export function ChaptersSkeleton() {
  return (
    <div className="lg:flex-1 bg-card rounded-lg p-6 max-h-[30vh] md:max-h-[90vh] shadow-md">
      <div className="h-6 w-36 bg-muted rounded animate-pulse mb-4" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}