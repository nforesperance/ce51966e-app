import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/today");
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="pill mx-auto mb-6">ELMOAN</div>
        <h1 className="text-2xl font-semibold tracking-wide mb-2">Enter your key</h1>
        <p className="text-fg-muted text-sm mb-8">
          Use the 4-character key sent to you on WhatsApp.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
