"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function sanitize(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function LoginForm() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Fallback poll: some mobile IMEs don't fire onChange/onInput reliably.
  useEffect(() => {
    const iv = setInterval(() => {
      const v = sanitize(inputRef.current?.value ?? "");
      if (v !== key) setKey(v);
    }, 200);
    return () => clearInterval(iv);
  }, [key]);

  async function attempt() {
    const clean = sanitize(inputRef.current?.value ?? key);
    if (clean.length < 4) { setError("Enter at least 4 characters"); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: clean }),
      });
      let json: { error?: string; redirect?: string } = {};
      try { json = await res.json(); } catch {}
      if (!res.ok) { setError(json.error ?? `HTTP ${res.status}`); return; }
      router.replace(json.redirect || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || key.length < 4;

  return (
    <form onSubmit={(e) => { e.preventDefault(); attempt(); }} className="space-y-4">
      <input
        ref={inputRef}
        autoFocus
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        maxLength={12}
        defaultValue=""
        onChange={(e) => setKey(sanitize(e.target.value))}
        onInput={(e) => setKey(sanitize((e.target as HTMLInputElement).value))}
        placeholder="ABCD"
        enterKeyHint="go"
        className="input text-center text-2xl tracking-[0.4em] font-semibold"
      />
      {error && <p className="text-[color:var(--danger)] text-sm text-center">{error}</p>}
      <button
        type="submit"
        onClick={(e) => { e.preventDefault(); attempt(); }}
        disabled={disabled}
        className="btn-gold w-full"
        style={disabled ? { opacity: 0.4 } : undefined}
      >
        {loading ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
