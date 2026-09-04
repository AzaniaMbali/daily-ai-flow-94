import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Sparkles, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { generateEmail } from "@/lib/assistant.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchEmails, fetchMeetings, fetchTasks } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Search = { task?: string; meeting?: string };

export const Route = createFileRoute("/_authenticated/emails")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search['task'] === "string" ? { task: search['task'] } : {}),
    ...(typeof search['meeting'] === "string" ? { meeting: search['meeting'] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Smart Email Generator — Flowdesk" },
      {
        name: "description",
        content:
          "Generate polished workplace emails from a recipient, purpose, key information and tone.",
      },
      { property: "og:title", content: "Smart Email Generator — Flowdesk" },
      {
        property: "og:description",
        content: "Draft professional emails informed by your meetings and tasks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Emails,
});

const TONES = ["professional", "friendly", "formal", "concise", "persuasive", "apologetic"] as const;

function Emails() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const gen = useServerFn(generateEmail);

  const [recipient, setRecipient] = useState("");
  const [purpose, setPurpose] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]>("professional");
  const [linkedTask, setLinkedTask] = useState<string>("none");
  const [linkedMeeting, setLinkedMeeting] = useState<string>("none");
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);

  const tasks = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const meetings = useQuery({ queryKey: ["meetings"], queryFn: fetchMeetings });
  const emails = useQuery({ queryKey: ["emails"], queryFn: fetchEmails });

  useEffect(() => {
    if (search.task && tasks.data) {
      const t = tasks.data.find((x) => x.id === search.task);
      if (t) {
        setLinkedTask(t.id);
        setPurpose((p) => p || `Follow up on the task "${t.title}"`);
        setKeyPoints(
          (k) =>
            k ||
            [t.details, t.due_date ? `Due ${t.due_date}` : null, t.owner ? `Owner: ${t.owner}` : null]
              .filter(Boolean)
              .join("\n"),
        );
      }
    }
    if (search.meeting && meetings.data) {
      const m = meetings.data.find((x) => x.id === search.meeting);
      if (m) {
        setLinkedMeeting(m.id);
        setPurpose((p) => p || `Share the outcome of "${m.title}"`);
        setKeyPoints((k) => k || [...m.summary, ...m.decisions].join("\n"));
      }
    }
  }, [search.task, search.meeting, tasks.data, meetings.data]);

  const context = (() => {
    const parts: string[] = [];
    const m = meetings.data?.find((x) => x.id === linkedMeeting);
    if (m) parts.push(`Meeting "${m.title}": ${[...m.summary, ...m.decisions].join(" ")}`);
    const t = tasks.data?.find((x) => x.id === linkedTask);
    if (t) parts.push(`Task "${t.title}" (${t.priority} priority${t.due_date ? `, due ${t.due_date}` : ""})`);
    return parts.join("\n").slice(0, 4000);
  })();

  const run = useMutation({
    mutationFn: async () =>
      gen({
        data: {
          recipient,
          purpose,
          keyPoints,
          tone,
          context,
          senderName: user?.user_metadata?.["display_name"] ?? "",
        },
      }),
    onSuccess: async (result) => {
      setDraft(result);
      const { error } = await supabase.from("emails").insert({
        user_id: user!.id,
        recipient,
        purpose,
        key_points: keyPoints,
        tone,
        subject: result.subject,
        body: result.body,
        task_id: linkedTask === "none" ? null : linkedTask,
        meeting_id: linkedMeeting === "none" ? null : linkedMeeting,
      });
      if (error) toast.error(error.message);
      else void qc.invalidateQueries({ queryKey: ["emails"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not generate this email"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("emails").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["emails"] }),
  });

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Smart email generator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Draft polished workplace emails — optionally grounded in a meeting or task.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email brief</CardTitle>
            <CardDescription>Tell Flowdesk who, why and what matters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient</Label>
              <Input
                id="recipient"
                maxLength={160}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Priya, Head of Design"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose</Label>
              <Input
                id="purpose"
                maxLength={1000}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Request final assets ahead of the 4.2 release"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key">Key information</Label>
              <Textarea
                id="key"
                rows={5}
                maxLength={4000}
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                placeholder="Deadlines, numbers, names, next steps…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as (typeof TONES)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Related meeting</Label>
                <Select value={linkedMeeting} onValueChange={setLinkedMeeting}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(meetings.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Related task</Label>
                <Select value={linkedTask} onValueChange={setLinkedTask}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(tasks.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => run.mutate()}
              disabled={run.isPending || !recipient.trim() || purpose.trim().length < 3}
            >
              <Sparkles className="size-4" />
              {run.isPending ? "Writing…" : "Generate email"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Draft</CardTitle>
            <CardDescription>Review, tweak and copy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!draft && (
              <p className="text-sm text-muted-foreground">
                Your generated email will appear here.
              </p>
            )}
            {draft && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body">Body</Label>
                  <Textarea
                    id="body"
                    rows={14}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                </div>
                <Button variant="outline" onClick={() => copy(`${draft.subject}\n\n${draft.body}`)}>
                  <Copy className="size-4" /> Copy email
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Saved drafts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(emails.data ?? []).map((e) => (
            <div key={e.id} className="rounded-lg border border-border px-4 py-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{e.subject}</p>
                  <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                    To {e.recipient} · {e.tone}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copy draft"
                    onClick={() => copy(`${e.subject}\n\n${e.body}`)}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete draft"
                    onClick={() => remove.mutate(e.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{e.body}</p>
            </div>
          ))}
          {(emails.data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No drafts saved yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
