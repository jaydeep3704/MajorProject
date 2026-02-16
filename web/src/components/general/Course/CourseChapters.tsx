"use client"
import { Chapter } from '@/types/course';
import React, { useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';

interface CourseChaptersProps {
  courseId: string
  onChapterClick: (time: number) => void
}


export const CourseChapters = ({ courseId,onChapterClick }: CourseChaptersProps) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchChapters = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/courses/${courseId}/chapters`);
        const data = await response.json();
        setChapters(data.chapters);
      } catch (error) {
        console.error('Failed to fetch chapters:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchChapters();
  }, [courseId]);

  if (isLoading) {
    return (
      <div className="lg:flex-1 bg-card rounded-lg p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lg:flex-1 bg-card rounded-lg p-6 max-h-[30vh] md:max-h-[90vh] overflow-y-auto no-scrollbar  shadow-md">
      <h2 className="text-lg font-semibold text-foreground mb-4">Course Content</h2>

      <div className="space-y-2">
        {chapters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No chapters available</p>
          </div>
        ) : (
          chapters.map((chapter, index) => (
            <button
              key={index}
              onClick={() => {
                setActiveIndex(index)
                onChapterClick(Number.parseInt(chapter.start))
              }}
              className={`w-full p-4 rounded-lg transition-all duration-200 text-left group ${activeIndex === index
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted hover:bg-muted/80 text-foreground hover:shadow-sm'
                }`}
            >
              <div className="flex items-start justify-between gap-3 ">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PlayCircle
                      className={`w-4 h-4 flex-shrink-0 transition-transform ${activeIndex === index ? 'group-hover:scale-110' : ''
                        }`}
                    />
                    <p className="font-medium truncate text-sm md:text-base">
                      {chapter.title}
                    </p>
                  </div>
                  <p className={`text-xs md:text-sm opacity-75 ${activeIndex === index ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`}>
                    Chapter {index + 1}
                  </p>
                </div>
                <span className={`flex-shrink-0 text-xs md:text-sm font-mono font-semibold ${activeIndex === index ? 'text-primary-foreground' : 'text-muted-foreground'
                  }`}>
                  {formatToHHMMSS(Number.parseInt(chapter.start))}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

function formatToHHMMSS(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => num.toString().padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
