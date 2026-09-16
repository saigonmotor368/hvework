export interface NotificationPayload {
  userId: number;
  eventType: string;
  entityRef: string;
  title: string;
  content: string;
  link?: string;
  dedupeKey: string;
}

export interface NotificationChannel {
  channelName: string;
  send(payload: NotificationPayload): Promise<boolean>;
}
