import { useEffect, useState } from "react";
import { fetchWithSession } from "../api/client";
import type { AdminUser, ProjectHealthItem, ProjectItem } from "../types";
import { UserNameButton } from "./UserNameButton";

interface Props {
  apiBaseUrl: string;
  showToast: (message: string, type?: "success" | "error") => void;
}

const emptyForm = {
  code: "",
  name: "",
  location: "",
  leadUserId: "",
  memberIds: [] as number[],
  isActive: true,
};

export function AdminProjectsView({ apiBaseUrl, showToast }: Props) {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projectHealth, setProjectHealth] = useState<ProjectHealthItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("access_token");
  const load = async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const [projectRes, userRes, healthRes] = await Promise.all([
      fetchWithSession(`${apiBaseUrl}/projects/admin`, { headers }),
      fetchWithSession(`${apiBaseUrl}/admin/users`, { headers }),
      fetchWithSession(`${apiBaseUrl}/dashboard/project-health`, { headers }),
    ]);
    if (!projectRes.ok || !userRes.ok)
      throw new Error("Không thể tải dữ liệu dự án");
    setProjects(await projectRes.json());
    setUsers(await userRes.json());
    if (healthRes.ok) setProjectHealth(await healthRes.json());
  };

  useEffect(() => {
    load().catch((error) => showToast(error.message, "error"));
  }, []);

  const edit = (project: ProjectItem) => {
    setEditingId(project.id);
    setForm({
      code: project.code,
      name: project.name,
      location: project.location || "",
      leadUserId: project.leadUserId ? String(project.leadUserId) : "",
      memberIds:
        project.members
          ?.map((member) => member.userId)
          .filter((userId) => userId !== project.leadUserId) || [],
      isActive: project.isActive,
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetchWithSession(
        `${apiBaseUrl}/projects${editingId ? `/${editingId}` : ""}`,
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...form,
            leadUserId: form.leadUserId ? Number(form.leadUserId) : undefined,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Không thể lưu dự án");
      showToast(editingId ? "Đã cập nhật dự án." : "Đã tạo dự án mới.");
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
  });

  const fetchUsage = async (projectId: number) => {
    const res = await fetchWithSession(`${apiBaseUrl}/projects/${projectId}/usage`, { headers: authHeaders() });
    return res.ok ? res.json() : null;
  };

  const setActive = async (project: ProjectItem, isActive: boolean) => {
    if (isActive) {
      if (!window.confirm(`Kích hoạt lại dự án “${project.name}”?`)) return;
    } else {
      const usage = await fetchUsage(project.id);
      const warning = usage
        ? `\n\nHiện còn ${usage.openTasks} công việc đang mở và ${usage.pendingDocuments} hồ sơ chờ duyệt.`
        : "";
      if (
        !window.confirm(
          `Đánh dấu dự án “${project.name}” đã hoàn thành / lưu trữ?\nDự án sẽ không còn xuất hiện khi tạo hồ sơ hoặc giao việc mới, nhưng toàn bộ lịch sử vẫn được giữ.${warning}`,
        )
      ) {
        return;
      }
    }
    try {
      const res = await fetchWithSession(`${apiBaseUrl}/projects/${project.id}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ isActive }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Không cập nhật được trạng thái dự án");
      showToast(isActive ? "Đã kích hoạt lại dự án." : "Đã đánh dấu dự án hoàn thành / lưu trữ.");
      if (editingId === project.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await load();
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const removeProject = async (project: ProjectItem) => {
    const usage = await fetchUsage(project.id);
    if (usage && !usage.canDelete) {
      showToast(
        `Dự án đã có dữ liệu (${usage.documents} hồ sơ, ${usage.tasks} công việc, ${usage.reports} báo cáo) nên không thể xóa. Hãy chọn “Hoàn thành / lưu trữ”.`,
        "error",
      );
      return;
    }
    if (!window.confirm(`Xóa vĩnh viễn dự án “${project.name}” (${project.code})? Thao tác này không hoàn tác được.`)) return;
    try {
      const res = await fetchWithSession(`${apiBaseUrl}/projects/${project.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Không xóa được dự án");
      showToast("Đã xóa dự án.");
      if (editingId === project.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await load();
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-bold text-slate-900">Danh sách dự án</h3>
          <p className="mt-1 text-xs text-slate-500">
            Phạm vi dự án quyết định dữ liệu Trưởng dự án được xem và xử lý.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`flex w-full flex-col gap-3 px-5 py-4 text-left sm:flex-row sm:items-start sm:justify-between ${project.isActive ? "" : "bg-slate-50/70"} ${editingId === project.id ? "ring-2 ring-inset ring-blue-200" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-[#0A66C2]">
                    {project.code}
                  </span>
                  <strong className="text-sm text-slate-900">
                    {project.name}
                  </strong>
                  {(() => {
                    const health = projectHealth.find(
                      (item) => item.id === project.id,
                    );
                    if (!health) return null;
                    const label =
                      health.level === "rui_ro_cao"
                        ? "🔴 Rủi ro cao"
                        : health.level === "tre_tien_do"
                          ? "🟠 Trễ tiến độ"
                          : health.level === "can_chu_y"
                            ? "🟡 Cần chú ý"
                            : "🟢 Bình thường";
                    return (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {label} · {health.percent}%
                      </span>
                    );
                  })()}
                  {!project.isActive && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                      ✅ Đã hoàn thành / lưu trữ
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Trưởng dự án:{" "}
                  <UserNameButton
                    user={project.lead}
                    fallback="Chưa chỉ định"
                  />{" "}
                  · {project.members?.length || 0} thành viên
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    edit(project);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0A66C2] hover:bg-blue-100"
                >
                  ✏️ Sửa
                </button>
                <button
                  type="button"
                  onClick={() => void setActive(project, !project.isActive)}
                  className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  {project.isActive ? "✅ Hoàn thành" : "↩ Kích hoạt lại"}
                </button>
                <button
                  type="button"
                  onClick={() => void removeProject(project)}
                  className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                >
                  🗑 Xóa
                </button>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">
              Chưa có dự án.
            </p>
          )}
        </div>
      </section>

      <form
        onSubmit={save}
        className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900">
            {editingId ? "Cập nhật dự án" : "Tạo dự án"}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="text-xs font-semibold text-slate-500"
            >
              Tạo mới
            </button>
          )}
        </div>
        <input
          required
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="Mã dự án, VD: HVE-2026"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Tên dự án"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <input
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="Địa điểm (tùy chọn)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <select
          value={form.leadUserId}
          onChange={(e) =>
            setForm({
              ...form,
              leadUserId: e.target.value,
              memberIds: form.memberIds.filter(
                (id) => id !== Number(e.target.value),
              ),
            })
          }
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">-- Chọn Trưởng dự án --</option>
          {users
            .filter((user) => user.status === "active")
            .map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} — {user.email}
              </option>
            ))}
        </select>
        <p className="-mt-3 text-[11px] text-blue-600">
          Người được chọn sẽ tự động có vai trò Trưởng Ban / Trưởng dự án.
        </p>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
            Thành viên
          </label>
          <select
            multiple
            value={form.memberIds.map(String)}
            onChange={(e) =>
              setForm({
                ...form,
                memberIds: Array.from(e.target.selectedOptions).map((option) =>
                  Number(option.value),
                ),
              })
            }
            className="min-h-36 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            {users
              .filter(
                (user) =>
                  user.status === "active" &&
                  String(user.id) !== form.leadUserId,
              )
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} — {user.email}
                </option>
              ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-400">
            Giữ Ctrl/Cmd để chọn nhiều thành viên.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />{" "}
          Dự án đang hoạt động (bỏ chọn khi dự án đã hoàn thành)
        </label>
        <button
          disabled={saving}
          className="w-full rounded-xl bg-[#0A66C2] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo dự án"}
        </button>
      </form>
    </div>
  );
}
