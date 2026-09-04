import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const today = () => new Date().toISOString().slice(0, 10);

export type MeetingAnalysis = {
  title: string;
  summary: string[];
  discussion_points: string[];
  decisions: string[];
  action_items: Array<{
    title: string;
    owner: string | null;
    due_date: string | null;
    priority: "high" | "medium" | "low";
    details: string | null;
  }>;
};

export const analyzeMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ notes: z.string().trim().min(20).max(20000) }).parse(data),
  )
  .handler(async ({ data }): Promise<MeetingAnalysis> => {
    const { aiJson } = await import("./ai.server");
    return aiJson<MeetingAnalysis>(
      `You are an expert meeting analyst for busy professionals. Today's date is ${today()}.
Return ONLY JSON with this exact shape:
{"title":string,"summary":string[],"discussion_points":string[],"decisions":string[],"action_items":[{"title":string,"owner":string|null,"due_date":"YYYY-MM-DD"|null,"priority":"high"|"medium"|"low","details":string|null}]}
Rules: title is a short meeting title. summary has 3-6 crisp bullet points. Only list decisions actually made. Extract every action item; set owner only when a person is clearly identifiable, otherwise null. Resolve relative deadlines ("next Friday") into real dates. Keep every string under 200 characters.`,
      `Meeting notes:\n\n${data.notes}`,
    );
  });

export type PlannedTask = {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  due_date: string | null;
  estimated_minutes: number;
  rationale: string;
};

export type WorkPlan = {
  tasks: PlannedTask[];
  schedule: Array<{ label: string; blocks: Array<{ time: string; focus: string }> }>;
  recommendations: string[];
};

export const buildPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        horizon: z.enum(["daily", "weekly"]),
        tasks: z
          .array(
            z.object({
              id: z.string(),
              title: z.string(),
              details: z.string().nullable().optional(),
              owner: z.string().nullable().optional(),
              due_date: z.string().nullable().optional(),
              status: z.string(),
            }),
          )
          .min(1)
          .max(60),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<WorkPlan> => {
    const { aiJson } = await import("./ai.server");
    return aiJson<WorkPlan>(
      `You are a productivity chief of staff. Today's date is ${today()}.
Return ONLY JSON with this exact shape:
{"tasks":[{"id":string,"title":string,"priority":"high"|"medium"|"low","due_date":"YYYY-MM-DD"|null,"estimated_minutes":number,"rationale":string}],"schedule":[{"label":string,"blocks":[{"time":string,"focus":string}]}],"recommendations":string[]}
Rules: keep the given id for every task, unchanged. Assign priority from urgency and importance. Suggest a realistic due date when missing. Estimate effort in minutes. Build a ${data.horizon === "daily" ? "single-day schedule with time blocks from 09:00 to 17:00" : "weekly schedule with one entry per weekday (Monday-Friday)"}. Give 3-5 short time-management recommendations. Keep every string under 160 characters.`,
      JSON.stringify({ horizon: data.horizon, tasks: data.tasks }),
    );
  });

export const generateEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        recipient: z.string().trim().min(1).max(160),
        purpose: z.string().trim().min(3).max(1000),
        keyPoints: z.string().trim().max(4000).optional().default(""),
        tone: z.enum(["professional", "friendly", "formal", "concise", "persuasive", "apologetic"]),
        context: z.string().trim().max(4000).optional().default(""),
        senderName: z.string().trim().max(120).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ subject: string; body: string }> => {
    const { aiJson } = await import("./ai.server");
    return aiJson<{ subject: string; body: string }>(
      `You write polished workplace emails. Return ONLY JSON: {"subject":string,"body":string}.
Rules: tone must be ${data.tone}. Body is plain text with greeting, clear paragraphs and a sign-off${
        data.senderName ? ` from ${data.senderName}` : " (use [Your name] if the sender is unknown)"
      }. No markdown, no placeholders other than the sign-off. Keep it under 250 words.`,
      JSON.stringify({
        recipient: data.recipient,
        purpose: data.purpose,
        key_information: data.keyPoints,
        related_context: data.context,
      }),
    );
  });
