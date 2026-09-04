import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, ArrowRight, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { analyzeMeeting, type MeetingAnalysis } from "@/lib/assistant.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_NOTES, fetchMeetings, priorityClass, type Meeting } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({
    meta: [
      { title: "Meeting Summarizer — Flowdesk" },
      {
        name: "description",
        content:
          "Paste meeting notes and get summary points, decisions, action items, owners and deadlines.",
      },
      { property: "og:title", content: "Meeting Summarizer — Flowdesk" },
      {
        property: "og:description",
        content: "Turn long meeting notes into decisions and owned action items.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Meetings,
});

function List({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((i, idx) => (
          <li key={idx} className="flex gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Meetings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const analyze = useServerFn(analyzeMeeting);
  const meetings = useQuery({ queryKey: ["meetings"], queryFn: fetchMeetings });

  const run = useMutation({
    mutationFn: async (): Promise<MeetingAnalysis> => analyze({ data: { notes } }),
    onSuccess: async (result) => {
      const { error } = await supabase.from("meetings").insert({
        user_id: user!.id,
        title: result.title || "Untitled meeting",
        raw_notes: notes,
        summary: result.summary ?? [],
        discussion_points: result.discussion_points ?? [],
        decisions: result.decisions ?? [],
        action_items: result.action_items ?? [],
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setNotes("");
      toast.success("Meeting analyzed and saved");
      void qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not analyze these notes"),
  });

  const sendToPlanner = useMutation({
    mutationFn: async (meeting: Meeting) => {
      const rows = meeting.action_items.map((a) => ({
        user_id: user!.id,
        title: a.title,
        details: a.details,
        owner: a.owner,
        priority: a.priority ?? "medium",
        due_date: a.due_date,
        meeting_id: meeting.id,
      }));
      if (!rows.length) throw new Error("This meeting has no action items");
      const { error } = await supabase.from("tasks").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} action items sent to the planner`);
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void navigate({ to: "/planner" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["meetings"] }),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Meeting summarizer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste raw notes or a transcript. Flowdesk extracts the summary, decisions and owned action
          items.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New analysis</CardTitle>
          <CardDescription>Minimum 20 characters. Longer notes give better results.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={10}
            maxLength={20000}
            placeholder="Paste your meeting notes here…"
            className="resize-y"
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => run.mutate()} disabled={run.isPending || notes.trim().length < 20}>
              <Sparkles className="size-4" />
              {run.isPending ? "Analyzing…" : "Analyze notes"}
            </Button>
            <Button variant="outline" onClick={() => setNotes(DEMO_NOTES)} disabled={run.isPending}>
              Use sample notes
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {(meetings.data ?? []).map((m) => (
          <Card key={m.id}>
            <CardHeader>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <CardTitle className="truncate text-lg">{m.title}</CardTitle>
                  <CardDescription>
                    {m.meeting_date} · {m.action_items.length} action items
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete meeting"
                  onClick={() => remove.mutate(m.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <List title="Summary" items={m.summary} />
                <List title="Key discussion points" items={m.discussion_points} />
              </div>
              <List title="Decisions" items={m.decisions} />
              {m.action_items.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Action items</h3>
                    <div className="mt-3 space-y-2">
                      {m.action_items.map((a, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {a.owner ?? "Unassigned"}
                              {a.due_date ? ` · due ${a.due_date}` : ""}
                            </p>
                          </div>
                          <Badge variant="outline" className={priorityClass[a.priority ?? "medium"]}>
                            {a.priority ?? "medium"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => sendToPlanner.mutate(m)}
                  disabled={sendToPlanner.isPending || m.action_items.length === 0}
                >
                  Send action items to planner <ArrowRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/emails", search: { meeting: m.id } })}
                >
                  <Mail className="size-4" /> Draft follow-up email
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {(meetings.data?.length ?? 0) === 0 && !meetings.isLoading && (
          <p className="text-sm text-muted-foreground">
            No meetings analyzed yet — paste notes above to get started.
          </p>
        )}
      </div>
    </div>
  );
}
