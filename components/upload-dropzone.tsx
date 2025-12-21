/**
 * Upload Dropzone Component
 *
 * Drag-and-drop file selector with validation and visual feedback.
 * Built on react-dropzone for cross-browser compatibility.
 *
 * Features:
 * - Drag and drop support
 * - Click to browse files
 * - File type validation (audio and document formats)
 * - File size validation
 * - Visual feedback (drag state, errors)
 * - Accessible file input
 *
 * Supported Formats:
 * Audio: MP3, M4A, WAV, AAC, FLAC, OGG, Opus, WebM, 3GP, 3G2
 * Documents: PDF, DOC, DOCX, TXT
 * - Multiple MIME type variants for cross-browser support
 *
 * Design Decision: Why so many MIME types?
 * - Browsers report different MIME types for same format
 * - x-m4a vs. mp4 vs. m4a inconsistencies
 * - Ensures consistent behavior across Chrome, Firefox, Safari
 */
"use client";

import { FileAudio, FileText, Upload } from "lucide-react";
import { useCallback, useMemo, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { MAX_FILE_SIZE } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void; // Callback when valid file is selected
  disabled?: boolean; // Disable during upload
  maxSize?: number; // Max file size in bytes (default: MAX_FILE_SIZE)
}

export function UploadDropzone({
  onFileSelect,
  disabled = false,
  maxSize = MAX_FILE_SIZE,
}: UploadDropzoneProps) {
  /**
   * Handle accepted files from dropzone
   *
   * Only takes first file (maxFiles: 1 enforced)
   * Rejected files are handled by react-dropzone
   */
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect],
  );

  // Detect if we're on a mobile device
  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }, []);

  // Allowed file extensions for validation
  const allowedExtensions = useMemo(() => [
    ".mp3", ".m4a", ".wav", ".wave", ".aac", ".ogg", ".oga", ".opus", ".webm", ".flac", ".3gp", ".3g2",
    ".pdf", ".doc", ".docx", ".txt"
  ], []);

  // Ref to the native file input for mobile (bypasses react-dropzone)
  const nativeInputRef = useRef<HTMLInputElement>(null);

  // Handle native file input change on mobile
  const handleNativeFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        // Validate file extension
        const fileName = file.name.toLowerCase();
        const isValid = allowedExtensions.some(ext => fileName.endsWith(ext));
        if (isValid) {
          onFileSelect(file);
        }
        // Reset input to allow selecting the same file again
        if (nativeInputRef.current) {
          nativeInputRef.current.value = "";
        }
      }
    },
    [onFileSelect, allowedExtensions]
  );

  // On desktop, use specific MIME types for better browser validation
  const acceptConfig = useMemo(() => {
    if (isMobile) {
      // Mobile: Don't use react-dropzone at all - we use native input
      return undefined;
    } else {
      // Desktop: All formats with specific MIME types
      return {
        // Audio formats
        "audio/mpeg": [".mp3"], // MP3
        "audio/x-m4a": [".m4a"], // M4A (iOS/Apple)
        "audio/wav": [".wav", ".wave"], // WAV
        "audio/x-wav": [".wav", ".wave"], // WAV (alternate MIME)
        "audio/aac": [".aac"], // AAC
        "audio/ogg": [".ogg", ".oga"], // OGG Vorbis
        "audio/opus": [".opus"], // Opus
        "audio/webm": [".webm"], // WebM Audio
        "audio/flac": [".flac"], // FLAC
        "audio/x-flac": [".flac"], // FLAC (alternate MIME)
        "audio/3gpp": [".3gp"], // 3GP
        "audio/3gpp2": [".3g2"], // 3G2
        // Document formats
        "application/pdf": [".pdf"], // PDF
        "application/msword": [".doc"], // DOC (Word 97-2003)
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], // DOCX
        "text/plain": [".txt"], // TXT
      };
    }
  }, [isMobile]);

  // react-dropzone configuration and state (desktop only)
  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      // Accept configuration: only used on desktop
      accept: acceptConfig,
      maxSize, // File size limit (validates before upload)
      maxFiles: 1, // Only allow single file selection
      disabled, // Disable dropzone during upload
      // Disable react-dropzone on mobile - we use native input instead
      noClick: isMobile,
      noKeyboard: isMobile,
      noDrag: isMobile,
    });

  // Extract first rejection error for display
  const errorMessage = fileRejections[0]?.errors[0]?.message;

  return (
    <div className="w-full">
      {/* On mobile, use native file input that bypasses react-dropzone's accept */}
      {isMobile ? (
        <div
          className={cn(
            // Base styles: Dashed border, clickable, transitions
            "border-3 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all",
            "border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50",
            // Disabled state
            disabled && "opacity-50 cursor-not-allowed",
            // Error state
            errorMessage && "border-red-400 bg-red-50/30",
            // Hover glow effect
            !disabled && "hover-glow",
          )}
          onClick={() => {
            if (!disabled && nativeInputRef.current) {
              nativeInputRef.current.click();
            }
          }}
        >
          {/* Native file input with NO accept attribute - allows file manager on mobile */}
          <input
            ref={nativeInputRef}
            type="file"
            onChange={handleNativeFileChange}
            className="hidden"
            disabled={disabled}
            // No accept attribute = file manager will appear on mobile
          />
          
          <div className="flex flex-col items-center gap-6">
            {/* Icon indicator */}
            <div className="rounded-3xl p-8 transition-all glass-card">
              <FileText className="h-16 w-16 text-emerald-600" />
            </div>

            {/* Instructions and info */}
            <div className="space-y-3">
              <p className="text-2xl font-bold text-gray-900">
                Tap to select a file
              </p>
              <p className="text-base text-gray-600">Choose from your files</p>
              <div className="pt-2 space-y-1">
                <p className="text-sm text-gray-500 font-medium">
                  Supports: MP3, WAV, M4A, FLAC, OGG, AAC, PDF, DOC, DOCX, TXT
                </p>
                <p className="text-sm text-gray-500 font-semibold">
                  Maximum file size: {Math.round(maxSize / (1024 * 1024))}MB
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            // Base styles: Dashed border, clickable, transitions
            "border-3 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all",
            "border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50",
            // Drag active state (file hovering over dropzone)
            isDragActive &&
              "border-emerald-600 bg-emerald-50 scale-[1.02] shadow-xl",
            // Disabled state
            disabled && "opacity-50 cursor-not-allowed",
            // Error state
            errorMessage && "border-red-400 bg-red-50/30",
            // Hover glow effect
            !disabled && "hover-glow",
          )}
        >
          {/* Hidden file input (accessibility) - desktop only */}
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-6">
          {/* Icon indicator */}
          <div
            className={cn(
              "rounded-3xl p-8 transition-all",
              isDragActive
                ? "gradient-emerald animate-pulse-emerald shadow-2xl scale-110"
                : "glass-card",
            )}
          >
            {isDragActive ? (
              <Upload className="h-16 w-16 text-white animate-bounce" />
            ) : (
              <FileText className="h-16 w-16 text-emerald-600" />
            )}
          </div>

          {/* Instructions and info */}
          <div className="space-y-3">
            <p className="text-2xl font-bold text-gray-900">
              {isDragActive
                ? "Drop your file here"
                : "Drag & drop your file"}
            </p>
            <p className="text-base text-gray-600">or click to browse files</p>
            <div className="pt-2 space-y-1">
              <p className="text-sm text-gray-500 font-medium">
                Supports: MP3, WAV, M4A, FLAC, OGG, AAC, PDF, DOC, DOCX, TXT
              </p>
              <p className="text-sm text-gray-500 font-semibold">
                Maximum file size: {Math.round(maxSize / (1024 * 1024))}MB
              </p>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Error message display - shows for both mobile and desktop */}
      {errorMessage && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600 font-medium">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
