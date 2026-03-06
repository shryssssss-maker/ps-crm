// app/api/chat/route.ts — Server-side Gemini proxy (keeps API key safe)

import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/gemini";
import type { ChatMessage, GeminiResponse, ExtractedComplaint } from "@/lib/gemini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "https://jansamadhan.perkkk.dev",
  "https://api.jansamadhan.perkkk.dev",
]);

interface GeminiApiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

interface GeminiCandidate {
  content: { parts: { text: string }[] };
}

interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
  error?: { message: string };
}

function getCorsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function withCors(req: NextRequest, init?: ResponseInit): ResponseInit {
  const origin = req.headers.get("origin");
  return {
    ...init,
    headers: {
      ...getCorsHeaders(origin),
      ...(init?.headers ?? {}),
    },
  };
}

function toConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function sanitizeExtracted(value: unknown): ExtractedComplaint | null {
  if (!value || typeof value !== "object") return null;

  const v = value as Record<string, unknown>;
  const title = typeof v.title === "string" ? v.title.trim() : "";
  const issueType = typeof v.issue_type === "string" ? v.issue_type.trim() : "";
  const severity = typeof v.severity === "string" ? v.severity.trim() : "";
  const description = typeof v.description === "string" ? v.description.trim() : "";

  if (!title || !issueType || !severity || !description) return null;

  return {
    title,
    issue_type: issueType,
    severity,
    description,
    confidence: toConfidence(v.confidence),
  };
}

/**
 * POST /api/chat
 * Accepts conversation messages and proxies them to Google Gemini.
 * Returns a structured GeminiResponse (reply + optional extracted complaint).
 */
export async function POST(req: NextRequest): Promise<NextResponse<GeminiResponse | { error: string }>> {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      withCors(req, { status: 500 }),
    );
  }

  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, withCors(req, { status: 403 }));
  }

  const body = await req.json().catch(() => null);
  if (!body?.messages || !Array.isArray(body.messages)) {
    return NextResponse.json(
      { error: "messages array is required" },
      withCors(req, { status: 400 }),
    );
  }

  const messages = body.messages as ChatMessage[];

  // Build Gemini API contents: system instruction + conversation history
  const contents: GeminiApiContent[] = [
    { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
    { role: "model", parts: [{ text: "Understood. I am JanSamadhan AI, ready to help Delhi citizens report civic issues." }] },
    ...messages.map((m) => ({
      role: m.role === "user" ? "user" as const : "model" as const,
      parts: [{ text: m.text }],
    })),
  ];

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
      },
    );

    const data = (await geminiRes.json()) as GeminiApiResponse;

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, withCors(req, { status: 502 }));
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!rawText) {
      return NextResponse.json({ error: "Empty response from Gemini" }, withCors(req, { status: 502 }));
    }

    // Try to parse extracted complaint JSON from code block
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]) as { extracted?: unknown; reply?: unknown };
        const extracted = sanitizeExtracted(parsed.extracted);
        const reply = typeof parsed.reply === "string" && parsed.reply.trim()
          ? parsed.reply
          : "Please review the complaint summary and type YES to submit.";

        return NextResponse.json({
          reply,
          extracted,
        }, withCors(req));
      } catch {
        // Malformed JSON — fall through to plain text
      }
    }

    // Plain conversational reply
    return NextResponse.json({ reply: rawText.trim(), extracted: null }, withCors(req));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gemini request failed";
    return NextResponse.json({ error: message }, withCors(req, { status: 502 }));
  }
}

export async function OPTIONS(req: NextRequest): Promise<Response> {
  const origin = req.headers.get("origin");

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response(null, withCors(req, { status: 403 }));
  }

  return new Response(null, withCors(req, { status: 204 }));
}
