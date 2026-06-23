// supabase/functions/notify-nearby-gem/index.ts
//
// Called when a new gem is created (wire this via a Database Webhook on
// INSERT into `gems`, configured in the Supabase Dashboard under
// Database > Webhooks — point it at this function's URL).
//
// Finds users whose last_known_lat/lng is within a radius of the new gem
// and calls send-push-notification for each. Uses a simple bounding-box +
// haversine filter in JS rather than a PostGIS query, since this project
// doesn't appear to use PostGIS — fine at current scale, revisit if the
// user base grows large enough that this becomes slow.
//
// Deploy with: supabase functions deploy notify-nearby-gem

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NEARBY_RADIUS_KM = 5; // adjust as desired
const MAX_LOCATION_AGE_HOURS = 72; // ignore stale last_known_location data

interface GemWebhookPayload {
  type: "INSERT";
  table: string;
  record: {
    id: string;
    title: string;
    latitude: number;
    longitude: number;
    user_id: string; // gem creator — don't notify them about their own gem
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  try {
    const payload: GemWebhookPayload = await req.json();
    const gem = payload.record;

    if (!gem?.latitude || !gem?.longitude) {
      return new Response(JSON.stringify({ skipped: true, reason: "Gem missing coordinates" }), {
        status: 200,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Rough bounding box first (cheap filter), then precise haversine in JS.
    // 1 degree latitude ≈ 111km; pad generously since longitude degrees
    // shrink at higher latitudes — this is an approximation, not exact.
    const latPad = NEARBY_RADIUS_KM / 111;
    const lngPad = NEARBY_RADIUS_KM / (111 * Math.cos((gem.latitude * Math.PI) / 180));

    const cutoff = new Date(Date.now() - MAX_LOCATION_AGE_HOURS * 60 * 60 * 1000).toISOString();

    const { data: nearbyCandidates, error } = await supabase
      .from("profiles")
      .select("id, last_known_lat, last_known_lng, last_known_at")
      .neq("id", gem.user_id) // don't notify the gem's own creator
      .gte("last_known_lat", gem.latitude - latPad)
      .lte("last_known_lat", gem.latitude + latPad)
      .gte("last_known_lng", gem.longitude - lngPad)
      .lte("last_known_lng", gem.longitude + lngPad)
      .gte("last_known_at", cutoff);

    if (error) {
      console.error("Failed to query nearby profiles:", error);
      return new Response(JSON.stringify({ error: "Failed to query nearby profiles" }), {
        status: 500,
      });
    }

    if (!nearbyCandidates || nearbyCandidates.length === 0) {
      return new Response(JSON.stringify({ notified: 0, reason: "No nearby users found" }), {
        status: 200,
      });
    }

    // Precise distance filter
    const toNotify = nearbyCandidates.filter(
      (p) =>
        p.last_known_lat != null &&
        p.last_known_lng != null &&
        haversineKm(p.last_known_lat, p.last_known_lng, gem.latitude, gem.longitude) <= NEARBY_RADIUS_KM
    );

    // Call send-push-notification for each nearby user
    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    const results = await Promise.allSettled(
      toNotify.map((p) =>
        fetch(sendPushUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            user_id: p.id,
            category: "nearby",
            title: "💎 New gem nearby",
            body: `${gem.title} was just added near you`,
            data: { type: "nearby_gem", gem_id: gem.id },
          }),
        })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;

    return new Response(
      JSON.stringify({ notified: succeeded, candidates: toNotify.length }),
      { status: 200 }
    );
  } catch (err) {
    console.error("notify-nearby-gem error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});