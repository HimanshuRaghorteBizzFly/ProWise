"use client";

import React, { useState } from "react";
import { Bell, Check, ExternalLink } from "lucide-react";
import { useNotificationStore } from "@/store/notification-store";
import Link from "next/link";

export function NotificationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-[var(--color-surface)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-80 sm:w-96 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Notifications</h4>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary-100 dark:bg-primary-950 px-2 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border)]">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-[var(--color-text-secondary)]">
                  No notifications yet.
                </p>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 transition-colors ${
                      n.read ? "opacity-75" : "bg-[var(--color-hover)]/40 font-medium"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">{n.title}</p>
                      {!n.read && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="text-[10px] text-primary-600 hover:underline flex-shrink-0"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)] line-clamp-2">{n.message}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                      <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {n.targetUrl && (
                        <Link
                          href={n.targetUrl}
                          onClick={() => {
                            markAsRead(n.id);
                            setIsOpen(false);
                          }}
                          className="flex items-center gap-0.5 text-primary-600 hover:underline"
                        >
                          View <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

