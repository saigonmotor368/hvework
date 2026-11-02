import React from "react";
import type { DocumentItem } from "../types";
import { UserAvatar } from "./UserAvatar";

const fmt = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "—");

export const DocumentViewersCard: React.FC<{
  document: DocumentItem;
  currentUserId?: number;
  apiBaseUrl: string;
}> = ({ document, currentUserId, apiBaseUrl }) => {
  if (!document.viewers) return null;
  const viewers = document.viewers;

  return (
    <section className="mt-6 border-t border-slate-100 pt-6">
      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
        👁️ Người đã xem ({viewers.length})
      </span>
      {viewers.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">Chưa có ai xem hồ sơ này.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {viewers.map((viewer) => (
            <span
              key={viewer.userId}
              title={`${viewer.name}\nXem lần đầu: ${fmt(viewer.firstViewedAt)}\nGần nhất: ${fmt(viewer.lastViewedAt)}${viewer.viewCount > 1 ? ` (${viewer.viewCount} lượt)` : ""}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 text-xs font-semibold text-slate-700"
            >
              <UserAvatar user={viewer} apiBaseUrl={apiBaseUrl} className="h-6 w-6 rounded-full text-[9px]" />
              {viewer.name}
              {viewer.userId === currentUserId ? " (bạn)" : ""}
            </span>
          ))}
        </div>
      )}
    </section>
  );
};
