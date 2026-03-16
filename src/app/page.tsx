"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveResults } from "@/lib/resultsStorage";

export default function Home() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingAddMore, setIsDraggingAddMore] = useState(false);

  const validImageFiles = useCallback((fileList: File[]) => {
    return fileList.filter((f) => {
      const n = f.name.toLowerCase();
      return n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg");
    });
  }, []);

  const setFilesAndPreviews = useCallback((newFiles: File[]) => {
    const valid = validImageFiles(newFiles);
    setPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return valid.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));
    });
    setFiles(valid);
    setError(null);
  }, [validImageFiles]);

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const valid = validImageFiles(newFiles);
      if (valid.length === 0) return;
      setFiles((prev) => [...prev, ...valid]);
      setPreviews((prev) => [
        ...prev,
        ...valid.map((file) => ({
          file,
          url: URL.createObjectURL(file),
        })),
      ]);
      setError(null);
    },
    [validImageFiles]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilesAndPreviews(Array.from(e.target.files ?? []));
    },
    [setFilesAndPreviews]
  );

  const onAddMoreFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(e.target.files ?? []));
      e.target.value = "";
    },
    [addFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setFilesAndPreviews(Array.from(e.dataTransfer.files));
    },
    [setFilesAndPreviews]
  );

  const onAddMoreDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingAddMore(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onAddMoreDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAddMore(true);
  }, []);

  const onAddMoreDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAddMore(false);
  }, []);

  const goForward = useCallback(async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    const MAX_BATCH_BYTES = 4 * 1024 * 1024; // 4 MB (Vercel limit 4.5 MB)
    const batches: File[][] = [];
    let currentBatch: File[] = [];
    let currentSize = 0;
    for (const file of files) {
      if (
        currentSize + file.size > MAX_BATCH_BYTES &&
        currentBatch.length > 0
      ) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }
      currentBatch.push(file);
      currentSize += file.size;
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    const allResults: { filename: string; dataUrl: string; mimeType: string; cropWidth: number; cropHeight: number; originalWidth: number; originalHeight: number }[] = [];
    try {
      for (const batch of batches) {
        const formData = new FormData();
        batch.forEach((f) => formData.append("files", f));
        const res = await fetch("/api/process-storyboards", {
          method: "POST",
          body: formData,
        });
        const text = await res.text();
        let data: {
          error?: string;
          detail?: string;
          results?: { filename: string; dataUrl: string; mimeType: string; cropWidth: number; cropHeight: number; originalWidth: number; originalHeight: number }[];
        } = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          const message =
            res.status === 413 ||
            text.toLowerCase().includes("entity too large")
              ? "Files too large. Try fewer or smaller images."
              : res.statusText || "Something went wrong";
          setError(message);
          return;
        }
        if (!res.ok) {
          setError(data.error || data.detail || "Something went wrong");
          return;
        }
        allResults.push(...(data.results ?? []));
      }
      try {
        await saveResults(allResults);
      } catch (storageErr) {
        setError(
          "Could not save results (browser storage limit). Try fewer images or a different browser."
        );
        return;
      }
      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [files, router]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-20">
        <img
          src="/logo/logo3.png"
          alt="Cropboard"
          className="mb-16 h-36 w-auto object-contain sm:h-48"
        />

        {files.length === 0 ? (
          <label
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center rounded-[18px] border-2 border-dashed transition-all duration-200 ${
              isDragging
                ? "border-white/30 bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                : "border-white/[0.12] hover:border-white/[0.18] hover:bg-white/[0.02] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            }`}
          >
            <input
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              multiple
              onChange={onFileChange}
              className="hidden"
            />
            <span className="text-center text-[13px] tracking-wide text-[#a1a1a6]">
              Drop storyboard frames here or click to upload
            </span>
          </label>
        ) : (
          <div className="flex w-full flex-wrap justify-center gap-3">
            {previews.map(({ url }) => (
              <div
                key={url}
                className="flex h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#1c1c1e]"
              >
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
            <label
              onDrop={onAddMoreDrop}
              onDragOver={onAddMoreDragOver}
              onDragLeave={onAddMoreDragLeave}
              className={`flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 ${
                isDraggingAddMore
                  ? "border-white/30 bg-white/[0.06]"
                  : "border-white/[0.12] hover:border-white/[0.18] hover:bg-white/[0.02]"
              }`}
            >
              <input
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                multiple
                onChange={onAddMoreFileChange}
                className="hidden"
              />
              <svg
                className="h-8 w-8 text-[#a1a1a6]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </label>
          </div>
        )}

        {files.length > 0 && (
          <button
            type="button"
            onClick={goForward}
            disabled={loading}
            className="mt-12 w-full rounded-full bg-[#f5f5f7] px-8 py-3.5 text-sm font-medium text-[#0b0b0c] transition-all duration-200 hover:bg-white disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Go cropping"}
          </button>
        )}

        {error && (
          <p className="mt-6 text-center text-[13px] text-red-400/90">{error}</p>
        )}
      </div>
    </main>
  );
}
