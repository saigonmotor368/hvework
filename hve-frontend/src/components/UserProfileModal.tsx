import React, { useEffect, useMemo, useState } from "react";
import { fetchWithSession, uploadUserAvatar } from "../api/client";
import { ROLE_LABELS } from "../types";
import { BrandLoader } from "./BrandLoader";
import { UserAvatar } from "./UserAvatar";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status: string;
  department?: { id: number; code: string; name: string } | null;
  roles: Array<{ id: number; name: string; description?: string | null }>;
  ledProjects: Array<{
    id: number;
    code: string;
    name: string;
    location?: string | null;
  }>;
  projectMemberships: Array<{
    position?: string | null;
    project: {
      id: number;
      code: string;
      name: string;
      location?: string | null;
    };
  }>;
}

export const UserProfileModal: React.FC<{
  apiBaseUrl: string;
  currentUser?: { id?: number; avatarUrl?: string | null } | null;
  onCurrentUserUpdated?: (user: any) => void;
  showToast?: (message: string, type?: "success" | "error") => void;
}> = ({ apiBaseUrl, currentUser, onCurrentUserUpdated, showToast }) => {
  const [userId, setUserId] = useState<number | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const id = Number((event as CustomEvent<{ id?: number }>).detail?.id);
      if (Number.isInteger(id) && id > 0) {
        setProfile(null);
        setError("");
        setUserId(id);
      }
    };
    window.addEventListener("hve-open-user-profile", handleOpen);
    return () =>
      window.removeEventListener("hve-open-user-profile", handleOpen);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const controller = new AbortController();
    fetchWithSession(`${apiBaseUrl}/users/${userId}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.message || "Không thể tải hồ sơ người dùng");
        setProfile(body);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") {
          setError(reason?.message || "Không thể tải hồ sơ người dùng");
        }
      });
    return () => controller.abort();
  }, [apiBaseUrl, userId]);

  const assignedProjects = useMemo(() => {
    if (!profile) return [];
    const projects = new Map<
      number,
      { id: number; code: string; name: string }
    >();
    profile.ledProjects.forEach((project) => projects.set(project.id, project));
    profile.projectMemberships.forEach(({ project }) =>
      projects.set(project.id, project),
    );
    return [...projects.values()];
  }, [profile]);

  if (!userId) return null;

  const handleAvatarUpload = async (file?: File) => {
    if (!file || !profile || currentUser?.id !== profile.id) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;
    setIsUploadingAvatar(true);
    try {
      const updated = await uploadUserAvatar(apiBaseUrl, token, file);
      const nextProfile = { ...profile, avatarUrl: updated.avatarUrl };
      setProfile(nextProfile);
      const nextCurrentUser = { ...currentUser, avatarUrl: updated.avatarUrl };
      localStorage.setItem("user", JSON.stringify(nextCurrentUser));
      onCurrentUserUpdated?.(nextCurrentUser);
      showToast?.("Đã cập nhật ảnh đại diện.");
    } catch (reason: any) {
      showToast?.(reason?.message || "Không thể cập nhật ảnh đại diện", "error");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setUserId(null);
      }}
    >
      <section className="mobile-scroll max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/70 bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0757a6] via-[#0A66C2] to-violet-600 px-5 pb-6 pt-5 text-white sm:px-7">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/10" />
          <button
            type="button"
            onClick={() => setUserId(null)}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg hover:bg-white/25"
            aria-label="Đóng hồ sơ"
          >
            ✕
          </button>
          {profile && (
            <div className="relative flex items-center gap-4 pr-10">
              <div className="relative shrink-0">
                <UserAvatar
                  user={profile}
                  apiBaseUrl={apiBaseUrl}
                  className="h-16 w-16 rounded-2xl border-2 border-white/40 shadow-lg"
                />
                {currentUser?.id === profile.id && (
                  <label
                    className="absolute -bottom-2 -right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#0A66C2] text-xs shadow-lg hover:bg-blue-700"
                    title="Thay ảnh đại diện"
                  >
                    {isUploadingAvatar ? "…" : "📷"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={isUploadingAvatar}
                      onChange={(event) => {
                        void handleAvatarUpload(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">
                  Hồ sơ nhân sự HVE
                </p>
                <h2 className="mt-1 break-words text-xl font-black sm:text-2xl">
                  {profile.name}
                </h2>
                <p className="mt-1 break-all text-xs text-blue-50">
                  {profile.email}
                </p>
                {currentUser?.id === profile.id && (
                  <p className="mt-1 text-[10px] text-blue-100">
                    Chạm biểu tượng máy ảnh để đổi ảnh · tự động nén 384×384
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {!profile && !error ? (
          <BrandLoader compact label="Đang tải hồ sơ nhân sự..." />
        ) : error || !profile ? (
          <div className="p-8 text-center">
            <p className="font-bold text-red-700">Không thể tải hồ sơ</p>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
          </div>
        ) : (
          <div className="space-y-5 p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Dự án
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-bold text-gray-900">
                  {assignedProjects.length > 0
                    ? assignedProjects.map((project) => project.name).join(", ")
                    : "Huy Võ Education"}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {assignedProjects.length > 0
                    ? `Mã: ${assignedProjects.map((project) => project.code).join(", ")}`
                    : "Đơn vị tổng công ty"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Liên hệ
                </p>
                <a
                  href={`mailto:${profile.email}`}
                  className="mt-1 block break-all text-sm font-bold text-[#0A66C2]"
                >
                  {profile.email}
                </a>
                <p className="mt-0.5 text-xs text-gray-500">
                  {profile.phone || "Chưa cập nhật số điện thoại"}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Vai trò hệ thống
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.roles.map((role) => (
                  <span
                    key={role.id}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-[#0A66C2]"
                  >
                    {ROLE_LABELS[role.name] || role.name}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Dự án & vị trí công việc
              </p>
              <div className="space-y-2">
                {profile.ledProjects.map((project) => (
                  <div
                    key={`lead-${project.id}`}
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900">
                        {project.code} — {project.name}
                      </p>
                      <span className="rounded-full bg-amber-200 px-2.5 py-1 text-[10px] font-black text-amber-900">
                        TRƯỞNG DỰ ÁN
                      </span>
                    </div>
                    {project.location && (
                      <p className="mt-1 text-xs text-gray-500">
                        📍 {project.location}
                      </p>
                    )}
                  </div>
                ))}
                {profile.projectMemberships.map(({ project, position }) => (
                  <div
                    key={`member-${project.id}`}
                    className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900">
                        {project.code} — {project.name}
                      </p>
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-800">
                        {position || "THÀNH VIÊN"}
                      </span>
                    </div>
                    {project.location && (
                      <p className="mt-1 text-xs text-gray-500">
                        📍 {project.location}
                      </p>
                    )}
                  </div>
                ))}
                {profile.ledProjects.length === 0 &&
                  profile.projectMemberships.length === 0 && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-gray-900">
                          HVE — Huy Võ Education
                        </p>
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black text-blue-800">
                          TỔNG CÔNG TY
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
