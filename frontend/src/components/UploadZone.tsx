import { useRef, useState, type DragEvent } from "react";

import { api } from "../lib/api";
import type { Upload } from "../lib/types";
import { Icon } from "./Icon";
import { Spinner } from "./ui";

interface UploadZoneProps {
  files: Upload[];
  onChange: (files: Upload[]) => void;
  max?: number;
  hint?: string;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 8;

export function UploadZone({ files, onChange, max = 1, hint }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);

    const remaining = max - files.length;
    if (remaining <= 0) {
      setError(`Maximum ${max} image${max > 1 ? "s" : ""}.`);
      return;
    }

    const selected = Array.from(list).slice(0, remaining);
    const invalid = selected.find(
      (file) => !ACCEPTED.includes(file.type) || file.size > MAX_MB * 1024 * 1024,
    );
    if (invalid) {
      setError("Use a JPEG, PNG or WebP image up to 8 MB.");
      return;
    }

    setBusy(true);
    try {
      const uploaded: Upload[] = [];
      for (const file of selected) {
        uploaded.push(await api.uploads.upload(file));
      }
      onChange([...files, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="upload">
      <div
        className={`dropzone${dragging ? " dropzone-active" : ""}${busy ? " dropzone-busy" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple={max > 1}
          hidden
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <span className="dropzone-icon">{busy ? <Spinner size={20} /> : <Icon name="camera" size={20} />}</span>
        <strong>{busy ? "Uploading…" : "Drop a site photo or browse"}</strong>
        <span className="dropzone-hint">{hint ?? "JPEG, PNG or WebP · up to 8 MB"}</span>
      </div>

      {files.length > 0 && (
        <div className="thumbs">
          {files.map((file) => (
            <figure key={file.id} className="thumb">
              <img src={file.url} alt={file.filename} />
              <figcaption>{file.filename}</figcaption>
              <button
                type="button"
                className="thumb-remove"
                aria-label={`Remove ${file.filename}`}
                onClick={() => onChange(files.filter((item) => item.id !== file.id))}
              >
                <Icon name="close" size={13} />
              </button>
            </figure>
          ))}
        </div>
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
