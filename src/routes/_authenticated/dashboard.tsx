import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, ListChecks, Mail, AlertTriangle, Database } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { fetchEmails, fetchMeetings, fetchTasks, priorityClass, seedDemoData } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Flowdesk Workplace Assistant" },
      {
        name: "description",
        content: "See today's priorities, recent meeting outcomes and email drafts at a glance.",
      },
      { property: "og:title", content: "Dashboard — Flowdesk" },
      { property: "og:description", content: "Your priorities, meetings and drafts in one view." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const meetings = useQuery({ queryKey: ["meetings"], queryFn: fetchMeetings });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const emails = useQuery({ queryKey: ["emails"], queryFn: fetchEmails });

  const seed = useMutation({
    mutationFn: async () => seedDemoData(user!.id),
    onSuccess: () => {
      toast.success("Demo workspace loaded");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = (tasks.data ?? []).filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.due_date && t.due_date < new Date().toISOString().slice(0, 10));
  const isEmpty =
    (meetings.data?.length ?? 0) === 0 &&
    (tasks.data?.length ?? 0) === 0 &&
    (emails.data?.length ?? 0) === 0;

  const stats = [
    { label: "Meetings analyzed", value: meetings.data?.length ?? 0, icon: CalendarCheck, to: "/meetings" },
    { label: "Open tasks", value: open.length, icon: ListChecks, to: "/planner" },
    { label: "Overdue", value: overdue.length, icon: AlertTriangle, to: "/planner" },
    { label: "Email drafts", value: emails.data?.length ?? 0, icon: Mail, to: "/emails" },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-foreground sm:text-3xl">
            Good day{user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Meeting outcomes, prioritized work and follow-up drafts in one place.
          </p>
        </div>
        {isEmpty && (
          <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
            <Database className="size-4" />
            {seed.isPending ? "Loading…" : "Load demo data"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to}>
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-3xl font-semibold text-foreground">{s.value}</p>
                </div>
                <s.icon className="size-6 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Priority queue</CardTitle>
            <CardDescription>Highest-impact open work across your meetings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {open.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No open tasks yet. Analyze a meeting or add tasks in the planner.
              </p>
            )}
            {open
              .slice()
              .sort((a, b) => {
                const rank = { high: 0, medium: 1, low: 2 } as const;
                return rank[a.priority] - rank[b.priority];
              })
              .slice(0, 6)
              .map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.owner ? `${t.owner} · ` : ""}
                      {t.due_date ? `Due ${t.due_date}` : "No deadline"}
                    </p>
                  </div>
                  <Badge variant="outline" className={priorityClass[t.priority]}>
                    {t.priority}
                  </Badge>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent meetings</CardTitle>
            <CardDescription>Latest analyzed sessions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(meetings.data ?? []).slice(0, 5).map((m) => (
              <Link
                key={m.id}
                to="/meetings"
                className="block rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary/40"
              >
                <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m.meeting_date} · {m.action_items.length} action items
                </p>
              </Link>
            ))}
            {(meetings.data?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nothing analyzed yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
