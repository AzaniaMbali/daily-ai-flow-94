import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, Plus, Trash2, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

import { buildPlan, type WorkPlan } from "@/lib/assistant.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchTasks, priorityClass, type Task } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "AI Task Planner — Flowdesk" },
      {
        name: "description",
        content:
          "Prioritize tasks, get suggested deadlines and a structured daily or weekly work plan.",
      },
      { property: "og:title", content: "AI Task Planner — Flowdesk" },
      {
        property: "og:description",
        content: "Auto-prioritized tasks with time blocks and effort estimates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Planner,
});

function Planner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [horizon, setHorizon] = useState<"daily" | "weekly">("daily");
  const [plan, setPlan] = useState<WorkPlan | null>(null);
  const planFn = useServerFn(buildPlan);

  const tasks = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const open = (tasks.data ?? []).filter((t) => t.status !== "done");
  const done = (tasks.data ?? []).filter((t) => t.status === "done");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        user_id: user!.id,
        title: title.trim(),
        due_date: due || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDue("");
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const organize = useMutation({
    mutationFn: async (): Promise<WorkPlan> =>
      planFn({
        data: {
          horizon,
          tasks: open.map((t) => ({
            id: t.id,
            title: t.title,
            details: t.details,
            owner: t.owner,
            due_date: t.due_date,
            status: t.status,
          })),
        },
      }),
    onSuccess: async (result) => {
      setPlan(result);
      await Promise.all(
        (result.tasks ?? []).map((t) =>
          supabase
            .from("tasks")
            .update({
              priority: t.priority,
              due_date: t.due_date,
              estimated_minutes: t.estimated_minutes,
              rationale: t.rationale,
            })
            .eq("id", t.id),
        ),
      );
      toast.success("Work plan generated");
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not build a plan"),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">AI task planner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add tasks or import action items from a meeting, then let Flowdesk prioritize and schedule
          them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add a task</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) add.mutate();
            }}
          >
            <Input
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to get done?"
            />
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <Button type="submit" disabled={!title.trim() || add.isPending}>
              <Plus className="size-4" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <CardTitle className="text-lg">Open tasks</CardTitle>
              <CardDescription>{open.length} to organize</CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Select value={horizon} onValueChange={(v) => setHorizon(v as "daily" | "weekly")}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily plan</SelectItem>
                  <SelectItem value="weekly">Weekly plan</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => organize.mutate()} disabled={organize.isPending || !open.length}>
                <Sparkles className="size-4" />
                {organize.isPending ? "Planning…" : "Organize with AI"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {open.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing open. Add a task above or import action items from the meetings page.
            </p>
          )}
          {open
            .slice()
            .sort((a, b) => {
              const rank = { high: 0, medium: 1, low: 2 } as const;
              return rank[a.priority] - rank[b.priority];
            })
            .map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <Checkbox
                  className="mt-1"
                  checked={false}
                  aria-label="Mark complete"
                  onCheckedChange={() => update.mutate({ id: t.id, patch: { status: "done" } })}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.owner ? `${t.owner} · ` : ""}
                    {t.due_date ? `Due ${t.due_date}` : "No deadline"}
                    {t.estimated_minutes ? ` · ~${t.estimated_minutes} min` : ""}
                  </p>
                  {t.rationale && (
                    <p className="mt-1 text-xs italic text-muted-foreground">{t.rationale}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className={priorityClass[t.priority]}>
                    {t.priority}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Draft email about this task"
                    onClick={() => navigate({ to: "/emails", search: { task: t.id } })}
                  >
                    <Mail className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete task"
                    onClick={() => remove.mutate(t.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {plan && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">
                {horizon === "daily" ? "Today's schedule" : "This week's schedule"}
              </CardTitle>
              <CardDescription>Suggested time blocks based on priority and effort.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {(plan.schedule ?? []).map((day) => (
                <div key={day.label}>
                  <h3 className="text-sm font-semibold text-foreground">{day.label}</h3>
                  <div className="mt-2 space-y-2">
                    {(day.blocks ?? []).map((b, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 rounded-lg border border-border px-4 py-2.5 text-sm"
                      >
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="size-3.5" />
                          {b.time}
                        </span>
                        <span className="text-foreground">{b.focus}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Time management</CardTitle>
              <CardDescription>How to protect your focus.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {(plan.recommendations ?? []).map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Completed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {done.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-4 py-2.5"
              >
                <p className="truncate text-sm text-muted-foreground line-through">{t.title}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update.mutate({ id: t.id, patch: { status: "todo" } })}
                >
                  Reopen
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
