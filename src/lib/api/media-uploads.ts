import { api } from "@/lib/api";
import type { MediaVisibility } from "@/lib/api/media";

/**
 * The upload routes (Drive D2): /v1/media/uploads. The api only ever sees small JSON; the bytes go from the browser straight to R2
 * through the presigned part URLs these calls return (lib/drive/upload-engine.ts).
 */

export interface PartUrl {
  partNumber: number;
  url: string;
}

export interface InitiateRequest {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** SHA-256 hex of the whole file. */
  contentHash: string;
  visibility?: MediaVisibility;
  width?: number;
  height?: number;
}

export type InitiateResponse =
  | { deduped: true; mediaId: string; name: string; publicUrl?: string; visibility: MediaVisibility; sizeBytes: number }
  | { deduped: false; uploadId: string; visibility: MediaVisibility; kind: string; partSize: number; partCount: number; parts: PartUrl[]; expiresAt: string };

export interface ResumeResponse {
  uploadId: string;
  partSize: number;
  partCount: number;
  /** The parts R2 already holds, with the size of each. */
  uploaded: Array<{ partNumber: number; size: number }>;
  /** Fresh URLs for the parts still to send. */
  parts: PartUrl[];
  expiresAt: string;
}

export interface CompleteResponse {
  mediaId: string;
  name: string;
  publicUrl?: string;
  visibility: MediaVisibility;
  sizeBytes: number;
  deduped: boolean;
}

export const initiateUpload = (body: InitiateRequest) => api.post<InitiateResponse>(`/v1/media/uploads`, body);
export const resumeUpload = (uploadId: string) => api.get<ResumeResponse>(`/v1/media/uploads/${uploadId}`);
export const completeUpload = (uploadId: string) => api.post<CompleteResponse>(`/v1/media/uploads/${uploadId}/complete`, {});
export const abortUpload = (uploadId: string) => api.delete<{ aborted: boolean }>(`/v1/media/uploads/${uploadId}`);
