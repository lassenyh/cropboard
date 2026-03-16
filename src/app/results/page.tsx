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
              src="/logo/logo4.png"
              alt="Cropboard"
              className="h-[84px] w-auto object-contain sm:h-24"
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
                <div className="flex w-full items-center justify-center overflow-hidden rounded-xl bg-[#0b0b0c]">
                  <img
                    src={result.dataUrl}
                    alt={result.filename}
                    className="max-h-[70vh] max-w-full object-contain"
                  />
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
      </div>
    </main>
  );
}
