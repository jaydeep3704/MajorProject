"use client";

import { useEffect, useState } from "react";

export const NotesSkeleton = () => {
  const [widths, setWidths] = useState<number[]>([]);

  useEffect(() => {
    // generate all random widths once
    setWidths(
      Array.from({ length: 50 }, () => Math.floor(40 + Math.random() * 50))
    );
  }, []);

  let w = 0;
  const getWidth = () => `${widths[w++ % widths.length] || 70}%`;

  return (
    <div className="lg:flex-3 max-w-4xl mx-auto p-4 space-y-8 animate-pulse">

      {/* Executive Summary */}
      <div className="space-y-3">
        <div className="h-6 bg-muted rounded w-1/3" />
        <div className="space-y-2 pl-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30 flex-shrink-0" />
              <div className="h-3 bg-muted rounded" style={{ width: getWidth() }} />
            </div>
          ))}
        </div>
      </div>

      {/* Chapters */}
      {[...Array(4)].map((_, chapterIdx) => (
        <div key={chapterIdx} className="space-y-4">
          <div className="h-6 bg-muted rounded w-2/5" />

          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-3 bg-muted rounded" style={{ width: getWidth() }} />
            ))}
          </div>

          <div className="h-4 bg-muted rounded w-1/4 ml-2" />

          <div className="space-y-2 pl-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                <div className="h-3 bg-muted rounded" style={{ width: getWidth() }} />
              </div>
            ))}
          </div>

          {chapterIdx % 2 === 0 && (
            <div className="border-l-4 border-muted-foreground/20 pl-4 space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-3 bg-muted rounded" style={{ width: getWidth() }} />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Key Concepts */}
      <div className="space-y-3">
        <div className="h-6 bg-muted rounded w-1/3" />
        <div className="space-y-2 pl-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30 flex-shrink-0" />
              <div className="h-3 bg-muted rounded" style={{ width: getWidth() }} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};