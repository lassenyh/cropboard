"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveResults } from "@/lib/resultsStorage";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"crop" | "3x3">("crop");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingAddMore, setIsDraggingAddMore] = useState(false);
  const [isDraggingNextPage, setIsDraggingNextPage] = useState(false);

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

  // Extra drop zone for adding another 3×3 page worth of images.
  const onNextPageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingNextPage(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const onNextPageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingNextPage(true);
  }, []);

  const onNextPageDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingNextPage(false);
  }, []);

  const goForward = useCallback(async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setAnalyzeProgress(0);
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

    const allResults: {
      filename: string;
      dataUrl: string;
      mimeType: string;
      cropWidth: number;
      cropHeight: number;
      originalWidth: number;
      originalHeight: number;
    }[] = [];
    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
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
        setAnalyzeProgress(((i + 1) / batches.length) * 100);
      }
      const resultsToSave =
        mode === "3x3" ? await composeA4_3x3(allResults) : allResults;

      try {
        await saveResults(resultsToSave);
      } catch {
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
      setAnalyzeProgress(0);
    }
  }, [files, mode, router]);

  async function composeA4_3x3(
    croppedResults: {
      filename: string;
      dataUrl: string;
      mimeType: string;
      cropWidth: number;
      cropHeight: number;
      originalWidth: number;
      originalHeight: number;
    }[]
  ) {
    // A4 landscape @ ~300 DPI
    const PAGE_W = 3508;
    const PAGE_H = 2480;
    // Padding so frames stay large, but there is still breathing room.
    const MARGIN = 120;
    const GAP = 60;
    const CELL_W = Math.floor((PAGE_W - MARGIN * 2 - GAP * 2) / 3);
    const CELL_H = Math.floor((PAGE_H - MARGIN * 2 - GAP * 2) / 3);

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = src;
      });

    if (croppedResults.length === 0) return [];

    const pageCount = Math.ceil(croppedResults.length / 9);
    const pages: {
      filename: string;
      dataUrl: string;
      mimeType: string;
      cropWidth: number;
      cropHeight: number;
      originalWidth: number;
      originalHeight: number;
    }[] = [];

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const canvas = document.createElement("canvas");
      canvas.width = PAGE_W;
      canvas.height = PAGE_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      // A4 paper background (white)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, PAGE_W, PAGE_H);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 6;

      for (let i = 0; i < 9; i++) {
        const globalIndex = pageIndex * 9 + i;
        const r = croppedResults[globalIndex];
        if (!r) continue;
        const img = await loadImage(r.dataUrl);

        const row = Math.floor(i / 3);
        const col = i % 3;
        const x = MARGIN + col * (CELL_W + GAP);
        const y = MARGIN + row * (CELL_H + GAP);

        // "Cover" each cell: scale so the frame fills the whole cell.
        const scale = Math.max(CELL_W / img.width, CELL_H / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const dx = x + (CELL_W - w) / 2;
        const dy = y + (CELL_H - h) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, CELL_W, CELL_H);
        ctx.clip();
        ctx.drawImage(img, dx, dy, w, h);
        ctx.restore();

        // Outline around each filled cell/frame
        ctx.strokeRect(x + 0.5, y + 0.5, CELL_W - 1, CELL_H - 1);
      }

      const dataUrl = canvas.toDataURL("image/png");
      pages.push({
        filename: `cropboard_3x3_a4_${pageIndex + 1}.png`,
        originalWidth: PAGE_W,
        originalHeight: PAGE_H,
        cropWidth: PAGE_W,
        cropHeight: PAGE_H,
        mimeType: "image/png",
        dataUrl,
      });
    }

    return pages;
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-20">
        <img
          src="/logo/logo3.png"
          alt="Cropboard"
          className="mb-16 h-36 w-auto object-contain sm:h-48"
        />

        <div className="mb-10 flex items-center gap-1 rounded-full bg-white/[0.06] p-1">
          <button
            type="button"
            onClick={() => {
              setMode("crop");
              setError(null);
            }}
            className={`rounded-full px-4 py-2 text-[13px] font-medium transition-all ${
              mode === "crop"
                ? "bg-white/[0.12] text-[#f5f5f7]"
                : "text-[#a1a1a6] hover:text-[#f5f5f7]"
            }`}
          >
            Crop
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("3x3");
              setError(null);
            }}
            className={`rounded-full px-4 py-2 text-[13px] font-medium transition-all ${
              mode === "3x3"
                ? "bg-white/[0.12] text-[#f5f5f7]"
                : "text-[#a1a1a6] hover:text-[#f5f5f7]"
            }`}
          >
            3×3 A4
          </button>
        </div>

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
              {mode === "3x3"
                ? "Drop storyboard frames here (3×3 pages; last page can be partial) or click to upload"
                : "Drop storyboard frames here or click to upload"}
            </span>
          </label>
        ) : mode === "3x3" ? (
          <div className="w-full">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from(
                { length: Math.max(1, Math.ceil(previews.length / 9)) },
                (_, pageIndex) => (
                  <div
                    key={pageIndex}
                    className="rounded-[18px] border border-white/[0.12] bg-white/[0.03] p-2"
                  >
                    <div className="mx-auto grid w-fit grid-cols-3 gap-1">
                      {Array.from({ length: 9 }, (_, cellIndex) => {
                        const globalIndex = pageIndex * 9 + cellIndex;
                        const item = previews[globalIndex];
                        return (
                          <div
                            key={globalIndex}
                            className={`h-20 w-20 overflow-hidden rounded-lg ${
                              item ? "bg-[#1c1c1e]" : ""
                            }`}
                          >
                            {item && (
                              <img
                                src={item.url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </label>
          </div>
        )}

        {mode === "3x3" && files.length > 0 && (
          <label
            onDrop={onNextPageDrop}
            onDragOver={onNextPageDragOver}
            onDragLeave={onNextPageDragLeave}
            className={`mt-8 flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center rounded-[18px] border-2 border-dashed transition-all duration-200 ${
              isDraggingNextPage
                ? "border-white/30 bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                : "border-white/[0.12] hover:border-white/[0.18] hover:bg-white/[0.02] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            }`}
          >
            <input
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              multiple
              onChange={onAddMoreFileChange}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <svg
                className="h-8 w-8 text-[#a1a1a6]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-center text-[13px] tracking-wide text-[#a1a1a6]">
                Drop more storyboard frames to add to your pages
              </span>
            </div>
          </label>
        )}

        {files.length > 0 && (
          <>
            <button
              type="button"
              onClick={goForward}
              disabled={loading}
              className="mt-12 w-full rounded-full bg-[#f5f5f7] px-8 py-3.5 text-sm font-medium text-[#0b0b0c] transition-all duration-200 hover:bg-white disabled:opacity-50"
            >
              {loading ? "Analyzing…" : "Go cropping"}
            </button>
            {mode === "3x3" && !loading && (
              <p className="mt-4 text-center text-[13px] text-[#a1a1a6]">
                Frames are arranged into 3×3 A4 pages (last page can be partial).
              </p>
            )}
            {loading && (
              <div className="mt-4 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-white/80 transition-[width] duration-300 ease-out"
                  style={{ width: `${analyzeProgress}%` }}
                />
              </div>
            )}
          </>
        )}

        {error && (
          <p className="mt-6 text-center text-[13px] text-red-400/90">{error}</p>
        )}
      </div>
    </main>
  );
}
