import React from "react";

interface BrandLoaderProps {
  label?: string;
  compact?: boolean;
  variant?: "inline" | "splash";
  className?: string;
}

export const BrandLoader: React.FC<BrandLoaderProps> = ({
  label = "Đang tải dữ liệu...",
  compact = false,
  variant = "inline",
  className = "",
}) => {
  const isSplash = variant === "splash";
  const containerClass = isSplash
    ? "brand-loader--splash min-h-[100dvh] w-full py-16"
    : compact
      ? "brand-loader--inline brand-loader--compact min-h-28 rounded-xl bg-white py-6"
      : "brand-loader--inline min-h-48 rounded-2xl border border-slate-200/70 bg-white py-10 shadow-sm";
  const markClass = isSplash
    ? "h-36 w-36 sm:h-44 sm:w-44"
    : compact
      ? "h-11 w-11"
      : "h-14 w-14 sm:h-16 sm:w-16";

  return (
    <div
      className={`brand-loader ${containerClass} flex flex-col items-center justify-center text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className={`brand-loader__mark ${markClass}`}>
        <span className="brand-loader__halo" aria-hidden="true" />
        <img
          src={isSplash ? "/hve-logo-loader.svg" : "/hve-logo-transparent.svg"}
          alt=""
          className="brand-loader__logo"
          draggable={false}
        />
      </div>
      <p
        className={`font-semibold ${isSplash ? "mt-6 text-sm text-white/90" : "mt-3 text-xs text-slate-600"}`}
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
};
