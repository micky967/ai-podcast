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
 * - Mobile: Separate buttons for audio vs documents (fixes file picker issue)
 *
 * Supported Formats:
 * Audio: MP3, M4A, WAV, AAC, FLAC, OGG, Opus, WebM, 3GP, 3G2
 * Documents: PDF, DOC, DOCX, TXT
 */
"use client";

import { FileAudio, FileText, Upload } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { MAX_FILE_SIZE } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  maxSize?: number;
}

export function UploadDropzone({
  onFileSelect,
  disabled = false,
  maxSize = MAX_FILE_SIZE,
}: UploadDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }, []);

  const allowedExtensions = useMemo(
    () => [
      ".mp3",
      ".m4a",
      ".wav",
      ".wave",
      ".aac",
      ".ogg",
      ".oga",
      ".opus",
      ".webm",
      ".flac",
      ".3gp",
      ".3g2",
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
    ],
    []
  );

  const audioExtensions = useMemo(
    () => [
      ".mp3",
      ".m4a",
      ".wav",
      ".wave",
      ".aac",
      ".ogg",
      ".oga",
      ".opus",
      ".webm",
      ".flac",
      ".3gp",
      ".3g2",
    ],
    []
  );

  const documentExtensions = useMemo(
    () => [".pdf", ".doc", ".docx", ".txt"],
    []
  );

  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleNativeFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const fileName = file.name.toLowerCase();
        const isValid = allowedExtensions.some((ext) => fileName.endsWith(ext));
        if (isValid) {
          onFileSelect(file);
        }
        // Reset the input that was used
        const input = e.target;
        if (input) {
          input.value = "";
        }
      }
    },
    [onFileSelect, allowedExtensions]
  );

  const acceptConfig = useMemo(() => {
    if (isMobile) {
      return undefined;
    } else {
      return {
        "audio/mpeg": [".mp3"],
        "audio/x-m4a": [".m4a"],
        "audio/wav": [".wav", ".wave"],
        "audio/x-wav": [".wav", ".wave"],
        "audio/aac": [".aac"],
        "audio/ogg": [".ogg", ".oga"],
        "audio/opus": [".opus"],
        "audio/webm": [".webm"],
        "audio/flac": [".flac"],
        "audio/x-flac": [".flac"],
        "audio/3gpp": [".3gp"],
        "audio/3gpp2": [".3g2"],
        "application/pdf": [".pdf"],
        "application/msword": [".doc"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          [".docx"],
        "text/plain": [".txt"],
      };
    }
  }, [isMobile]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: acceptConfig,
      maxSize,
      maxFiles: 1,
      disabled,
      noClick: isMobile,
      noKeyboard: isMobile,
      noDrag: isMobile,
    });

  const errorMessage = fileRejections[0]?.errors[0]?.message;

  return (
    <div className="w-full">
      {isMobile ? (
        <div className="space-y-4">
          {/* Audio Upload Button */}
          <div
            className={cn(
              "border-3 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
              "border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50",
              disabled && "opacity-50 cursor-not-allowed",
              !disabled && "hover-glow"
            )}
            onClick={() => {
              if (!disabled && audioInputRef.current) {
                audioInputRef.current.click();
              }
            }}
          >
            <input
              ref={audioInputRef}
              type="file"
              accept={audioExtensions.join(",")}
              onChange={handleNativeFileChange}
              className="hidden"
              disabled={disabled}
            />
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl p-6 glass-card">
                <FileAudio className="h-12 w-12 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-gray-900">
                  Upload Audio File
                </p>
                <p className="text-sm text-gray-600">
                  MP3, WAV, M4A, FLAC, OGG, AAC
                </p>
              </div>
            </div>
          </div>

          {/* Document Upload Button */}
          <div
            className={cn(
              "border-3 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
              "border-blue-300 hover:border-blue-500 hover:bg-blue-50/50",
              disabled && "opacity-50 cursor-not-allowed",
              !disabled && "hover-glow"
            )}
            onClick={() => {
              if (!disabled && documentInputRef.current) {
                documentInputRef.current.click();
              }
            }}
          >
            <input
              ref={documentInputRef}
              type="file"
              accept={documentExtensions.join(",")}
              onChange={handleNativeFileChange}
              className="hidden"
              disabled={disabled}
            />
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl p-6 glass-card">
                <FileText className="h-12 w-12 text-blue-600" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-gray-900">
                  Upload Document
                </p>
                <p className="text-sm text-gray-600">PDF, DOC, DOCX, TXT</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Maximum file size: {Math.round(maxSize / (1024 * 1024))}MB
          </p>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            "border-3 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all",
            "border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50",
            isDragActive &&
              "border-emerald-600 bg-emerald-50 scale-[1.02] shadow-xl",
            disabled && "opacity-50 cursor-not-allowed",
            errorMessage && "border-red-400 bg-red-50/30",
            !disabled && "hover-glow"
          )}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-6">
            <div
              className={cn(
                "rounded-3xl p-8 transition-all",
                isDragActive
                  ? "gradient-emerald animate-pulse-emerald shadow-2xl scale-110"
                  : "glass-card"
              )}
            >
              {isDragActive ? (
                <Upload className="h-16 w-16 text-white animate-bounce" />
              ) : (
                <FileText className="h-16 w-16 text-emerald-600" />
              )}
            </div>

            <div className="space-y-3">
              <p className="text-2xl font-bold text-gray-900">
                {isDragActive ? "Drop your file here" : "Drag & drop your file"}
              </p>
              <p className="text-base text-gray-600">
                or click to browse files
              </p>
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

      {errorMessage && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600 font-medium">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
