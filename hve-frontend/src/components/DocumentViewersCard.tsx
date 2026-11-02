import React, { useState } from "react";
import { ROLE_LABELS } from "../types";
import type { DocumentItem } from "../types";

const fmt = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "—");

const roleText = (roles: string[]) =>
  roles
    .filter((role) => role !== "employee")
    .map((role) => ROLE_LABELS[role] || role)
    .join(" · ");

export const DocumentViewersCard: React.FC<{ document: DocumentItem; currentUserId?: number }> = ({
  document,
  currentUserId,
}) => {
  const [expanded, setExpanded] = useState(false);
  const viewers = document.viewers || [];
  const board = document.boardViewers || [];
  if (!document.viewers && !document.boardViewers) return null;

  const shown = expanded ? viewers : viewers.slice(0, 5);
  const boardSeen = board.filter((member) => member.seen).length;

  return (
    <section className="mt-6 border-t border-slate-100 pt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
          👁 Người đã xem hồ sơ ({viewers.length})
        </span>
        {board.length > 0 && (
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
              boardSeen === board.length ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            Ban Giám đốc đã xem {boardSeen}/{board.length}
          </span>
        )}
      </div>

      {board.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {board.map((member) => (
            <span
              key={member.userId}
              title={member.seen ? `Xem lần gần nhất: ${fmt(member.lastViewedAt)}` : "Chưa mở hồ sơ này"}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                member.seen
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <span aria-hidden>{member.seen ? "✓" : "○"}</span>
              {member.name}
              <span className="font-medium opacity-80">
                {member.seen ? `· ${fmt(member.lastViewedAt)}` : "· chưa xem"}
              </span>
            </span>
          ))}
        </div>
      )}

      {viewers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">
          Chưa có ai mở hồ sơ này.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <ul className="divide-y divide-slate-100 text-xs">
            {shown.map((viewer) => (
              <li key={viewer.userId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3.5 py-2.5">
                <div className="min-w-0">
                  <span className="font-bold text-slate-800">
                    {viewer.name}
                    {viewer.userId === currentUserId ? " (bạn)" : ""}
                  </span>
                  {roleText(viewer.roles) && (
                    <span className="ml-2 text-[11px] text-slate-500">{roleText(viewer.roles)}</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  Xem lần đầu {fmt(viewer.firstViewedAt)}
                  {viewer.viewCount > 1 ? ` · gần nhất ${fmt(viewer.lastViewedAt)} · ${viewer.viewCount} lượt` : ""}
                </div>
              </li>
            ))}
          </ul>
          {viewers.length > 5 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="w-full border-t border-slate-100 bg-slate-50 px-3.5 py-2 text-[11px] font-bold text-[#0A66C2] hover:bg-slate-100"
            >
              {expanded ? "Thu gọn" : `Xem tất cả ${viewers.length} người`}
            </button>
          )}
        </div>
      )}
    </section>
  );
};
