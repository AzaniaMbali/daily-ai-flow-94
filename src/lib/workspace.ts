import { supabase } from "@/integrations/supabase/client";

export type Priority = "high" | "medium" | "low";

export type ActionItem = {
  title: string;
  owner: string | null;
  due_date: string | null;
  priority: Priority;
  details: string | null;
};

export type Meeting = {
  id: string;
  title: string;
  meeting_date: string;
  raw_notes: string;
  summary: string[];
  discussion_points: string[];
  decisions: string[];
  action_items: ActionItem[];
  created_at: string;
};

export type Task = {
  id: string;
  title: string;
  details: string | null;
  owner: string | null;
  priority: Priority;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
  estimated_minutes: number | null;
  rationale: string | null;
  meeting_id: string | null;
  created_at: string;
};

export type EmailDraft = {
  id: string;
  recipient: string;
  purpose: string;
  key_points: string | null;
  tone: string;
  subject: string;
  body: string;
  task_id: string | null;
  meeting_id: string | null;
  created_at: string;
};

export const priorityLabel: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const priorityClass: Record<Priority, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-primary/25 bg-primary/10 text-primary",
  low: "border-border bg-muted text-muted-foreground",
};

export async function fetchMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Meeting[];
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Task[];
}

export async function fetchEmails(): Promise<EmailDraft[]> {
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as EmailDraft[];
}

const DEMO_NOTES = `Weekly product sync — attendees: Naledi (PM), Thabo (Engineering), Priya (Design), Sam (Customer Success).

Naledi walked through Q3 numbers: activation is up 12% but week-4 retention slipped to 38%. Thabo said the onboarding API is timing out for ~4% of signups on mobile and he can have a fix in staging by next Wednesday. Priya shared the redesigned empty states; the team agreed to ship the new empty states with the next release rather than waiting for the full onboarding revamp. Sam raised that three enterprise accounts asked for CSV export again — we agreed to scope it but not commit a date yet.

Decisions: ship the redesigned empty states in release 4.2; delay the full onboarding revamp to Q4; Thabo owns the timeout fix.

Sam will send a summary to the three enterprise accounts by Friday. Priya to hand over final assets to engineering by Tuesday. Naledi will update the roadmap doc and share it before the exec review on the 18th.`;

export async function seedDemoData(userId: string) {
  const { data: meeting, error: mErr } = await supabase
    .from("meetings")
    .insert({
      user_id: userId,
      title: "Weekly Product Sync",
      meeting_date: new Date().toISOString().slice(0, 10),
      raw_notes: DEMO_NOTES,
      summary: [
        "Activation up 12% while week-4 retention dropped to 38%.",
        "Onboarding API times out for roughly 4% of mobile signups.",
        "Redesigned empty states are ready to ship in release 4.2.",
        "Three enterprise accounts renewed their request for CSV export.",
      ],
      discussion_points: [
        "Q3 activation and retention performance",
        "Mobile onboarding API reliability",
        "Empty state redesign rollout",
        "Enterprise CSV export demand",
      ],
      decisions: [
        "Ship redesigned empty states in release 4.2.",
        "Move the full onboarding revamp to Q4.",
        "Thabo owns the onboarding timeout fix.",
      ],
      action_items: [
        {
          title: "Fix onboarding API timeout on mobile",
          owner: "Thabo",
          due_date: null,
          priority: "high",
          details: "Target staging deploy next Wednesday.",
        },
        {
          title: "Email summary to the three enterprise accounts",
          owner: "Sam",
          due_date: null,
          priority: "medium",
          details: "Cover CSV export status honestly, no date commitment.",
        },
      ],
    })
    .select()
    .single();
  if (mErr) throw mErr;

  const today = new Date();
  const iso = (offset: number) =>
    new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);

  const { error: tErr } = await supabase.from("tasks").insert([
    {
      user_id: userId,
      title: "Fix onboarding API timeout on mobile",
      details: "Affects ~4% of mobile signups. Deploy to staging first.",
      owner: "Thabo",
      priority: "high",
      status: "in_progress",
      due_date: iso(3),
      estimated_minutes: 240,
      meeting_id: meeting.id,
    },
    {
      user_id: userId,
      title: "Email summary to enterprise accounts",
      details: "Three accounts waiting on a CSV export update.",
      owner: "Sam",
      priority: "medium",
      status: "todo",
      due_date: iso(2),
      estimated_minutes: 45,
      meeting_id: meeting.id,
    },
    {
      user_id: userId,
      title: "Hand over final empty-state assets",
      details: "Design handover to engineering for release 4.2.",
      owner: "Priya",
      priority: "medium",
      status: "todo",
      due_date: iso(1),
      estimated_minutes: 60,
      meeting_id: meeting.id,
    },
    {
      user_id: userId,
      title: "Update roadmap doc before exec review",
      details: "Reflect the Q4 onboarding revamp shift.",
      owner: "Naledi",
      priority: "high",
      status: "todo",
      due_date: iso(5),
      estimated_minutes: 90,
      meeting_id: meeting.id,
    },
    {
      user_id: userId,
      title: "Scope CSV export for enterprise tier",
      details: "Effort estimate only — no delivery date yet.",
      owner: null,
      priority: "low",
      status: "todo",
      due_date: iso(9),
      estimated_minutes: 120,
      meeting_id: meeting.id,
    },
  ]);
  if (tErr) throw tErr;

  const { error: eErr } = await supabase.from("emails").insert({
    user_id: userId,
    recipient: "Enterprise account leads",
    purpose: "Share the product sync outcome and current CSV export status",
    key_points: "Empty states shipping in 4.2; CSV export scoped, no date committed yet.",
    tone: "professional",
    subject: "Product update: release 4.2 and CSV export status",
    body: `Hi all,\n\nThank you for your continued feedback. Following our weekly product sync, I wanted to share where things stand.\n\nOur redesigned onboarding empty states will ship with release 4.2, and we are addressing an API timeout affecting a small share of mobile signups. On CSV export, we have scoped the work and it is under active consideration; I do not have a delivery date to share yet, but I will update you as soon as one is confirmed.\n\nHappy to walk through any of this on a call.\n\nBest regards,\nSam`,
    meeting_id: meeting.id,
  });
  if (eErr) throw eErr;
}

export { DEMO_NOTES };
