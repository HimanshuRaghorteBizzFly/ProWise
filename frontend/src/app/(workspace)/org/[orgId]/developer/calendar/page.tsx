"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  AlertCircle,
  Flag,
  FolderGit2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { developerApi, DeveloperCalendarEvent } from "@/lib/developer-api";
import { toast } from "sonner";

export default function DeveloperCalendarPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";

  const [events, setEvents] = useState<DeveloperCalendarEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<DeveloperCalendarEvent["eventType"]>("DEADLINE");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);

  const loadEvents = async () => {
    setLoading(true);
    const res = await developerApi.getCalendarEvents();
    if (res && res.length > 0) {
      setEvents(res);
    } else {
      // Mock fallback
      const mock: DeveloperCalendarEvent[] = [
        {
          id: "evt-1",
          userId: "usr-developer",
          projectId: "proj-individual-solo",
          title: "FHIR Patient Intake Service — Target Go-Live",
          description: "Authoritative delivery target for solo ownership project.",
          eventType: "DEADLINE",
          startTime: "2026-11-20T18:00:00Z",
          allDay: true,
          createdAt: "2026-11-01T00:00:00Z",
        },
        {
          id: "evt-2",
          userId: "usr-developer",
          projectId: "proj-structured-cds",
          title: "Sprint 42 Demo & Review Gate",
          description: "Demonstrate rule execution benchmark and test coverage to PM.",
          eventType: "SPRINT",
          startTime: "2026-11-20T15:00:00Z",
          allDay: false,
          createdAt: "2026-11-01T00:00:00Z",
        },
        {
          id: "evt-3",
          userId: "usr-developer",
          projectId: "proj-structured-cds",
          title: "Architecture Review: OAuth2 Token Exchange",
          description: "Technical design review with Team Lead.",
          eventType: "REVIEW",
          startTime: "2026-11-25T11:00:00Z",
          allDay: false,
          createdAt: "2026-11-15T00:00:00Z",
        },
      ];
      setEvents(mock);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      projectId: "proj-structured-cds",
      title,
      description,
      eventType,
      startTime: new Date(date).toISOString(),
      allDay: true,
    };

    const res = await developerApi.createCalendarEvent(payload);
    if (res) {
      setEvents((prev) => [...prev, res]);
    } else {
      const fallback: DeveloperCalendarEvent = {
        id: `evt-${Date.now()}`,
        userId: "usr-developer",
        ...payload,
        createdAt: new Date().toISOString(),
      };
      setEvents((prev) => [...prev, fallback]);
    }

    toast.success("Calendar milestone created");
    setShowModal(false);
    setTitle("");
    setDescription("");
  };

  // Group events by date
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return (
    <PanelLayout
      title="Calendar & Deadlines"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Calendar & Deadlines" }]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-app-text-primary">Cadence &amp; Delivery Deadlines</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Scheduled milestone deadlines, sprint end dates, and technical review windows.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowModal(true)}
            className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Event / Deadline</span>
          </Button>
        </div>

        {/* Timeline View */}
        <div className="space-y-4">
          {sortedEvents.length === 0 ? (
            <Card className="p-12 text-center text-xs text-app-text-muted">
              No calendar events or deadlines scheduled.
            </Card>
          ) : (
            sortedEvents.map((evt) => {
              const eventDate = new Date(evt.startTime);
              const isPast = eventDate < new Date();

              return (
                <Card
                  key={evt.id}
                  className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 ${
                    evt.eventType === "DEADLINE"
                      ? "border-l-rose-500"
                      : evt.eventType === "SPRINT"
                      ? "border-l-blue-500"
                      : "border-l-purple-500"
                  }`}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="p-3 rounded-xl bg-app-surface border border-app-border text-center shrink-0 w-16">
                      <div className="text-[10px] font-bold uppercase text-blue-600">
                        {eventDate.toLocaleDateString([], { month: "short" })}
                      </div>
                      <div className="text-xl font-bold text-app-text-primary">
                        {eventDate.getDate()}
                      </div>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={
                            evt.eventType === "DEADLINE"
                              ? "danger"
                              : evt.eventType === "SPRINT"
                              ? "default"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {evt.eventType}
                        </Badge>
                        {isPast && (
                          <Badge variant="outline" className="text-[10px] text-app-text-muted">
                            Past
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-app-text-primary">{evt.title}</h4>
                      {evt.description && (
                        <p className="text-xs text-app-text-secondary">{evt.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-app-text-muted shrink-0 flex items-center gap-1.5 sm:text-right">
                    <Clock className="w-3.5 h-3.5 text-app-text-muted" />
                    <span>
                      {evt.allDay
                        ? "All Day"
                        : eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Add Event Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-app-surface border border-app-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-app-text-primary">Schedule Milestone / Deadline</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-app-text-muted hover:text-app-text-primary"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-medium text-app-text-primary block mb-1">Event Title</label>
                  <Input
                    required
                    placeholder="e.g. End of Sprint 42 Demo"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-app-text-primary block mb-1">Type</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as any)}
                      className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary"
                    >
                      <option value="DEADLINE">Deadline</option>
                      <option value="SPRINT">Sprint Milestone</option>
                      <option value="REVIEW">Code Review Window</option>
                      <option value="PERSONAL">Personal Task</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-app-text-primary block mb-1">Date</label>
                    <Input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-app-text-primary block mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Notes or deliverables expected..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-app-border">
                  <Button variant="outline" size="sm" type="button" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit">
                    Save Event
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}
