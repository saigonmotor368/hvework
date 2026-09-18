import { useEffect, useState } from "react";
import { fetchWithSession } from "../api/client";
import { ENABLE_MOCK_DATA } from "../config";
import type { AnnouncementItem } from "../types";

interface Props {
  apiBaseUrl: string;
}

const TYPE_META = {
  news: { icon: "📰", label: "Tin tức", color: "bg-blue-50 text-blue-700" },
  meeting: {
    icon: "📅",
    label: "Lịch họp",
    color: "bg-violet-50 text-violet-700",
  },
  guide: {
    icon: "📘",
    label: "Hướng dẫn",
    color: "bg-emerald-50 text-emerald-700",
  },
};

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function calendarStamp(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function AnnouncementBoard({ apiBaseUrl }: Props) {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selected, setSelected] = useState<AnnouncementItem | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");

  const loadList = async (limit = 3) => {
    const token =
      localStorage.getItem("access_token") ||
      (ENABLE_MOCK_DATA ? "mock-access-token" : null);
    if (!token) return;
    try {
      setError("");
      const response = await fetchWithSession(
        `${apiBaseUrl}/announcements?limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error("Không thể tải bảng thông báo");
      setItems(await response.json());
    } catch {
      setError("Bảng thông báo đang tạm thời chưa tải được.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadList(), 0);
    return () => window.clearTimeout(timer);
  }, [apiBaseUrl]);

  const openDetail = async (item: AnnouncementItem) => {
    const token =
      localStorage.getItem("access_token") ||
      (ENABLE_MOCK_DATA ? "mock-access-token" : null);
    if (!token) return;
    setSelected(item);
    setIsDetailLoading(true);
    try {
      const response = await fetchWithSession(
        `${apiBaseUrl}/announcements/${item.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error();
      setSelected(await response.json());
    } catch {
      setError("Không thể mở nội dung thông báo.");
      setSelected(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const openAll = async () => {
    setShowAll(true);
    setIsLoading(true);
    await loadList(20);
  };

  const downloadCalendar = async (item: AnnouncementItem) => {
    const token =
      localStorage.getItem("access_token") ||
      (ENABLE_MOCK_DATA ? "mock-access-token" : null);
    if (!token) return;
    try {
      const response = await fetchWithSession(
        `${apiBaseUrl}/announcements/${item.id}/calendar.ics`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `hve-work-event-${item.id}.ics`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Không thể tạo tệp lịch. Vui lòng thử lại.");
    }
  };

  const googleCalendarUrl = (item: AnnouncementItem) => {
    if (!item.meetingStartAt) return "#";
    const start = calendarStamp(item.meetingStartAt);
    const fallbackEnd = new Date(
      new Date(item.meetingStartAt).getTime() + 60 * 60 * 1000,
    ).toISOString();
    const end = calendarStamp(item.meetingEndAt || fallbackEnd);
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: item.title,
      dates: `${start}/${end}`,
      details: [item.summary, item.meetingUrl].filter(Boolean).join("\n\n"),
      location: item.location || "",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  if (isLoading && items.length === 0) {
    return (
      <div
        className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
        aria-label="Đang tải bảng thông báo"
      >
        <div className="h-4 w-44 rounded bg-slate-200" />
        <div className="mt-4 h-3 w-3/4 rounded bg-slate-100" />
        <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
      </div>
    );
  }

  if (!isLoading && items.length === 0 && !error) return null;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-amber-50/50 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-blue-100/70 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 sm:text-base">
              <span aria-hidden="true">📢</span> Bảng thông báo HVE
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Thông tin chính thức từ Quản trị IT
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => void openAll()}
                className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0A66C2] hover:bg-blue-100/70"
              >
                Xem tất cả
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed((value) => !value)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-white"
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? "Mở" : "Thu gọn"}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="p-3 sm:p-4">
            {error && (
              <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {error}
              </p>
            )}
            <div className="grid gap-3 lg:grid-cols-3">
              {items.slice(0, 3).map((item, index) => {
                const meta = TYPE_META[item.type] || TYPE_META.news;
                const emphasized =
                  index === 0 && (item.isPinned || item.priority !== "normal");
                return (
                  <article
                    key={item.id}
                    className={`min-w-0 rounded-xl border bg-white p-4 shadow-sm ${emphasized ? "border-amber-200 lg:col-span-3" : "border-slate-200"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-bold ${meta.color}`}
                      >
                        {meta.icon} {meta.label}
                      </span>
                      {item.isPinned && (
                        <span className="text-[11px] font-bold text-amber-700">
                          📌 Đã ghim
                        </span>
                      )}
                      {item.project ? (
                        <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          {item.project.code} · {item.project.name}
                        </span>
                      ) : (
                        <span className="rounded-full bg-cyan-50 px-2 py-1 text-[11px] font-semibold text-cyan-700">
                          Toàn hệ thống
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-sm font-extrabold text-slate-900 sm:text-base">
                      {item.title}
                    </h3>
                    {item.summary && (
                      <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-600">
                        {item.summary}
                      </p>
                    )}
                    {item.type === "meeting" && item.meetingStartAt && (
                      <div className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
                        <p className="font-bold">
                          {formatDate(item.meetingStartAt, true)}
                        </p>
                        {item.location && (
                          <p className="mt-0.5 truncate">📍 {item.location}</p>
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        {formatDate(item.publishedAt)}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {item.type === "meeting" && item.meetingStartAt && (
                          <button
                            type="button"
                            onClick={() => void downloadCalendar(item)}
                            className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100"
                          >
                            Thêm vào lịch
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void openDetail(item)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          Xem chi tiết
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {(selected || showAll) && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
              <h2 className="font-extrabold text-slate-900">
                {selected ? "Chi tiết thông báo" : "Tất cả thông báo"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setShowAll(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl text-slate-500 hover:bg-slate-100"
                aria-label="Đóng"
              >
                ×
              </button>
            </div>
            {selected ? (
              <div className="p-5 sm:p-7">
                {isDetailLoading && (
                  <p className="text-sm text-slate-500">Đang tải nội dung...</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${TYPE_META[selected.type].color}`}
                  >
                    {TYPE_META[selected.type].icon}{" "}
                    {TYPE_META[selected.type].label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {selected.project ? selected.project.name : "Toàn hệ thống"}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-black leading-tight text-slate-900 sm:text-2xl">
                  {selected.title}
                </h3>
                {selected.summary && (
                  <p className="mt-2 font-medium text-slate-600">
                    {selected.summary}
                  </p>
                )}
                {selected.type === "meeting" && selected.meetingStartAt && (
                  <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900">
                    <p className="font-bold">
                      🕒 {formatDate(selected.meetingStartAt, true)}
                      {selected.meetingEndAt
                        ? ` – ${formatDate(selected.meetingEndAt, true)}`
                        : ""}
                    </p>
                    {selected.location && (
                      <p className="mt-1">📍 {selected.location}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={googleCalendarUrl(selected)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white"
                      >
                        Google Calendar
                      </a>
                      <button
                        type="button"
                        onClick={() => void downloadCalendar(selected)}
                        className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-700"
                      >
                        Apple / Outlook (.ics)
                      </button>
                      {selected.meetingUrl && (
                        <a
                          href={selected.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-700"
                        >
                          Mở phòng họp
                        </a>
                      )}
                    </div>
                  </div>
                )}
                <div className="mt-6 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                  {selected.content}
                </div>
                <p className="mt-7 border-t border-slate-100 pt-4 text-xs text-slate-400">
                  Đăng bởi {selected.createdBy?.name || "Quản trị IT"} ·{" "}
                  {formatDate(selected.publishedAt, true)}
                </p>
              </div>
            ) : (
              <div className="space-y-3 p-4 sm:p-6">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openDetail(item)}
                    className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <span>{TYPE_META[item.type].icon}</span>
                      <span>{TYPE_META[item.type].label}</span>
                      <span>·</span>
                      <span>{item.project?.name || "Toàn hệ thống"}</span>
                    </div>
                    <p className="mt-2 font-extrabold text-slate-900">
                      {item.title}
                    </p>
                    {item.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {item.summary}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
