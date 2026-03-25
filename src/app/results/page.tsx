"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { loadResults } from "@/lib/resultsStorage";

type ProcessedResult = {
  filename: string;
  originalWidth: number;
  originalHeight: number;
  cropWidth: number;
  cropHeight: number;
  mimeType: string;
  dataUrl: string;
};

export default function ResultsPage() {
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [mounted, setMounted] = useState(false);
  const [previewResult, setPreviewResult] = useState<ProcessedResult | null>(
    null
  );

  useEffect(() => {
    loadResults()
      .then((stored) => {
        if (stored && stored.length > 0) setResults(stored);
      })
      .finally(() => setMounted(true));
  }, []);

  const download = useCallback((result: ProcessedResult) => {
    const a = document.createElement("a");
    a.href = result.dataUrl;
    const base = result.filename.replace(/\.[^.]+$/, "");
    const ext = result.mimeType === "image/png" ? "png" : "jpg";
    a.download = `${base}_cropped.${ext}`;
    a.click();
  }, []);

  const [downloadingAll, setDownloadingAll] = useState(false);
  const [hasDownloadedAll, setHasDownloadedAll] = useState(false);

  const downloadAll = useCallback(async () => {
    if (results.length === 0) return;
    setDownloadingAll(true);
    try {
      const zip = new JSZip();
      for (const r of results) {
        const base = r.filename.replace(/\.[^.]+$/, "");
        const ext = r.mimeType === "image/png" ? "png" : "jpg";
        const name = `${base}_cropped.${ext}`;
        const base64 = r.dataUrl.split(",")[1];
        if (base64) zip.file(name, base64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cropboard-images.zip";
      a.click();
      URL.revokeObjectURL(url);
      setHasDownloadedAll(true);
    } finally {
      setDownloadingAll(false);
    }
  }, [results]);

  if (!mounted) {
    return (
      <main className="min-h-screen">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-[13px] text-[#a1a1a6]">Loading…</p>
        </div>
      </main>
    );
  }

  if (results.length === 0) {
    return (
      <main className="min-h-screen">
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
          <p className="text-center text-[15px] text-[#a1a1a6]">
            No images to show. Start over.
          </p>
          <Link
            href="/"
            className="rounded-full bg-[#f5f5f7] px-6 py-2.5 text-sm font-medium text-[#0b0b0c] transition-all duration-200 hover:bg-white"
          >
            Back
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-14">
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center">
            <img
              src="/logo/logo5.png"
              alt="Cropboard"
              className="h-[25px] w-auto object-contain sm:h-[29px]"
            />
          </Link>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={downloadAll}
              disabled={downloadingAll}
              className="rounded-full bg-[#f5f5f7] px-5 py-2.5 text-sm font-medium text-[#0b0b0c] transition-all duration-200 hover:bg-white disabled:opacity-50"
            >
              {downloadingAll ? "Preparing…" : "Download all"}
            </button>
            {hasDownloadedAll && (
              <Link
                href="/"
                className="rounded-full bg-[#1c1c1e] px-5 py-2.5 text-sm font-medium text-[#f5f5f7] transition-all duration-200 hover:bg-[#2c2c2e]"
              >
                Crop more
              </Link>
            )}
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-12 sm:grid-cols-2">
          {results.map((result) => (
            <li
              key={result.filename}
              className="group flex flex-col items-center gap-4"
            >
              <div className="w-full rounded-2xl bg-[#141416] p-6 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-black/20">
                <div className="relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-[#0b0b0c]">
                  <img
                    src={result.dataUrl}
                    alt={result.filename}
                    className="max-h-[70vh] max-w-full object-contain"
                  />

                  {/* Preview icon - appears on hover; opens centered popup on click */}
                  <button
                    type="button"
                    aria-label="Preview A4 page"
                    className="absolute right-4 top-4 z-10 rounded-full border border-white/[0.12] bg-white/[0.06] p-2 text-[#f5f5f7] opacity-0 backdrop-blur transition-all duration-200 hover:bg-white/[0.12] group-hover:opacity-100"
                    onClick={() => setPreviewResult(result)}
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex w-full flex-col items-center gap-3">
                <p className="truncate text-center text-[13px] text-[#a1a1a6]">
                  {result.filename}
                </p>
                <button
                  type="button"
                  onClick={() => download(result)}
                  className="rounded-full bg-[#1c1c1e] px-4 py-2 text-[13px] font-medium text-[#f5f5f7] transition-all duration-200 hover:bg-[#2c2c2e]"
                >
                  Download
                </button>
              </div>
            </li>
          ))}
        </ul>

        {previewResult && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              // Close when clicking overlay; keep clicks on popup content open.
              if (e.target === e.currentTarget) setPreviewResult(null);
            }}
          >
            <div className="relative w-full max-w-4xl rounded-2xl border border-white/[0.12] bg-[#0b0b0c] p-5 shadow-2xl">
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setPreviewResult(null)}
                className="absolute right-3 top-3 rounded-full border border-white/[0.12] bg-white/[0.06] p-2 text-[#f5f5f7] backdrop-blur transition-all duration-200 hover:bg-white/[0.12]"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>

              <div className="flex flex-col items-center gap-3">
                <p className="text-center text-[13px] text-[#a1a1a6]">
                  {previewResult.filename}
                </p>
                <img
                  src={previewResult.dataUrl}
                  alt=""
                  className="max-h-[90vh] w-auto max-w-full rounded-xl object-contain"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
