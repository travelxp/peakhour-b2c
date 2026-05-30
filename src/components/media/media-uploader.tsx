"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { uploadMedia, type MediaUploadResult } from "@/lib/api/media";

/**
 * <MediaUploader> — reusable image upload affordance (Media Manager / R2).
 * Wraps the shadcnblocks-PRO file-upload dropzone (diceui FileUpload
 * primitive) + the R2 upload endpoint, so any surface can offer uploads:
 * the Media Manager grid, the per-placeholder picker (PR8), composers, etc.
 *
 * Decoupled from data fetching: it reports each stored asset via
 * `onUploaded` and lets the host decide what to do (invalidate a query,
 * set a placeholder's resolvedImageUrl + mediaId, append to a picker, …).
 * SVG is excluded by default to match the api upload allowlist (stored-XSS
 * decision); the server re-validates type + size + quota regardless.
 */

export interface MediaUploadedResult extends MediaUploadResult {
  /** The originating File (name/type), for host-side labelling. */
  file: File;
}

export interface MediaUploaderProps {
  /** Fired once per successfully-stored file (includes content-hash dedupes). */
  onUploaded?: (result: MediaUploadedResult) => void;
  accept?: string;
  maxSizeBytes?: number;
  multiple?: boolean;
  /** "compact" shrinks the dropzone for use inside a modal/picker. */
  variant?: "full" | "compact";
  disabled?: boolean;
  className?: string;
}

const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

export function MediaUploader({
  onUploaded,
  accept = DEFAULT_ACCEPT,
  maxSizeBytes = DEFAULT_MAX_BYTES,
  multiple = true,
  variant = "full",
  disabled = false,
  className,
}: MediaUploaderProps) {
  // Controlled transient list so the dropzone renders per-file preview +
  // progress while uploading; cleared once the batch settles (the host's
  // own view becomes the source of truth after onUploaded fires).
  const [files, setFiles] = useState<File[]>([]);

  const onUpload = useCallback(
    async (
      batch: File[],
      {
        onSuccess,
        onError,
      }: {
        onProgress: (file: File, progress: number) => void;
        onSuccess: (file: File) => void;
        onError: (file: File, error: Error) => void;
      },
    ) => {
      await Promise.all(
        batch.map(async (file) => {
          try {
            const res = await uploadMedia(file);
            onSuccess(file);
            onUploaded?.({ ...res, file });
            toast.success(res.deduped ? `${file.name} already in your library` : `${file.name} uploaded`);
          } catch (err) {
            const msg =
              err instanceof ApiError && err.code === "STORAGE_QUOTA_EXCEEDED"
                ? "Storage limit reached — clean up or upgrade to upload more."
                : err instanceof ApiError
                  ? err.message
                  : "Upload failed";
            onError(file, err instanceof Error ? err : new Error(msg));
            toast.error(`${file.name}: ${msg}`);
          }
        }),
      );
      // Reset the transient list; the host view now reflects the uploads.
      setFiles([]);
    },
    [onUploaded],
  );

  const compact = variant === "compact";

  return (
    <FileUpload
      value={files}
      onValueChange={setFiles}
      accept={accept}
      maxSize={maxSizeBytes}
      multiple={multiple}
      disabled={disabled}
      onUpload={onUpload}
      onFileReject={(file, message) => toast.error(`${file.name}: ${message}`)}
      className={className}
    >
      <FileUploadDropzone
        className={cn(
          "border-primary/20 bg-primary/5 hover:bg-primary/10 data-dragging:bg-primary/10",
          compact && "p-4",
        )}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className={cn("rounded-lg bg-primary/10", compact ? "p-2" : "p-3")}>
            <Upload className={cn("text-primary", compact ? "size-5" : "size-6")} />
          </div>
          <div>
            <p className="text-sm font-medium">
              {compact ? "Drop or select an image" : "Drag images here to upload"}
            </p>
            {!compact && (
              <p className="text-xs text-muted-foreground">
                PNG, JPEG, WebP, GIF · up to {Math.round(maxSizeBytes / 1024 / 1024)} MB
              </p>
            )}
          </div>
        </div>
        <FileUploadTrigger asChild>
          <Button size="sm" variant="outline" className="mt-2">
            <Upload className="size-4" />
            {compact ? "Select" : "Select images"}
          </Button>
        </FileUploadTrigger>
      </FileUploadDropzone>
      <FileUploadList>
        {files.map((file, i) => (
          <FileUploadItem key={`${file.name}-${i}`} value={file}>
            <FileUploadItemPreview />
            <FileUploadItemMetadata />
            <FileUploadItemProgress />
            <FileUploadItemDelete asChild>
              <Button variant="ghost" size="icon" className="size-7">
                <X className="size-4" />
              </Button>
            </FileUploadItemDelete>
          </FileUploadItem>
        ))}
      </FileUploadList>
    </FileUpload>
  );
}
