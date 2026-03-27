export const NotesSkeleton = () => {
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 animate-pulse">
      
      {/* Executive Summary */}
      <div className="space-y-3">
        <div className="h-6 bg-muted rounded w-1/3" />
        <div className="space-y-2 pl-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30 flex-shrink-0" />
              <div className="h-3 bg-muted rounded" style={{ width: `${60 + Math.random() * 35}%` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Chapters */}
      {[...Array(4)].map((_, chapterIdx) => (
        <div key={chapterIdx} className="space-y-4">
          {/* h2 chapter title */}
          <div className="h-6 bg-muted rounded w-2/5" />

          {/* Paragraph lines */}
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-3 bg-muted rounded" style={{ width: `${70 + Math.random() * 28}%` }} />
            ))}
          </div>

          {/* h3 subtopic */}
          <div className="h-4 bg-muted rounded w-1/4 ml-2" />

          {/* Bullet list */}
          <div className="space-y-2 pl-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                <div className="h-3 bg-muted rounded" style={{ width: `${50 + Math.random() * 40}%` }} />
              </div>
            ))}
          </div>

          {/* Blockquote */}
          {chapterIdx % 2 === 0 && (
            <div className="border-l-4 border-muted-foreground/20 pl-4 space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-3 bg-muted rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Key Concepts Recap */}
      <div className="space-y-3">
        <div className="h-6 bg-muted rounded w-1/3" />
        <div className="space-y-2 pl-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30 flex-shrink-0" />
              <div className="h-3 bg-muted rounded" style={{ width: `${40 + Math.random() * 45}%` }} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};