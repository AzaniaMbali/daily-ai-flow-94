import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ListChecks, Mail, ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flowdesk — AI Meeting Notes, Task Planner & Email Writer" },
      {
        name: "description",
        content:
          "Turn meeting notes into action items, auto-prioritize your work plan, and draft polished workplace emails — one connected AI assistant.",
      },
      { property: "og:title", content: "Flowdesk — AI Workplace Productivity Assistant" },
      {
        property: "og:description",
        content:
          "Turn meeting notes into action items, auto-prioritize your work plan, and draft polished workplace emails.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: CalendarCheck,
    title: "Meeting summarizer",
    body: "Paste raw notes and get summary points, decisions, action items, owners and deadlines in seconds.",
  },
  {
    icon: ListChecks,
    title: "AI task planner",
    body: "Action items flow straight into a prioritized daily or weekly plan with time blocks and effort estimates.",
  },
  {
    icon: Mail,
    title: "Smart email writer",
    body: "Draft polished emails from a task or meeting context, in the exact tone the moment calls for.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-bold text-foreground">Flowdesk</span>
        <Button asChild variant="ghost">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <div className="overflow-hidden rounded-3xl bg-hero-gradient px-8 py-16 text-primary-foreground shadow-panel sm:px-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <Sparkles className="size-3.5" /> One connected assistant
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Meetings in. Priorities, plans and emails out.
          </h1>
          <p className="mt-5 max-w-2xl text-base opacity-90 sm:text-lg">
            Flowdesk reads your meeting notes, extracts the real commitments, builds a realistic
            work plan around them, and writes the follow-up emails for you.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth">
                Start free <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="border-border/70">
              <CardContent className="pt-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                  <f.icon className="size-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground">{f.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
