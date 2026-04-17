// lib/job-store.ts
// In-memory store for course creation job status.
// Swap the Map for Redis/DB in production.

export type JobStage =
  | "queued"
  | "fetching_metadata"
  | "fetching_transcript"
  | "saving_data"
  | "finalizing"
  | "completed"
  | "failed";

export interface JobStatus {
  stage: JobStage;
  message: string;
  progress: number; // 0-100
  courseId?: string;
  error?: string;
}

const jobs = new Map<string, JobStatus>();

export const jobStore = {
  set(jobId: string, status: JobStatus) {
    jobs.set(jobId, status);
  },
  get(jobId: string): JobStatus | undefined {
    return jobs.get(jobId);
  },
  delete(jobId: string) {
    jobs.delete(jobId);
  },
};