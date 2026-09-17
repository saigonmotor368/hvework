import React from 'react';

interface BrandLoaderProps {
  label?: string;
  compact?: boolean;
  className?: string;
}

export const BrandLoader: React.FC<BrandLoaderProps> = ({
  label = 'Đang tải dữ liệu...',
  compact = false,
  className = '',
}) => (
  <div
    className={`brand-loader flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-20'} ${className}`}
    role="status"
    aria-live="polite"
  >
    <div className={`brand-loader__mark ${compact ? 'h-14 w-14' : 'h-20 w-20'}`}>
      <span className="brand-loader__halo" aria-hidden="true" />
      <img
        src="/hve-logo-transparent.svg"
        alt=""
        className="brand-loader__logo"
        draggable={false}
      />
    </div>
    <p className={`font-semibold text-slate-600 ${compact ? 'mt-3 text-xs' : 'mt-5 text-sm'}`}>
      {label}
    </p>
    <span className="brand-loader__dots mt-2" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  </div>
);
