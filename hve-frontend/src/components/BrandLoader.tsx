import React from "react";

interface BrandLoaderProps {
  label?: string;
  compact?: boolean;
  className?: string;
}

export const BrandLoader: React.FC<BrandLoaderProps> = ({
  label = "Đang tải dữ liệu...",
  compact = false,
  className = "",
}) => (
  <div
    className={`brand-loader ${compact ? "brand-loader--compact py-8" : "brand-loader--splash min-h-[min(70vh,42rem)] rounded-[2rem] py-16"} flex flex-col items-center justify-center text-center ${className}`}
    role="status"
    aria-live="polite"
  >
    <div
      className={`brand-loader__mark ${compact ? "h-14 w-14" : "h-36 w-36 sm:h-44 sm:w-44"}`}
    >
      <span className="brand-loader__halo" aria-hidden="true" />
      <img
        src={compact ? "/hve-logo-transparent.svg" : "/hve-logo-loader.svg"}
        alt=""
        className="brand-loader__logo"
        draggable={false}
      />
    </div>
    <p
      className={`font-semibold ${compact ? "mt-3 text-xs text-slate-600" : "mt-6 text-sm text-white/90"}`}
    >
      {label}
    </p>
    <span className="brand-loader__dots mt-2" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  </div>
);
