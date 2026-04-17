"use client"

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { getYouTubeVideoId } from '@/lib/youtube-utils';
import type { Course } from '@/types/course';

interface CourseCardProps {
  course: Course;
  onClick: () => void;
}

export function CourseCard({ course, onClick }: CourseCardProps) {
  const videoId = getYouTubeVideoId(course.youtubeUrl);
  const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  const handleClick = () => {
    // Navigate to course detail page
    window.location.href = `/courses/${course.id}`;
  };

  return (
    <Card
      className="cursor-pointer group overflow-hidden transition-all duration-300 hover:shadow-lg dark:border-card dark:bg-card/80"
      onClick={handleClick}
    >
      <CardHeader className="p-0">
        <div className="relative aspect-video overflow-hidden bg-muted w-full">
          <img
            src={thumbnail}
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
          
          {/* Gradient overlay for better text visibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Status indicator overlays */}
          {course.status === 'PROCESSING' && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
          
          {course.status === 'COMPLETED' && course.chapters && (
            <div className="absolute bottom-3 right-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
              {course.chapters.length} chapters
            </div>
          )}

          {course.status === 'FAILED' && (
            <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center backdrop-blur-sm">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 py-2 space-y-2">
        <h3 className="font-bold text-sm line-clamp-2 text-foreground dark:text-card-foreground group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        
        {/* Status indicator text */}
        <div className="flex items-center gap-2">
          {course.status === 'PROCESSING' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-500 dark:text-blue-400" />
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Processing...</span>
            </>
          )}
          {course.status === 'COMPLETED' && (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">Ready</span>
            </>
          )}
          {course.status === 'FAILED' && (
            <>
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">Failed</span>
            </>
          )}
          {course.status === 'PENDING' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Pending...</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
