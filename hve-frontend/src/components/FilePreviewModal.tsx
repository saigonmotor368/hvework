import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  authenticatedFileUrl,
  fetchAuthenticatedBlob,
  openAuthenticatedFile,
} from "../api/client";

export interface PreviewableFile {
  fileUrl: string;
  fileName: string;
  mimeType?: string | null;
  size?: number | null;
}

type PreviewKind = "image" | "pdf" | "docx" | "unsupported";

/** Phân loại tệp để chọn cách xem nhanh phù hợp. */
export function detectPreviewKind(file: {
  fileName: string;
  mimeType?: string | null;
}): PreviewKind {
  const name = file.fileName.toLowerCase();
  const mime = (file.mimeType || "").toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(name)) {
    return "image";
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  return "unsupported";
}

const DOCX_FRAME_STYLE = `
  body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;margin:0;padding:24px;}
  table{border-collapse:collapse;max-width:100%;} td,th{border:1px solid #cbd5e1;padding:4px 8px;vertical-align:top;}
  img{max-width:100%;height:auto;} p{margin:0 0 .6em;} h1,h2,h3{margin:1em 0 .4em;}
`;

interface FilePreviewModalProps {
  apiBaseUrl: string;
  file: PreviewableFile;
  onClose: () => void;
}

/**
 * Xem nhanh tệp đính kèm ngay trong ứng dụng. Luôn có nút Quay lại / Đóng và phím Esc.
 * Hỗ trợ ảnh, PDF, Word (.docx); các định dạng khác cho tải về.
 */
