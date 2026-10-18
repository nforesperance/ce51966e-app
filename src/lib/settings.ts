import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUILT_IN_SETTINGS, resolveSettings, type AppSettings } from "@/lib/appDefaults";

/** Current app settings (deduped per request). Falls back to built-ins if unavailable. */
export const getAppSettings = cache(async (): Promise<AppSettings> => {
  const { data, error } = await supabaseAdmin()
    .from("app_settings").select("value").eq("id", "global").maybeSingle();
  if (error) {
    console.error("app_settings unavailable, using built-in defaults:", error.message);
    return BUILT_IN_SETTINGS;
  }
  return resolveSettings(data?.value);
});
