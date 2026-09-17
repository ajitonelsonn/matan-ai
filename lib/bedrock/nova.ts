import "server-only";
import { ConverseCommand, type ConverseCommandInput, type ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { BEDROCK_MODEL_ID, getBedrockClient, isBedrockConfigured } from "./client";
import { MATAN_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/matan/prompts";
import { extractJson, validateAnalysis, MatanSchemaError, type MatanAIAnalysis } from "@/lib/matan/schema";
import { MatanAiError, fromAwsError } from "@/lib/matan/errors";
import { recordUsage } from "@/lib/matan/budget";

export type NovaMedia =
  | { kind: "image"; image: Uint8Array; format: "jpeg" | "png" | "webp" | "gif" }
  | { kind: "video"; video: Uint8Array; format: "mp4" | "mov" | "webm" | "mkv"; durationSeconds?: number };

export interface NovaAnalysisInput {
  /** Application-built context (already reduced to relevant fields). */
  context: Record<string, unknown>;
  media?: NovaMedia | null;
}

export interface NovaAnalysisResult {
  analysis: MatanAIAnalysis;
  model: string;
  mediaAnalyzed: boolean;
  usage?: { inputTokens?: number; outputTokens?: number };
  latencyMs: number;
}

/** Injectable invoker so the pipeline can be unit-tested without AWS. */
export type ConverseInvoker = (input: ConverseCommandInput) => Promise<ConverseCommandOutput>;

const defaultInvoker: ConverseInvoker = async (input) => {
  const client = getBedrockClient();
  return client.send(new ConverseCommand(input), { abortSignal: AbortSignal.timeout(25_000) });
};

/**
 * Invoke Amazon Nova Pro through the Bedrock Converse API and return a
 * validated structured interpretation. Throws MatanAiError on any failure.
 */
export async function analyzeWithNova(input: NovaAnalysisInput, invoke: ConverseInvoker = defaultInvoker): Promise<NovaAnalysisResult> {
  if (invoke === defaultInvoker && !isBedrockConfigured()) throw new MatanAiError("MATAN_AI_CONFIGURATION_ERROR");

  const hasMedia = Boolean(input.media);
  const isVideo = input.media?.kind === "video";
  const content: NonNullable<ConverseCommandInput["messages"]>[number]["content"] = [];
  if (input.media?.kind === "image") content.push({ image: { format: input.media.format, source: { bytes: input.media.image } } });
  if (input.media?.kind === "video") content.push({ video: { format: input.media.format, source: { bytes: input.media.video } } });
  content.push({ text: buildUserPrompt(JSON.stringify(input.context, null, 2), hasMedia, isVideo) });

  const command: ConverseCommandInput = {
    modelId: BEDROCK_MODEL_ID,
    system: [{ text: MATAN_SYSTEM_PROMPT }],
    messages: [{ role: "user", content }],
    inferenceConfig: { maxTokens: 700, temperature: 0.2, topP: 0.9 },
  };
  if (isVideo) console.info({ event: "matan_ai_video_call", model: BEDROCK_MODEL_ID, bytes: (input.media as { video: Uint8Array }).video.byteLength, durationSeconds: (input.media as { durationSeconds?: number }).durationSeconds });

  const started = Date.now();
  let output: ConverseCommandOutput;
  try {
    output = await invoke(command);
  } catch (e) {
    const err = fromAwsError(e);
    console.error({ event: "matan_ai_bedrock_error", model: BEDROCK_MODEL_ID, code: err.code, awsError: (e as { name?: string })?.name, detail: e instanceof Error ? e.message.slice(0, 200) : undefined });
    throw err;
  }
  const latencyMs = Date.now() - started;
  recordUsage(output.usage?.inputTokens ?? 0, output.usage?.outputTokens ?? 0, isVideo);

  const text = (output.output?.message?.content ?? [])
    .map((c) => ("text" in c && typeof c.text === "string" ? c.text : ""))
    .join("\n")
    .trim();
  if (!text) throw new MatanAiError("MATAN_AI_INVALID_RESPONSE", "Nova returned an empty response.");

  try {
    const analysis = validateAnalysis(extractJson(text));
    return {
      analysis,
      model: BEDROCK_MODEL_ID,
      mediaAnalyzed: hasMedia,
      usage: { inputTokens: output.usage?.inputTokens, outputTokens: output.usage?.outputTokens },
      latencyMs,
    };
  } catch (e) {
    if (e instanceof MatanSchemaError) {
      console.error({ event: "matan_ai_invalid_response", model: BEDROCK_MODEL_ID, reason: e.message });
      throw new MatanAiError("MATAN_AI_INVALID_RESPONSE", `Nova's answer didn't match the Matan schema (${e.message}).`);
    }
    throw e;
  }
}
