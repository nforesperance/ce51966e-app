import { getAppSettings } from "@/lib/settings";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  return <SettingsClient initial={await getAppSettings()} />;
}
