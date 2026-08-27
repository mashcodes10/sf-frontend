"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import Button from "@/components/ui/Button";

/** Refuse absurd source files before spending time decoding them. */
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
/** Longest edge after downscaling. Plenty for an avatar, tiny on the wire. */
const TARGET_EDGE = 512;

/**
 * Decode, downscale, and re-encode a picked file as a base64 data URL.
 *
 * Downscaling happens client-side so a phone photo becomes a few dozen KB
 * instead of blowing through the server action body limit and the API's cap.
 * PNG stays PNG to keep transparency; everything else becomes JPEG.
 */
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, TARGET_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas is unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return file.type === "image/png"
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

/**
 * Photo picker for the contact form.
 *
 * The chosen image lives in a hidden `photo` input as a data URL, so the form
 * submits it like any other field — and, crucially, an untouched edit form
 * re-submits the existing photo instead of letting `PUT` silently clear it.
 */
export default function PhotoField({
  defaultValue,
  error,
}: {
  defaultValue?: string;
  error?: string;
}) {
  const [photo, setPhoto] = useState(defaultValue ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const message = localError ?? error;

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be picked again after a remove
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setLocalError("Choose an image file (PNG, JPEG, GIF, or WebP).");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setLocalError("Choose an image smaller than 10 MB.");
      return;
    }

    try {
      setPhoto(await fileToDataUrl(file));
      setLocalError(null);
    } catch {
      setLocalError("That image could not be read. Try a different file.");
    }
  }

  function removePhoto() {
    setPhoto("");
    setLocalError(null);
  }

  return (
    <div>
      <input type="hidden" name="photo" value={photo} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        aria-label="Choose a photo"
        onChange={handleFile}
      />

      <div className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URLs skip the image optimizer
          <img
            src={photo}
            alt="Selected contact photo"
            className="h-20 w-20 shrink-0 select-none rounded-full border border-border object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-20 w-20 shrink-0 select-none items-center justify-center rounded-full border border-dashed border-border bg-secondary/40 text-muted-foreground"
          >
            <Camera className="h-6 w-6" strokeWidth={1.5} />
          </span>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            {photo ? "Change photo" : "Upload photo"}
          </Button>
          {photo ? (
            <Button variant="ghost" size="sm" onClick={removePhoto}>
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p role="alert" className="mt-1.5 text-[13px] text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
