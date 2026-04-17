"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getYouTubeVideoId } from "@/lib/youtube-utils";
import type { Course } from "@/types/course";

// ─── Types ──────────────────────────────────────────────────────────────────

type JobStage =
  | "queued"
  | "fetching_metadata"
  | "fetching_transcript"
  | "saving_data"
  | "finalizing"
  | "completed"
  | "failed";

interface JobStatus {
  stage: JobStage;
  message: string;
  progress: number;
  courseId?: string;
  error?: string;
}

// All possible stages in order — used to render the step list
const STAGES: { key: JobStage; label: string }[] = [
  { key: "queued",              label: "Starting up"           },
  { key: "fetching_metadata",   label: "Fetching video info"   },
  { key: "fetching_transcript", label: "Generating transcript" },
  { key: "saving_data",         label: "Saving course data"    },
  { key: "finalizing",          label: "Finalizing"            },
  { key: "completed",           label: "Done!"                 },
];

const STAGE_ORDER = STAGES.map((s) => s.key);

function stageIndex(stage: JobStage) {
  return STAGE_ORDER.indexOf(stage);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StageIndicator({ status }: { status: JobStatus }) {
  const currentIdx = stageIndex(status.stage);
  const isFailed = status.stage === "failed";

  return (
    <div className="space-y-3 py-2">
      {/* Progress bar */}
      <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-in-out"
          style={{
            width: `${status.progress}%`,
            background: isFailed
              ? "hsl(var(--destructive))"
              : "hsl(var(--primary))",
          }}
        />
      </div>

      {/* Step list */}
      <ul className="space-y-1.5 pt-1">
        {STAGES.filter((s) => s.key !== "failed").map((s, i) => {
          const idx = STAGE_ORDER.indexOf(s.key);
          const isPast    = !isFailed && idx < currentIdx;
          const isCurrent = !isFailed && idx === currentIdx;
          const isFuture  = idx > currentIdx;

          return (
            <li
              key={s.key}
              className={`flex items-center gap-2.5 text-sm transition-all duration-300 ${
                isCurrent
                  ? "text-foreground font-medium"
                  : isPast
                  ? "text-muted-foreground"
                  : "text-muted-foreground/40"
              }`}
            >
              {/* Icon */}
              <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                {isPast ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : isCurrent && !isFailed ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isFuture ? "bg-muted-foreground/30" : "bg-muted-foreground"
                    }`}
                  />
                )}
              </span>
              {s.label}
            </li>
          );
        })}

        {/* Failed row */}
        {isFailed && (
          <li className="flex items-center gap-2.5 text-sm text-destructive font-medium">
            <XCircle className="w-4 h-4 shrink-0" />
            {status.error ?? "Something went wrong"}
          </li>
        )}
      </ul>
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

interface CreateCourseModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCourseCreated: (course: Course) => void;
}

export function CreateCourseModal({
  isOpen,
  onOpenChange,
  onCourseCreated,
}: CreateCourseModalProps) {
  const router = useRouter();

  // Form state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [courseName, setCourseName]  = useState("");
  const [formError, setFormError]    = useState("");

  // Job state
  const [jobId, setJobId]       = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/courses/create/status?jobId=${jobId}`);
        if (!res.ok) return;
        const status: JobStatus = await res.json();
        setJobStatus(status);

        if (status.stage === "completed") {
          clearInterval(pollRef.current!);
          // Give user a beat to see "Done!" before closing
          setTimeout(() => {
            onCourseCreated({ id: status.courseId } as Course);
            router.refresh();
            handleReset();
            onOpenChange(false);
          }, 1400);
        }

        if (status.stage === "failed") {
          clearInterval(pollRef.current!);
        }
      } catch {
        // network blip — keep polling
      }
    };

    poll(); // immediate first tick
    pollRef.current = setInterval(poll, 1500);

    return () => clearInterval(pollRef.current!);
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setFormError("");

    const videoId = getYouTubeVideoId(youtubeUrl);
    if (!videoId) { setFormError("Invalid YouTube URL"); return; }
    if (!courseName.trim()) { setFormError("Course name is required"); return; }

    const res = await fetch("/api/courses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoID: videoId, CourseName: courseName }),
    });

    if (!res.ok) { setFormError("Failed to start course creation"); return; }

    const { jobId: id } = await res.json();
    // Optimistically seed UI before first poll arrives
    setJobStatus({ stage: "queued", message: "Starting…", progress: 5 });
    setJobId(id);
  };

  const handleReset = () => {
    setJobId(null);
    setJobStatus(null);
    setYoutubeUrl("");
    setCourseName("");
    setFormError("");
    clearInterval(pollRef.current!);
  };

  const handleClose = (open: boolean) => {
    // Don't close mid-flight unless user explicitly dismisses
    if (!open && jobId && jobStatus?.stage !== "completed" && jobStatus?.stage !== "failed") {
      // allow close anyway — just stop polling
      handleReset();
    }
    if (!open) handleReset();
    onOpenChange(open);
  };

  const isProcessing = !!jobId && jobStatus?.stage !== "completed" && jobStatus?.stage !== "failed";
  const isFailed     = jobStatus?.stage === "failed";
  const isCompleted  = jobStatus?.stage === "completed";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isProcessing ? "Creating your course…" : isCompleted ? "Course created! 🎉" : "Create New Course"}
          </DialogTitle>
          <DialogDescription>
            {isProcessing || isCompleted
              ? jobStatus?.message
              : "Create a new course from a YouTube video. We'll automatically segment it into chapters."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Either the form OR the live status view ── */}
        {jobStatus ? (
          <div className="py-2 space-y-4">
            <StageIndicator status={jobStatus} />

            {isFailed && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleReset}>
                  Try Again
                </Button>
                <Button variant="ghost" onClick={() => handleClose(false)}>
                  Close
                </Button>
              </div>
            )}
          </div>
        ) : (
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

            {formError && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!youtubeUrl || !courseName}
              >
                Create Course
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}