// supabase/functions/send-push-notification/index.ts
//
// Sends a push notification to one user via the Expo Push API.
// Called either:
//   (a) directly from client code right after an action (e.g. liking a gem),
//       authenticated with the user's session, or
//   (b) from a Postgres trigger via pg_net / Database Webhooks, authenticated
//       with the service_role key — this is how purely server-side events
//       (like "nearby gem added", which has no single acting user) should
//       call it.
//
// Respects notification_preferences (nearby/social/achievements toggles)
// and skips silently if the user has that category disabled.
//
// Deploy with: supabase functions deploy send-push-notification
// Env vars needed (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (usually auto-injected already)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type NotificationCategory = "nearby" | "social" | "achievements";

interface SendPushPayload {
  user_id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, unknown>; // should include `type` and relevant id for deep linking
}

const PREFERENCE_COLUMN: Record<NotificationCategory, string> = {
  nearby: "nearby_enabled",
  social: "social_enabled",
  achievements: "achievements_enabled",
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    const payload: SendPushPayload = await req.json();
    const { user_id, category, title, body, data } = payload;

    if (!user_id || !category || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, category, title, body" }),
        { status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check notification_preferences — skip silently if this category is off
    const prefColumn = PREFERENCE_COLUMN[category];
    const { data: prefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select(prefColumn)
      .eq("user_id", user_id)
      .maybeSingle();

    if (prefsError) {
      console.error("Failed to read notification_preferences:", prefsError);
      // Fail open (still attempt to send) rather than silently dropping
      // notifications due to a transient read error — adjust if you'd
      // rather fail closed.
    } else if (prefs && prefs[prefColumn as keyof typeof prefs] === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `${category} notifications disabled for user` }),
        { status: 200 }
      );
    }
    // If no prefs row exists at all, default behavior is to send (matches
    // the DB default of all-true for new rows).

    // 2. Get this user's push tokens (could have multiple devices)
    const { data: tokenRows, error: tokenError } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", user_id);

    if (tokenError) {
      console.error("Failed to read push_tokens:", tokenError);
      return new Response(JSON.stringify({ error: "Failed to read push tokens" }), { status: 500 });
    }

    if (!tokenRows || tokenRows.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No push tokens registered for user" }),
        { status: 200 }
      );
    }

    // 3. Build Expo Push API messages — one per token/device
    const channelId = category; // matches the 3 Android channels created client-side
    const messages = tokenRows.map((row) => ({
      to: row.token,
      title,
      body,
      data: data ?? {},
      channelId,
      sound: "default",
      priority: category === "nearby" ? "high" : "default",
    }));

    // 4. Send to Expo Push API (batched in one call — Expo supports arrays)
    const expoResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    const expoResult = await expoResponse.json();

    // 5. Handle DeviceNotRegistered errors by cleaning up stale tokens
    if (Array.isArray(expoResult?.data)) {
      const staleTokens: string[] = [];
      expoResult.data.forEach((ticket: any, idx: number) => {
        if (ticket?.details?.error === "DeviceNotRegistered") {
          staleTokens.push(messages[idx].to);
        }
      });
      if (staleTokens.length > 0) {
        await supabase.from("push_tokens").delete().in("token", staleTokens);
        console.log(`Cleaned up ${staleTokens.length} stale push token(s)`);
      }
    }

    return new Response(JSON.stringify({ sent: messages.length, expoResult }), { status: 200 });
  } catch (err) {
    console.error("send-push-notification error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});