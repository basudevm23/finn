import { usage, MODELS, hasKey } from '@/lib/gemini';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({ ...usage, models: MODELS, llm: hasKey() });
}
