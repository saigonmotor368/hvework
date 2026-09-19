import React, { useRef } from "react";

interface MultiFilePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSizeMb?: number;
  accept?: string;
  hint?: string;
  onError?: (message: string) => void;
}

const fileKey = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`;

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const MultiFilePicker: React.FC<MultiFilePickerProps> = ({
  files,
  onChange,
  disabled = false,
  maxFiles = 10,
  maxSizeMb = 10,
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp",
  hint,
  onError,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const appendFiles = (incoming: File[]) => {
    const oversized = incoming.find(
      (file) => file.size > maxSizeMb * 1024 * 1024,
    );
    if (oversized) {
      onError?.(`Tệp “${oversized.name}” vượt quá ${maxSizeMb}MB.`);
      return;
    }

    const next = [...files];
    const known = new Set(next.map(fileKey));
    incoming.forEach((file) => {
      if (!known.has(fileKey(file))) {
        next.push(file);
        known.add(fileKey(file));
      }
    });

    if (next.length > maxFiles) {
      onError?.(`Mỗi lần chỉ được đính kèm tối đa ${maxFiles} tệp.`);
      return;
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          appendFiles(Array.from(event.target.files || []));
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled || files.length >= maxFiles}
        onClick={() => inputRef.current?.click()}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-bold text-[#0A66C2] transition hover:border-blue-500 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <span aria-hidden="true">📎</span>
        Chọn tệp đính kèm
      </button>

      {files.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          {files.map((file, index) => (
            <div
              key={fileKey(file)}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
            >
              <span className="shrink-0 text-lg" aria-hidden="true">
                📄
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-700">
                  {file.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {formatSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={`Bỏ tệp ${file.name}`}
                title="Bỏ tệp"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-400">
        {hint ||
          `PDF, Word, Excel, JPG, PNG hoặc WEBP; tối đa ${maxSizeMb}MB mỗi tệp, ${maxFiles} tệp.`}
      </p>
    </div>
  );
};
