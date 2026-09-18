import React from "react";

interface UserNameButtonProps {
  user?: { id?: number | null; name?: string | null } | null;
  fallback?: React.ReactNode;
  className?: string;
}

export const UserNameButton: React.FC<UserNameButtonProps> = ({
  user,
  fallback = "---",
  className = "",
}) => {
  if (!user?.id || !user.name) return <>{fallback}</>;

  const openProfile = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("hve-open-user-profile", { detail: { id: user.id } }),
    );
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={openProfile}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") openProfile(event);
      }}
      title={`Xem hồ sơ của ${user.name}`}
      className={`cursor-pointer font-semibold text-[#0A66C2] underline decoration-blue-200 underline-offset-2 transition hover:text-blue-800 hover:decoration-blue-500 ${className}`}
    >
      {user.name}
    </span>
  );
};
