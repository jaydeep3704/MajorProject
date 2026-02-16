export interface Chapter {
  id: string;
  title: string;
  start: string;   // must match DB
  end: string;
  index: number;
  keywords: string[];
  courseId: string;
  createdAt: string; // ISO string if serialized
}


export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface Course {
  id: string;
  title: string;
  youtubeUrl: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  chapters: Chapter[];
}



export interface Metadata{
  title:string,
  description:string,
  duration:number,
  thumbnail:string
}
