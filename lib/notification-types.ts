export type AppNotification = {
  key: string;
  version: string;
  projectName: string;
  title: string;
  description: string;
  href: string;
  kind: "message" | "alert";
  date: string | null;
  read: boolean;
};
export type NotificationFeed = { items: AppNotification[]; limited: boolean };
