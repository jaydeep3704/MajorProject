export function SidePanelSkeleton() {
  return (
    <div className="flex-1 bg-card rounded-lg p-6 shadow-md">
      <div className="h-6 w-24 bg-muted rounded animate-pulse mb-6" />
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-full" />
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-10 bg-muted rounded-lg animate-pulse w-full mt-2" />
          </div>
        ))}
      </div>
    </div>
  )
}

