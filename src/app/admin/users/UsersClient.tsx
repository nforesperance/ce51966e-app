"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Pencil, Trash2, Plus, Upload, X, Check, Search } from "lucide-react";
import { csvToUsers } from "@/lib/csv";

type User = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  level: string | null;
  active: boolean;
  login_key_hint: string | null;
  created_at: string;
  last_login_at: string | null;
};

type KeyReveal = { name: string; key: string; whatsapp: string | null };

function whatsappMessage(name: string, key: string) {
  return `Hi ${name.split(" ")[0]}, welcome to the 21-day prayer training.\n\nYour personal login key is: *${key}*\n\nOpen the app and enter this 4-character key to sign in. Keep it private — do not share.`;
}

function waHref(phone: string | null | undefined, text: string) {
  const clean = (phone || "").replace(/[^0-9]/g, "");
  const enc = encodeURIComponent(text);
  return clean ? `https://wa.me/${clean}?text=${enc}` : `https://wa.me/?text=${enc}`;
}

export default function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [reveal, setReveal] = useState<KeyReveal[] | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.full_name, u.phone, u.whatsapp, u.level].some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [users, query]);

  async function createUser(body: { full_name: string; phone: string; whatsapp: string; level: string }) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? "Failed"); return; }
      setUsers((u) => [{ ...j.user, last_login_at: null }, ...u]);
      setReveal([{ name: j.user.full_name, key: j.login_key, whatsapp: j.user.whatsapp }]);
      setNewOpen(false);
    } finally { setBusy(false); }
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); return; }
    setUsers((u) => u.filter((x) => x.id !== id));
  }

  async function resetKey(u: User) {
    if (!confirm(`Reset login key for ${u.full_name}? Their old key will stop working immediately.`)) return;
    const res = await fetch(`/api/admin/users/${u.id}/reset-key`, { method: "POST" });
    const j = await res.json();
    if (!res.ok) { alert(j.error ?? "Failed"); return; }
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, login_key_hint: j.login_key[0] + "***" } : x)));
    setReveal([{ name: u.full_name, key: j.login_key, whatsapp: u.whatsapp }]);
  }

  async function saveEdit(u: User, patch: Partial<User>) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    const j = await res.json();
    if (!res.ok) { alert(j.error ?? "Failed"); return; }
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, ...j.user } : x)));
    setEditing(null);
  }

  async function handleCsv(text: string) {
    const { rows, errors } = csvToUsers(text);
    if (errors.length) { alert(errors.join("\n")); return; }
    if (!rows.length) { alert("No rows found"); return; }
    if (!confirm(`Import ${rows.length} user(s)?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }),
      });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? "Failed"); return; }
      setCsvOpen(false);
      router.refresh();
      setReveal(j.created.map((c: { full_name: string; login_key: string; whatsapp: string | null }) => ({
        name: c.full_name, key: c.login_key, whatsapp: c.whatsapp,
      })));
      if (j.failed?.length) alert(`${j.failed.length} row(s) failed — see console.`);
      if (j.failed?.length) console.warn("CSV failed rows:", j.failed);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Users</h1>
        <div className="flex gap-2">
          <button onClick={() => setCsvOpen(true)} className="btn-ghost flex items-center gap-2 text-sm">
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={() => setNewOpen(true)} className="btn-gold flex items-center gap-2 text-sm">
            <Plus size={15} /> Add user
          </button>
        </div>
      </div>

      <div className="card p-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Search size={15} />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, level…"
            className="bg-transparent outline-none flex-1 text-fg placeholder:text-fg-muted"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-fg-muted border-b border-[color:var(--border)]">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Level</th>
                <th className="py-3 px-4">WhatsApp</th>
                <th className="py-3 px-4">Key</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 w-40"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-fg-muted">
                  No users yet. Add one or import a CSV.
                </td></tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-[color:var(--border)] last:border-0">
                  <td className="py-3 px-4">{u.full_name}</td>
                  <td className="py-3 px-4 text-fg-muted">{u.level ?? "—"}</td>
                  <td className="py-3 px-4 text-fg-muted">{u.whatsapp ?? u.phone ?? "—"}</td>
                  <td className="py-3 px-4 font-mono text-gold">{u.login_key_hint ?? "—"}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${u.active ? "border-[color:var(--ok)] text-[color:var(--ok)]" : "border-[color:var(--danger)] text-[color:var(--danger)]"}`}>
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => resetKey(u)} title="Reset key" className="text-fg-muted hover:text-gold"><KeyRound size={15} /></button>
                      <button onClick={() => setEditing(u)} title="Edit" className="text-fg-muted hover:text-gold"><Pencil size={15} /></button>
                      <button onClick={() => deleteUser(u.id, u.full_name)} title="Delete" className="text-fg-muted hover:text-[color:var(--danger)]"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {newOpen && <NewUserDialog busy={busy} onClose={() => setNewOpen(false)} onSubmit={createUser} />}
      {csvOpen && <CsvDialog busy={busy} onClose={() => setCsvOpen(false)} onSubmit={handleCsv} />}
      {editing && <EditDialog user={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
      {reveal && <RevealDialog entries={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

// ---------- Dialogs ----------

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewUserDialog({ busy, onClose, onSubmit }: {
  busy: boolean; onClose: () => void;
  onSubmit: (b: { full_name: string; phone: string; whatsapp: string; level: string }) => void;
}) {
  const [f, setF] = useState({ full_name: "", phone: "", whatsapp: "", level: "" });
  return (
    <Modal title="Add user" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        <div>
          <label className="label block mb-1">Full name</label>
          <input required className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1">Phone</label>
            <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </div>
          <div>
            <label className="label block mb-1">WhatsApp</label>
            <input className="input" placeholder="+237…" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label block mb-1">Level</label>
          <input className="input" placeholder="1, beginner, etc." value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button disabled={busy || !f.full_name} className="btn-gold text-sm">{busy ? "Creating…" : "Create & show key"}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditDialog({ user, onClose, onSave }: {
  user: User; onClose: () => void; onSave: (u: User, patch: Partial<User>) => void;
}) {
  const [f, setF] = useState({
    full_name: user.full_name, phone: user.phone ?? "", whatsapp: user.whatsapp ?? "",
    level: user.level ?? "", active: user.active,
  });
  return (
    <Modal title={`Edit ${user.full_name}`} onClose={onClose}>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSave(user, {
          full_name: f.full_name, phone: f.phone || null, whatsapp: f.whatsapp || null,
          level: f.level || null, active: f.active,
        });
      }} className="space-y-3">
        <div><label className="label block mb-1">Full name</label>
          <input required className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label block mb-1">Phone</label>
            <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><label className="label block mb-1">WhatsApp</label>
            <input className="input" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></div>
        </div>
        <div><label className="label block mb-1">Level</label>
          <input className="input" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm pt-1">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          Active
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button className="btn-gold text-sm">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function CsvDialog({ busy, onClose, onSubmit }: {
  busy: boolean; onClose: () => void; onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <Modal title="Import users (CSV)" onClose={onClose}>
      <p className="text-sm text-fg-muted mb-3">
        Columns: <code>name</code> (required), <code>phone</code>, <code>whatsapp</code>, <code>level</code>. First row must be the header.
      </p>
      <input
        type="file" accept=".csv,text/csv" className="mb-3 text-sm"
        onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          setText(await f.text());
        }}
      />
      <textarea
        rows={8} className="input font-mono text-xs"
        placeholder={"name,phone,whatsapp,level\nJohn Doe,,+237670000000,1"}
        value={text} onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-4">
        <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
        <button disabled={busy || !text.trim()} onClick={() => onSubmit(text)} className="btn-gold text-sm">
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
    </Modal>
  );
}

function RevealDialog({ entries, onClose }: { entries: KeyReveal[]; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(text: string, tag: string) {
    await navigator.clipboard.writeText(text);
    setCopied(tag); setTimeout(() => setCopied(null), 1200);
  }
  return (
    <Modal title={entries.length > 1 ? `${entries.length} keys — share once` : "Share login key"} onClose={onClose}>
      <p className="text-sm text-fg-muted mb-4">
        These keys are shown <strong className="text-gold">only once</strong>. Copy them or open WhatsApp now. You can always reset a key later, which invalidates the old one.
      </p>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        {entries.map((e, i) => {
          const msg = whatsappMessage(e.name, e.key);
          return (
            <div key={i} className="border border-[color:var(--border)] rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">{e.name}</div>
                <div className="font-mono text-lg text-gold tracking-[0.3em]">{e.key}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copy(e.key, "k" + i)} className="btn-ghost text-xs flex items-center gap-1">
                  {copied === "k" + i ? <Check size={13} /> : <Copy size={13} />} Copy key
                </button>
                <button onClick={() => copy(msg, "m" + i)} className="btn-ghost text-xs flex items-center gap-1">
                  {copied === "m" + i ? <Check size={13} /> : <Copy size={13} />} Copy message
                </button>
                <a href={waHref(e.whatsapp, msg)} target="_blank" rel="noreferrer" className="btn-gold text-xs">
                  Open WhatsApp
                </a>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end pt-4">
        <button onClick={onClose} className="btn-gold text-sm">Done</button>
      </div>
    </Modal>
  );
}
