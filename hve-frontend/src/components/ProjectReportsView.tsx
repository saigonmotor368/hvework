import { useCallback, useEffect, useMemo, useState } from "react";
import {
  authenticatedFileUrl,
  fetchWithSession,
  uploadAttachment,
} from "../api/client";
import type { ProjectItem, ProjectReportItem } from "../types";
import { BrandLoader } from "./BrandLoader";
import { MultiFilePicker } from "./MultiFilePicker";
import { UserNameButton } from "./UserNameButton";

interface Props {
  apiBaseUrl: string;
  currentUser: any;
  projects: ProjectItem[];
  showToast: (message: string, type?: "success" | "error") => void;
}

interface ViewerOption {
  id: number;
  name: string;
  email: string;
}

const STATUS = {
  draft: { label: "Bản nháp", className: "bg-slate-100 text-slate-700" },
  submitted: {
    label: "Đã nộp · Chờ duyệt",
    className: "bg-blue-100 text-blue-800",
  },
  approved: { label: "Đã duyệt", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Cần làm lại", className: "bg-rose-100 text-rose-800" },
} as const;

const emptyForm = {
  title: "",
  content: "",
  periodStart: "",
  periodEnd: "",
  projectId: "",
  viewerIds: [] as number[],
  files: [] as File[],
};

const dateValue = (value?: string | null) => (value ? value.slice(0, 10) : "");

export const ProjectReportsView: React.FC<Props> = ({
  apiBaseUrl,
  currentUser,
  projects,
  showToast,
}) => {
  const [reports, setReports] = useState<ProjectReportItem[]>([]);
  const [viewers, setViewers] = useState<ViewerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("all");
  const [projectId, setProjectId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProjectReportItem | null>(null);
  const [editing, setEditing] = useState<ProjectReportItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [reviewComment, setReviewComment] = useState("");

  const token = localStorage.getItem("access_token") || "";
  const roleNames = (currentUser?.roles || []).map((role: any) =>
    typeof role === "string" ? role : role.name,
  );
  const isItAdmin = roleNames.includes("it_admin");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (projectId) params.set("projectId", projectId);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetchWithSession(
        `${apiBaseUrl}/project-reports?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error("Không thể tải báo cáo dự án");
      const data = await response.json();
      setReports(data);
      const directId = Number(
        new URLSearchParams(window.location.search).get("id"),
      );
      if (directId > 0) {
        const direct = data.find(
          (item: ProjectReportItem) => item.id === directId,
        );
        if (direct) setSelected(direct);
      }
    } catch (error: any) {
      showToast(error.message || "Không thể tải báo cáo dự án", "error");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, projectId, search, showToast, status, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    fetchWithSession(`${apiBaseUrl}/project-reports/viewers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (response.ok) setViewers(await response.json());
      })
      .catch(() => undefined);
  }, [apiBaseUrl, token]);

  const viewerOptions = useMemo(
    () => viewers.filter((viewer) => viewer.id !== currentUser?.id),
    [currentUser?.id, viewers],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, viewerIds: [], files: [] });
    setFormOpen(true);
  };

  const openEdit = (report: ProjectReportItem) => {
    setEditing(report);
    setForm({
      title: report.title,
      content: report.content,
      periodStart: dateValue(report.periodStart),
      periodEnd: dateValue(report.periodEnd),
      projectId: report.projectId ? String(report.projectId) : "",
      viewerIds: report.viewers.map((viewer) => viewer.userId),
      files: [],
    });
    setSelected(null);
    setFormOpen(true);
  };

  const save = async (submitNow: boolean) => {
    if (!form.title.trim() || !form.content.trim()) {
      showToast("Vui lòng nhập tiêu đề và nội dung báo cáo", "error");
      return;
    }
    if (
      form.periodStart &&
      form.periodEnd &&
      form.periodEnd < form.periodStart
    ) {
      showToast("Ngày kết thúc không được trước ngày bắt đầu", "error");
      return;
    }
    setSaving(true);
    try {
      const attachmentIds: number[] = [];
      for (const file of form.files) {
        attachmentIds.push(await uploadAttachment(apiBaseUrl, token, file));
      }
      const response = await fetchWithSession(
        `${apiBaseUrl}/project-reports${editing ? `/${editing.id}` : ""}`,
        {
          method: editing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: form.title.trim(),
            content: form.content.trim(),
            periodStart: form.periodStart || undefined,
            periodEnd: form.periodEnd || undefined,
            projectId: form.projectId ? Number(form.projectId) : undefined,
            viewerIds: form.viewerIds,
            attachmentIds,
          }),
        },
      );
      const saved = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(saved.message || "Không thể lưu báo cáo");
      if (submitNow) {
        const submitResponse = await fetchWithSession(
          `${apiBaseUrl}/project-reports/${saved.id}/submit`,
          { method: "POST", headers: { Authorization: `Bearer ${token}` } },
        );
        const submitted = await submitResponse.json().catch(() => ({}));
        if (!submitResponse.ok) {
          throw new Error(
            submitted.message || "Đã lưu nhưng chưa thể nộp báo cáo",
          );
        }
      }
      showToast(
        submitNow
          ? "Đã nộp báo cáo để duyệt"
          : editing?.status === "submitted"
            ? "Đã cập nhật báo cáo đang chờ duyệt"
            : "Đã lưu thay đổi báo cáo",
      );
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error: any) {
      showToast(error.message || "Không thể lưu báo cáo", "error");
    } finally {
      setSaving(false);
    }
  };

  const submitExisting = async (report: ProjectReportItem) => {
    setSaving(true);
    try {
      const response = await fetchWithSession(
        `${apiBaseUrl}/project-reports/${report.id}/submit`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.message || "Không thể nộp báo cáo");
      showToast("Đã nộp báo cáo để duyệt");
      setSelected(body);
      await load();
    } catch (error: any) {
      showToast(error.message || "Không thể nộp báo cáo", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (report: ProjectReportItem) => {
    const forceDelete =
      isItAdmin &&
      (report.authorId !== currentUser?.id || report.status === "approved");
    if (
      !window.confirm(
        forceDelete
          ? `Quản trị IT xóa cưỡng chế báo cáo “${report.title}” (${STATUS[report.status].label})? Hành động sẽ được ghi vào nhật ký và không thể hoàn tác.`
          : `Xóa báo cáo “${report.title}”? Thao tác này không thể hoàn tác.`,
      )
    )
      return;
    setSaving(true);
    try {
      const response = await fetchWithSession(
        `${apiBaseUrl}/project-reports/${report.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Không thể xóa báo cáo");
      }
      setSelected(null);
      showToast(forceDelete ? "IT đã xóa cưỡng chế báo cáo" : "Đã xóa báo cáo");
      await load();
    } catch (error: any) {
      showToast(error.message || "Không thể xóa báo cáo", "error");
    } finally {
      setSaving(false);
    }
  };

  const review = async (action: "approve" | "reject") => {
    if (!selected) return;
    if (action === "reject" && !reviewComment.trim()) {
      showToast("Vui lòng ghi rõ nội dung cần làm lại", "error");
      return;
    }
    setSaving(true);
    try {
      const response = await fetchWithSession(
        `${apiBaseUrl}/project-reports/${selected.id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action,
            comment: reviewComment.trim() || undefined,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.message || "Không thể xử lý báo cáo");
      setSelected(body);
      setReviewComment("");
      showToast(
        action === "approve"
          ? "Đã phê duyệt báo cáo"
          : "Đã gửi yêu cầu làm lại",
      );
      await load();
    } catch (error: any) {
      showToast(error.message || "Không thể xử lý báo cáo", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <BrandLoader label="Đang tải báo cáo dự án..." />;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-700 to-indigo-700 p-4 text-white shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-100">
              Theo dõi · lưu trữ · phê duyệt
            </p>
            <h3 className="mt-1 text-xl font-black sm:text-2xl">
              Báo cáo dự án
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-blue-100 sm:text-sm">
              Nộp báo cáo định kỳ, chỉ định người đọc và theo dõi phản hồi trên
              một phiên bản thống nhất.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="min-h-11 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-blue-700 shadow-sm hover:bg-blue-50"
          >
            ＋ Tạo báo cáo
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-3 sm:p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm mã, tiêu đề, nội dung..."
          className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
        >
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS).map(([key, item]) => (
            <option key={key} value={key}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
        >
          <option value="">Tất cả dự án</option>
          {projects
            .filter((project) => project.isActive)
            .map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
        </select>
      </section>

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-14 text-center text-sm text-slate-500">
          Chưa có báo cáo phù hợp bộ lọc.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {reports.map((report) => {
            const statusItem = STATUS[report.status];
            return (
              <button
                key={report.id}
                onClick={() => {
                  setSelected(report);
                  setReviewComment("");
                }}
                className="grid min-h-[76px] w-full min-w-0 grid-cols-1 gap-2 px-3 py-3 text-left transition hover:bg-blue-50/60 focus:bg-blue-50 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.45fr)_auto] sm:items-center sm:gap-4 sm:px-4"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                      {report.code} · v{report.revision}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold sm:hidden ${statusItem.className}`}
                    >
                      {statusItem.label}
                    </span>
                  </div>
                  <h4 className="mt-0.5 truncate text-sm font-black text-slate-900 sm:text-base">
                    {report.title}
                  </h4>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                    {report.content}
                  </p>
                </div>
                <div className="min-w-0 text-[11px] text-slate-500">
                  <p className="truncate font-semibold text-slate-700">
                    🏗️{" "}
                    {report.project
                      ? `${report.project.code} — ${report.project.name}`
                      : "Huy Võ Education"}
                  </p>
                  <p className="mt-1 truncate">
                    👤 <UserNameButton user={report.author} />
                    <span className="mx-1.5 text-slate-300">·</span>
                    📎 {report.attachments?.length || 0} tệp
                  </p>
                </div>
                <div className="hidden justify-self-end text-right sm:block">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusItem.className}`}
                  >
                    {statusItem.label}
                  </span>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(report.updatedAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="mobile-scroll flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
              <div>
                <h3 className="text-lg font-black">
                  {editing ? "Chỉnh sửa báo cáo" : "Tạo báo cáo dự án"}
                </h3>
                <p className="text-xs text-slate-500">
                  Báo cáo đã duyệt sẽ được khóa để bảo toàn nội dung.
                </p>
              </div>
              <button
                onClick={() => setFormOpen(false)}
                className="h-10 w-10 rounded-full text-xl text-slate-400 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 p-4 sm:p-6">
              <div>
                <label className="text-xs font-bold uppercase text-slate-600">
                  Tiêu đề *
                </label>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  placeholder="VD: Báo cáo vận hành tuần 38"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-600">
                    Dự án
                  </label>
                  <select
                    value={form.projectId}
                    onChange={(event) =>
                      setForm({ ...form, projectId: event.target.value })
                    }
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  >
                    <option value="">Huy Võ Education</option>
                    {projects
                      .filter((project) => project.isActive)
                      .map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.code} — {project.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-slate-600">
                    Từ ngày
                  </label>
                  <input
                    type="date"
                    value={form.periodStart}
                    onChange={(event) =>
                      setForm({ ...form, periodStart: event.target.value })
                    }
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-slate-600">
                    Đến ngày
                  </label>
                  <input
                    type="date"
                    value={form.periodEnd}
                    onChange={(event) =>
                      setForm({ ...form, periodEnd: event.target.value })
                    }
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-600">
                  Nội dung báo cáo *
                </label>
                <textarea
                  rows={9}
                  value={form.content}
                  onChange={(event) =>
                    setForm({ ...form, content: event.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm leading-relaxed"
                  placeholder={
                    "1. Kết quả đã thực hiện\n2. Vấn đề tồn tại\n3. Kế hoạch tiếp theo\n4. Kiến nghị/hỗ trợ cần thiết"
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-600">
                  Chỉ định người xem ({form.viewerIds.length})
                </label>
                <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {viewerOptions.map((viewer) => {
                    const active = form.viewerIds.includes(viewer.id);
                    return (
                      <button
                        key={viewer.id}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            viewerIds: active
                              ? form.viewerIds.filter((id) => id !== viewer.id)
                              : [...form.viewerIds, viewer.id],
                          })
                        }
                        className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-xs ${active ? "bg-blue-600 font-bold text-white" : "bg-white text-slate-700 hover:bg-blue-50"}`}
                      >
                        <span className="truncate">
                          {viewer.name} · {viewer.email}
                        </span>
                        <span>{active ? "✓" : "+"}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  CEO/BGĐ và Trưởng dự án luôn có quyền xem, không cần chọn
                  thêm.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-600">
                  Tệp minh chứng
                </label>
                <div className="mt-2">
                  <MultiFilePicker
                    files={form.files}
                    disabled={saving}
                    onChange={(files) => setForm({ ...form, files })}
                    onError={(message) => showToast(message, "error")}
                  />
                </div>
                {editing && (editing.attachments?.length || 0) > 0 && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Các tệp đã lưu trước đó vẫn được giữ nguyên; danh sách trên
                    là tệp bổ sung.
                  </p>
                )}
              </div>
            </div>
            <div className="sticky bottom-0 grid grid-cols-1 gap-2 border-t border-slate-100 bg-white p-4 sm:flex sm:justify-end">
              <button
                disabled={saving}
                onClick={() => setFormOpen(false)}
                className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600"
              >
                Hủy
              </button>
              <button
                disabled={saving}
                onClick={() => void save(false)}
                className="min-h-11 rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-700"
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
              {(!editing || editing.permissions.canSubmit) && (
                <button
                  disabled={saving}
                  onClick={() => void save(true)}
                  className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-black text-white"
                >
                  {saving ? "Đang xử lý..." : "Lưu & nộp báo cáo"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="mobile-scroll max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  {selected.code} · Phiên bản {selected.revision}
                </p>
                <h3 className="mt-1 break-words text-lg font-black">
                  {selected.title}
                </h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="h-10 w-10 shrink-0 rounded-full text-xl text-slate-400 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="space-y-5 p-4 sm:p-6">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS[selected.status].className}`}
                >
                  {STATUS[selected.status].label}
                </span>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                  🏗️{" "}
                  {selected.project
                    ? `${selected.project.code} — ${selected.project.name}`
                    : "Huy Võ Education"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                <p>
                  <strong>Người lập:</strong>{" "}
                  <UserNameButton user={selected.author} />
                </p>
                <p>
                  <strong>Kỳ báo cáo:</strong>{" "}
                  {selected.periodStart || selected.periodEnd
                    ? `${selected.periodStart ? new Date(selected.periodStart).toLocaleDateString("vi-VN") : "…"} – ${selected.periodEnd ? new Date(selected.periodEnd).toLocaleDateString("vi-VN") : "…"}`
                    : "Không giới hạn"}
                </p>
                <p className="sm:col-span-2">
                  <strong>Người được chỉ định:</strong>{" "}
                  {selected.viewers.length
                    ? selected.viewers
                        .map((viewer) => viewer.user.name)
                        .join(", ")
                    : "Không chỉ định riêng"}
                </p>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">
                  Nội dung
                </h4>
                <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                  {selected.content}
                </div>
              </div>
              {(selected.attachments?.length || 0) > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">
                    Tệp đính kèm ({selected.attachments?.length})
                  </h4>
                  <div className="space-y-2">
                    {selected.attachments?.map((file) => (
                      <a
                        key={file.id}
                        href={authenticatedFileUrl(
                          apiBaseUrl,
                          file.fileUrl,
                          token,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        <span>📎</span>
                        <span className="min-w-0 flex-1 truncate">
                          {file.fileName}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {selected.reviewedBy && (
                <div
                  className={`rounded-xl border p-4 text-sm ${selected.status === "approved" ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}
                >
                  <p className="font-bold">
                    {selected.status === "approved"
                      ? "Đã được phê duyệt"
                      : "Yêu cầu làm lại"}{" "}
                    bởi <UserNameButton user={selected.reviewedBy} />
                  </p>
                  {selected.reviewComment && (
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">
                      {selected.reviewComment}
                    </p>
                  )}
                </div>
              )}
              {selected.permissions.canReview && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <label className="text-xs font-bold uppercase text-blue-800">
                    Nhận xét duyệt
                  </label>
                  <textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="Ghi nhận xét; bắt buộc khi yêu cầu làm lại..."
                    className="mt-2 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm"
                  />
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      disabled={saving}
                      onClick={() => void review("reject")}
                      className="min-h-11 rounded-xl border border-rose-300 bg-white text-sm font-bold text-rose-700"
                    >
                      ↩ Yêu cầu làm lại
                    </button>
                    <button
                      disabled={saving}
                      onClick={() => void review("approve")}
                      className="min-h-11 rounded-xl bg-emerald-600 text-sm font-black text-white"
                    >
                      ✓ Phê duyệt báo cáo
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white p-4">
              {selected.permissions.canDelete && (
                <button
                  disabled={saving}
                  onClick={() => void remove(selected)}
                  className="min-h-10 rounded-xl px-4 text-sm font-bold text-rose-600 hover:bg-rose-50"
                >
                  {isItAdmin &&
                  (selected.authorId !== currentUser?.id ||
                    selected.status === "approved")
                    ? "Xóa cưỡng chế (IT)"
                    : "Xóa"}
                </button>
              )}
              {selected.permissions.canEdit && (
                <button
                  disabled={saving}
                  onClick={() => openEdit(selected)}
                  className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"
                >
                  Chỉnh sửa
                </button>
              )}
              {selected.permissions.canSubmit && (
                <button
                  disabled={saving}
                  onClick={() => void submitExisting(selected)}
                  className="min-h-10 rounded-xl bg-blue-600 px-5 text-sm font-black text-white"
                >
                  Nộp báo cáo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
