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
        const meta = await sharp(file.buffer).metadata();
        const croppedMeta = await sharp(cropped).metadata();
        const mimeType =
          meta.format === "png"
            ? "image/png"
            : meta.format === "jpeg" || meta.format === "jpg"
              ? "image/jpeg"
              : "image/png";
        const output =
          mimeType === "image/png"
            ? await sharp(cropped).png({ quality: 100 }).toBuffer()
            : await sharp(cropped).jpeg({ quality: 95 }).toBuffer();

        return {
          filename: file.filename,
          originalWidth: meta.width ?? 0,
          originalHeight: meta.height ?? 0,
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
