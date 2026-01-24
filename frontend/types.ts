
export interface User {
  id: string;
  name: string;
  email: string;
  token?: string;
}

export enum GenerationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum GenerationType {
  TEXT_TO_VIDEO = 'text-to-video',
  IMAGE_TO_VIDEO = 'image-to-video'
}

export interface VideoTask {
  id: string;
  userId: string;
  type: GenerationType;
  prompt: string;
  model: string;
  ratio: string;
  status: GenerationStatus;
  resultUrl?: string; // URL to the generated video
  thumbnailUrl?: string; // URL for preview
  createdAt: number;
  trimStart?: number;
  trimEnd?: number;
}

export interface Project {
    id: string;
    userId: string;
    name: string;
    clipsJson: string; // JSON array of task IDs
    createdAt: number;
    updatedAt: number;
    clips?: VideoTask[]; // Populated on frontend when fetching
}

export interface N8NPayloadBody {
  data: string; // 'text-to-video' | 'image-to-video'
  model: string;
  ratio: string;
  quantity: number;
  prompt: string;
  foto?: string; // Base64 or URL
  jobId: string;
  callbackUrl: string;
}

export interface N8NPayload {
  body: N8NPayloadBody;
}
