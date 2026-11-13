/** Các trạng thái công việc. Tạm ngừng / Đã hủy là trạng thái quản lý, không phải tiến độ. */
export const TASK_STATUS = {
  TODO: 'Chưa làm',
  DOING: 'Đang làm',
  REVIEW: 'Chờ duyệt',
  DONE: 'Hoàn thành',
  PAUSED: 'Tạm ngừng',
  CANCELLED: 'Đã hủy',
} as const;

/** Việc đang chạy: còn tính tải công việc, còn có thể quá hạn. */
export const TASK_LIVE_STATUSES: string[] = [
  TASK_STATUS.TODO,
  TASK_STATUS.DOING,
  TASK_STATUS.REVIEW,
];

/** Không còn tính vào tải công việc / quá hạn / nhắc việc. */
export const TASK_INACTIVE_STATUSES: string[] = [
  TASK_STATUS.DONE,
  TASK_STATUS.PAUSED,
  TASK_STATUS.CANCELLED,
];

/** Đã khép lại: hoàn thành hoặc hủy (tạm ngừng vẫn còn dang dở). */
export const TASK_CLOSED_STATUSES: string[] = [
  TASK_STATUS.DONE,
  TASK_STATUS.CANCELLED,
];

export function isTaskInactive(status?: string | null): boolean {
  return !!status && TASK_INACTIVE_STATUSES.includes(status);
}
