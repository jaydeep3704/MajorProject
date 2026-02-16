"use client"

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { getYouTubeVideoId } from '@/lib/youtube-utils';
import type { Course } from '@/types/course';

interface CreateCourseModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCourseCreated: (course: Course) => void;
}

export function CreateCourseModal({ isOpen, onOpenChange, onCourseCreated }: CreateCourseModalProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [courseName, setCourseName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    
    const videoId = getYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      setError('Invalid YouTube URL');
      return;
    }

    if (!courseName.trim()) {
      setError('Course name is required');
      return;
    } 
    
    setIsLoading(true);

    const response = await fetch('/api/courses/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoID: videoId,
        CourseName: courseName,
      }),
    });
    
    if (!response.ok) {
      setError('Failed to create course');
      setIsLoading(false);
      return;
    }


    setIsLoading(false);
   
   
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Course</DialogTitle>
          <DialogDescription>
            Create a new course from a YouTube video. We'll automatically segment it into chapters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="youtube-url">YouTube URL</Label>
            <Input
              id="youtube-url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-name">Course Name</Label>
            <Input
              id="course-name"
              placeholder="Enter course name"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading || !youtubeUrl || !courseName}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Course'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}