"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Send,
  Plus,
  Users,
  Clock,
  Sparkles,
  Search,
} from "lucide-react";
import {
  developerApi,
  DeveloperDiscussion,
  DeveloperDiscussionMessage,
} from "@/lib/developer-api";
import { toast } from "sonner";

export default function DeveloperDiscussionsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";

  const [discussions, setDiscussions] = useState<DeveloperDiscussion[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<DeveloperDiscussion | null>(null);
  const [messages, setMessages] = useState<DeveloperDiscussionMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);

  // New Discussion Modal
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("ARCHITECTURE");
  const [initialPost, setInitialPost] = useState("");

  const loadDiscussions = async () => {
    const res = await developerApi.getDiscussions();
    if (res && res.length > 0) {
      setDiscussions(res);
      setSelectedDiscussion(res[0]);
    } else {
      // Mock fallback
      const mock: DeveloperDiscussion[] = [
        {
          id: "dsc-1",
          projectId: "proj-structured-cds",
          title: "Architecture: Drools vs Camunda Engine Selection",
          category: "ARCHITECTURE",
          authorId: "usr-lead",
          createdAt: "2026-11-15T10:00:00Z",
          updatedAt: "2026-11-18T14:00:00Z",
        },
        {
          id: "dsc-2",
          projectId: "proj-individual-solo",
          title: "HL7 v2 Message Serialization Strategy",
          category: "INTEGRATION",
          authorId: "usr-developer",
          createdAt: "2026-11-12T09:00:00Z",
          updatedAt: "2026-11-17T11:00:00Z",
        },
      ];
      setDiscussions(mock);
      setSelectedDiscussion(mock[0]);
    }
  };

  useEffect(() => {
    loadDiscussions();
  }, []);

  useEffect(() => {
    if (!selectedDiscussion) return;
    setLoadingMessages(true);
    developerApi.getDiscussionMessages(selectedDiscussion.id).then((data) => {
      if (data && data.length > 0) {
        setMessages(data);
      } else {
        // Mock fallback messages
        setMessages([
          {
            id: "msg-1",
            discussionId: selectedDiscussion.id,
            authorId: "usr-lead",
            authorName: "Sarah Jenkins (Lead)",
            content: "We should evaluate Drools rule evaluation latency against 10,000 synthetic patient facts.",
            createdAt: "2026-11-15T10:05:00Z",
          },
          {
            id: "msg-2",
            discussionId: selectedDiscussion.id,
            authorId: "usr-developer",
            authorName: "Alex Rivera",
            content: "Agreed. I have set up JMH benchmarks on the feature/drools branch with sub-50ms p99.",
            createdAt: "2026-11-16T11:20:00Z",
          },
        ]);
      }
      setLoadingMessages(false);
    });
  }, [selectedDiscussion]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiscussion || !newMessage.trim()) return;

    const res = await developerApi.sendDiscussionMessage(selectedDiscussion.id, newMessage);
    const added: DeveloperDiscussionMessage = res || {
      id: `msg-${Date.now()}`,
      discussionId: selectedDiscussion.id,
      authorId: "usr-developer",
      authorName: "Alex Rivera",
      content: newMessage,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, added]);
    setNewMessage("");
  };

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const res = await developerApi.createDiscussion({
      projectId: "proj-structured-cds",
      title: newTitle,
      category: newCategory,
      initialMessage: initialPost,
    });

    const created = res || {
      id: `dsc-${Date.now()}`,
      projectId: "proj-structured-cds",
      title: newTitle,
      category: newCategory,
      authorId: "usr-developer",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDiscussions((prev) => [created, ...prev]);
    setSelectedDiscussion(created);
    setShowModal(false);
    setNewTitle("");
    setInitialPost("");
    toast.success("Discussion topic started");
  };

  return (
    <PanelLayout
      title="Team Collaboration"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Team Collaboration" }]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-app-text-primary">Engineering Discussions</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Collaborate asynchronously with team leads, peers, and product managers.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowModal(true)}
            className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Discussion</span>
          </Button>
        </div>

        {/* 2-Column Split View: Channels on Left, Chat on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* Discussion Topics List */}
          <Card className="p-3 flex flex-col h-full overflow-hidden">
            <div className="p-2 border-b border-app-border font-bold text-xs text-app-text-primary flex items-center justify-between">
              <span>Topics &amp; Channels</span>
              <Badge variant="outline" className="text-[10px]">
                {discussions.length}
              </Badge>
            </div>
            <div className="divide-y divide-app-border overflow-y-auto flex-1 mt-1">
              {discussions.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedDiscussion(d)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors text-xs space-y-1 ${
                    selectedDiscussion?.id === d.id
                      ? "bg-blue-500/10 border-l-4 border-l-blue-600"
                      : "hover:bg-app-hover"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[9px] font-mono">
                      {d.category}
                    </Badge>
                    <span className="text-[10px] text-app-text-muted">
                      {new Date(d.updatedAt || d.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <h4 className="font-bold text-app-text-primary line-clamp-1">{d.title}</h4>
                  <p className="text-[11px] text-app-text-secondary">Started by {d.authorId}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Messages Stream & Reply */}
          <Card className="lg:col-span-2 p-4 flex flex-col h-full overflow-hidden">
            {selectedDiscussion ? (
              <>
                {/* Topic Header */}
                <div className="p-3 border-b border-app-border flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="font-bold text-sm text-app-text-primary">
                      {selectedDiscussion.title}
                    </h3>
                    <p className="text-[11px] text-app-text-muted">
                      Channel: {selectedDiscussion.category} &bull; Project: {selectedDiscussion.projectId}
                    </p>
                  </div>
                  <Badge variant="outline">{messages.length} messages</Badge>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-xl border border-app-border bg-app-bg text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-app-text-primary">
                          {m.authorName || m.authorId}
                        </span>
                        <span className="text-[10px] text-app-text-muted">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-app-text-secondary leading-relaxed">
                        {m.content || m.message}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Message Input Box */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-2 border-t border-app-border flex items-center gap-2 shrink-0"
                >
                  <Input
                    placeholder="Type a response to the team..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="text-xs flex-1"
                  />
                  <Button size="sm" type="submit" className="gap-1 text-xs">
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-app-text-muted">
                Select a topic on the left to view conversation.
              </div>
            )}
          </Card>
        </div>

        {/* Start Discussion Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-app-surface border border-app-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-app-text-primary">Start New Discussion</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-app-text-muted hover:text-app-text-primary"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateDiscussion} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-medium text-app-text-primary block mb-1">Topic Title</label>
                  <Input
                    required
                    placeholder="e.g. Migration plan for PostgreSQL 16"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="font-medium text-app-text-primary block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary"
                  >
                    <option value="ARCHITECTURE">Architecture &amp; Design</option>
                    <option value="INTEGRATION">Integrations &amp; APIs</option>
                    <option value="STANDUP">Standup / Daily Notes</option>
                    <option value="GENERAL">General Discussion</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-app-text-primary block mb-1">Initial Note</label>
                  <textarea
                    rows={3}
                    placeholder="Provide background context or proposal details..."
                    value={initialPost}
                    onChange={(e) => setInitialPost(e.target.value)}
                    className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-app-border">
                  <Button variant="outline" size="sm" type="button" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit">
                    Post Topic
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
