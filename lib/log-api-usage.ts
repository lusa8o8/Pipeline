import { createClient } from "@/lib/supabase/server";

export async function logApiUsage({
  userId,
  endpoint,
  usage,
}: {
  userId: string;
  endpoint: string;
  usage: { input_tokens: number; output_tokens: number };
}) {
  const supabase = createClient();

  await supabase.from("api_usage").insert({
    user_id: userId,
    endpoint,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  });
}

