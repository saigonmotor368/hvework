import React from "react";
import { authenticatedFileUrl } from "../api/client";

interface UserAvatarProps {
  user?: { name?: string | null; avatarUrl?: string | null } | null;
  apiBaseUrl: string;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  apiBaseUrl,
  className = "h-10 w-10 rounded-xl",
}) => {
  const initials = (user?.name || "HVE")
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const token = localStorage.getItem("access_token") || "";
  const src =
    user?.avatarUrl && token
      ? authenticatedFileUrl(apiBaseUrl, user.avatarUrl, token)
      : null;

  if (src) {
    return (
      <img
        src={src}
        alt={`Ảnh đại diện ${user?.name || "người dùng"}`}
        className={`shrink-0 object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-label={`Ảnh đại diện ${user?.name || "người dùng"}`}
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-blue-100 to-violet-100 font-black text-[#0A66C2] ${className}`}
    >
      {initials || "HV"}
    </span>
  );
};
