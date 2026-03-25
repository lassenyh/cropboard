import { NextRequest, NextResponse } from "next/server";
import { cropStoryboardBorder } from "@/lib/imageProcessing/cropStoryboardBorder";
import sharp from "sharp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const fileList = formData.getAll("files");
    const files: { buffer: Buffer; filename: string }[] = [];

    for (const value of fileList) {
      if (!(value instanceof File)) continue;
      const arrayBuffer = await value.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length === 0) continue;
      const filename = value.name || "image";
      const lower = filename.toLowerCase();
      if (
        !lower.endsWith(".png") &&
        !lower.endsWith(".jpg") &&
        !lower.endsWith(".jpeg")
      ) {
        continue;
      }
      files.push({ buffer, filename });
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No valid PNG or JPG/JPEG files provided" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      files.map(async (file) => {
        const cropped = await cropStoryboardBorder(file.buffer);

        // Read metadata from original for reference only (dimensions etc.)
        const originalMeta = await sharp(file.buffer).metadata();

        // Always re-encode from the cropped raster only – this guarantees a
        // destructively cropped output file with no metadata from the original
        const croppedImage = sharp(cropped);
        const croppedMeta = await croppedImage.metadata();

        const format =
          croppedMeta.format === "png"
            ? "png"
            : croppedMeta.format === "jpeg" || croppedMeta.format === "jpg"
              ? "jpeg"
              : originalMeta.format === "png"
                ? "png"
                : "jpeg";

        const mimeType = format === "png" ? "image/png" : "image/jpeg";

        const pipeline =
          format === "png"
            ? croppedImage.png({ quality: 100, force: true })
            : croppedImage.jpeg({ quality: 95, mozjpeg: true, force: true });

        const output = await pipeline.toBuffer();

        const baseName = file.filename.replace(/\.[^.]+$/, "");
        const ext = format === "png" ? "png" : "jpg";

        return {
          filename: `${baseName}_cropped.${ext}`,
          originalWidth: originalMeta.width ?? 0,
          originalHeight: originalMeta.height ?? 0,
          cropWidth: croppedMeta.width ?? 0,
          cropHeight: croppedMeta.height ?? 0,
          mimeType,
          dataUrl: `data:${mimeType};base64,${output.toString("base64")}`,
        };
      })
    );

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process images";
    console.error("Error processing storyboard images", error);
    return NextResponse.json(
      { error: "Failed to process storyboard images", detail: message },
      { status: 500 }
    );
  }
}