export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  apiBaseUrl,
  file,
  onClose,
}) => {
  const kind = useMemo(() => detectPreviewKind(file), [file]);
  const [state, setState] = useState<"loading" | "ready" | "error">(
    kind === "unsupported" ? "ready" : "loading",
  );
  const [error, setError] = useState("");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState("");
  const [zoom, setZoom] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    setZoom(1);
    setBlobUrl(null);
    setDocxHtml("");
    setError("");
    if (kind === "unsupported") {
      setState("ready");
      return;
    }
    setState("loading");
    (async () => {
      try {
        const blob = await fetchAuthenticatedBlob(apiBaseUrl, file.fileUrl);
        if (!active) return;
        if (kind === "docx") {
          const mammoth = await import("mammoth");
          const result = await mammoth.convertToHtml({
            arrayBuffer: await blob.arrayBuffer(),
          });
          if (!active) return;
          setDocxHtml(result.value || "<p><i>Tệp không có nội dung văn bản.</i></p>");
        } else {
          const typed =
            kind === "pdf" && blob.type !== "application/pdf"
              ? new Blob([blob], { type: "application/pdf" })
              : blob;
          createdUrl = URL.createObjectURL(typed);
          setBlobUrl(createdUrl);
        }
        setState("ready");
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Không mở được tệp đính kèm",
        );
        setState("error");
      }
    })();
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [apiBaseUrl, file, kind]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const download = async () => {
    try {
      const blob = await fetchAuthenticatedBlob(apiBaseUrl, file.fileUrl);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được tệp");
      setState("error");
    }
  };

  const openInTab = () => {
    openAuthenticatedFile(apiBaseUrl, file.fileUrl).catch((err) => {
      setError(err instanceof Error ? err.message : "Không mở được tệp");
      setState("error");
    });
  };

  const sizeLabel =
    file.size && file.size > 0
      ? file.size >= 1024 * 1024
        ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`
      : "";

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-slate-900/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem nhanh ${file.fileName}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-slate-900 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-white sm:px-5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20"
        >
          <span aria-hidden>←</span> Quay lại
        </button>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-sm font-bold">{file.fileName}</p>
          {sizeLabel && (
            <p className="text-[10px] text-slate-400">Xem nhanh · {sizeLabel}</p>
          )}
        </div>
        {kind === "image" && state === "ready" && (
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
              className="h-9 w-9 rounded-lg bg-white/10 text-base font-bold hover:bg-white/20"
              aria-label="Thu nhỏ"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="h-9 min-w-12 rounded-lg bg-white/10 px-2 text-[11px] font-bold hover:bg-white/20"
              aria-label="Đặt lại kích thước"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
              className="h-9 w-9 rounded-lg bg-white/10 text-base font-bold hover:bg-white/20"
              aria-label="Phóng to"
            >
              +
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={openInTab}
          className="hidden min-h-10 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20 sm:inline-flex sm:items-center"
        >
          ↗ Mở tab mới
        </button>
        <button
          type="button"
          onClick={download}
          className="hidden min-h-10 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20 sm:inline-flex sm:items-center"
        >
          ⬇ Tải về
        </button>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-white px-3 text-xs font-black text-slate-900 hover:bg-slate-200"
          aria-label="Đóng xem nhanh"
        >
          ✕ <span className="ml-1 hidden sm:inline">Đóng</span>
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-slate-100">
        {state === "loading" && (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
            Đang tải bản xem nhanh…
          </div>
        )}

        {state === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="max-w-sm text-sm font-semibold text-rose-600">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white"
            >
              Đóng
            </button>
          </div>
        )}

        {state === "ready" && kind === "image" && blobUrl && (
          <div className="flex min-h-full items-center justify-center p-4">
            <img
              src={blobUrl}
              alt={file.fileName}
              style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? "100%" : "none" }}
              className="h-auto max-h-none rounded-lg bg-white object-contain shadow-lg"
            />
          </div>
        )}

        {state === "ready" && kind === "pdf" && blobUrl && (
          <div className="flex h-full flex-col">
            <iframe
              title={file.fileName}
              src={blobUrl}
              className="min-h-0 w-full flex-1 border-0 bg-white"
            />
            <p className="shrink-0 bg-slate-100 px-3 py-1.5 text-center text-[11px] text-slate-500">
              Không thấy nội dung PDF? Bấm “Mở tab mới” hoặc “Tải về” để xem trên thiết bị.
            </p>
          </div>
        )}

        {state === "ready" && kind === "docx" && (
          <iframe
            title={file.fileName}
            sandbox=""
            srcDoc={`<!doctype html><meta charset="utf-8"><style>${DOCX_FRAME_STYLE}</style>${docxHtml}`}
            className="h-full w-full border-0 bg-white"
          />
        )}

        {state === "ready" && kind === "unsupported" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="text-5xl" aria-hidden>
              📄
            </span>
            <p className="max-w-sm text-sm font-semibold text-slate-700">
              Định dạng này chưa hỗ trợ xem nhanh (Excel, Word đời cũ). Vui lòng tải về để mở bằng ứng dụng trên máy.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={download}
                className="rounded-lg bg-[#0A66C2] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                ⬇ Tải về
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
              >
                Quay lại
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Thanh thao tác cho điện thoại */}
      <div className="flex shrink-0 gap-2 border-t border-white/10 bg-slate-900 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden">
        <button
          type="button"
          onClick={openInTab}
          className="flex-1 rounded-lg bg-white/10 py-2.5 text-xs font-bold text-white"
        >
          ↗ Mở tab mới
        </button>
        <button
          type="button"
          onClick={download}
          className="flex-1 rounded-lg bg-white/10 py-2.5 text-xs font-bold text-white"
        >
          ⬇ Tải về
        </button>
      </div>
    </div>
  );
};

/**
 * Liên kết tệp đính kèm: bấm để xem nhanh trong ứng dụng; chuột giữa / Ctrl+bấm
 * vẫn mở tệp ở tab mới như trước.
 */
export const PreviewableLink: React.FC<{
  apiBaseUrl: string;
  file: PreviewableFile;
  className?: string;
  children: React.ReactNode;
}> = ({ apiBaseUrl, file, className, children }) => {
  const [open, setOpen] = useState(false);
  const token = localStorage.getItem("access_token") || "";
  const href = token
    ? authenticatedFileUrl(apiBaseUrl, file.fileUrl, token)
    : file.fileUrl;
  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title="Bấm để xem nhanh"
        className={className}
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </a>
      {open && (
        <FilePreviewModal
          apiBaseUrl={apiBaseUrl}
          file={file}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};
