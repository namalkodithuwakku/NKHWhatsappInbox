"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Contact = { id: string; wa_id: string; phone: string; profile_name?: string | null; property_name?: string | null; client_status?: string };
type Conversation = { id: string; contact_id: string; contact: Contact; status: "Open" | "Waiting" | "Follow-up" | "Closed"; assigned_to?: string | null; label: string; unread_count: number; last_message_preview?: string | null; last_message_at?: string | null; customer_window_expires_at?: string | null };
type Message = { id: string; direction: "incoming" | "outgoing"; body?: string | null; message_type: string; delivery_status: string; sent_by?: string | null; created_at: string; meta_timestamp?: string | null };

function initials(value?: string | null) { return (value || "WA").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function timeLabel(value?: string | null) { if (!value) return ""; const date = new Date(value); const today = new Date(); return date.toDateString() === today.toDateString() ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString([], { month: "short", day: "numeric" }); }

export default function Home() {
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  const [sending, setSending] = useState(false);
  const active = conversations.find((item) => item.id === activeId) ?? null;

  const showToast = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); }, []);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/inbox/conversations", { cache: "no-store" });
    if (response.status === 401) { setAuth("out"); return; }
    const data = await response.json();
    if (!response.ok) { showToast(data.error || "Unable to load inbox"); return; }
    setConversations(data.conversations || []);
    setActiveId((current) => current || data.conversations?.[0]?.id || null);
  }, [showToast]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/inbox/messages?conversation_id=${encodeURIComponent(conversationId)}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setMessages(data.messages || []);
  }, []);

  useEffect(() => { fetch("/api/inbox/auth/session").then((r) => r.json()).then((data) => setAuth(data.authenticated ? "in" : "out")).catch(() => setAuth("out")); }, []);
  useEffect(() => { if (auth !== "in") return; const initial = window.setTimeout(loadConversations, 0); const timer = window.setInterval(loadConversations, 5000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [auth, loadConversations]);
  useEffect(() => { if (!activeId || auth !== "in") return; const initial = window.setTimeout(() => loadMessages(activeId), 0); const timer = window.setInterval(() => loadMessages(activeId), 4000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [activeId, auth, loadMessages]);

  const visible = useMemo(() => conversations.filter((item) => {
    const contact = item.contact || {} as Contact;
    const matches = `${contact.profile_name || ""} ${contact.property_name || ""} ${contact.phone || ""}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter === "All" || item.status === filter);
  }), [conversations, filter, query]);

  async function login(event: FormEvent) {
    event.preventDefault(); setLoginError("");
    const response = await fetch("/api/inbox/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json();
    if (!response.ok) { setLoginError(data.error || "Unable to sign in"); return; }
    setPassword(""); setAuth("in");
  }

  async function logout() { await fetch("/api/inbox/auth/logout", { method: "POST" }); setConversations([]); setMessages([]); setAuth("out"); }

  async function updateConversation(patch: Partial<Conversation> & { property_name?: string }) {
    if (!activeId) return;
    setConversations((items) => items.map((item) => item.id === activeId ? { ...item, ...patch, contact: patch.property_name !== undefined ? { ...item.contact, property_name: patch.property_name } : item.contact } : item));
    const payload = { id: activeId, status: patch.status, assigned_to: patch.assigned_to, label: patch.label, unread_count: patch.unread_count, property_name: patch.property_name };
    const response = await fetch("/api/inbox/conversations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) showToast("Update failed");
  }

  async function selectConversation(id: string) { setActiveId(id); setMessages([]); const item = conversations.find((row) => row.id === id); if (item?.unread_count) { setConversations((rows) => rows.map((row) => row.id === id ? { ...row, unread_count: 0 } : row)); await fetch("/api/inbox/conversations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, unread_count: 0 }) }); } }

  async function sendMessage(event: FormEvent) {
    event.preventDefault(); if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    const response = await fetch("/api/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation_id: activeId, text: draft.trim(), sent_by: active?.assigned_to || "NKH Team" }) });
    const data = await response.json(); setSending(false);
    if (!response.ok) { showToast(data.error || "Message failed"); return; }
    setDraft(""); await Promise.all([loadMessages(activeId), loadConversations()]); showToast("Message sent");
  }

  async function saveNote() {
    if (!activeId || !note.trim()) return;
    const response = await fetch("/api/inbox/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation_id: activeId, note, created_by: active?.assigned_to || "NKH Team" }) });
    if (response.ok) { setNote(""); showToast("Internal note saved"); } else showToast("Note could not be saved");
  }

  if (auth === "loading") return <main className="login-screen"><div className="login-card"><div className="login-logo">N K <span>Hotels</span></div><p>Opening secure inbox…</p></div></main>;
  if (auth === "out") return <main className="login-screen"><form className="login-card" onSubmit={login}><div className="login-logo">N K <span>Hotels</span></div><p className="eyebrow">Marketing workspace</p><h1>WhatsApp Inbox</h1><p>Enter the team inbox password to continue.</p><label>Inbox password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required /></label>{loginError && <div className="login-error">{loginError}</div>}<button className="login-button">Open inbox</button><small>Private access for authorized N K Hotels staff</small></form></main>;

  return <main className="app-shell">
    <aside className="rail"><div className="brand-mark"><b>N K</b><span>Hotels</span></div><nav aria-label="Main navigation"><button title="Overview">⌂</button><button title="Tasks">✓</button><button className="selected" title="WhatsApp Inbox">✦</button><button title="Clients">♙</button></nav><button className="avatar" onClick={logout} title="Sign out">NK</button></aside>
    <section className="workspace"><header className="topbar"><div><p>Marketing</p><h1>WhatsApp Inbox</h1></div><div className="top-actions"><span className="connection"><i /> Live API</span><button className="ghost" onClick={logout}>Sign out</button><button className="primary">＋ New message</button></div></header>
      <div className="inbox-grid">
        <section className="conversation-list"><div className="list-tools"><label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients or properties" /></label><div className="filters">{["All", "Open", "Waiting", "Follow-up"].map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item}</button>)}</div></div>
          <div className="conversation-scroll">{visible.length === 0 ? <div className="empty-list"><b>No conversations yet</b><span>New WhatsApp messages will appear here.</span></div> : visible.map((item) => { const contact = item.contact || {} as Contact; const title = contact.property_name || contact.profile_name || contact.phone || "WhatsApp contact"; return <button key={item.id} className={`conversation ${activeId === item.id ? "active" : ""}`} onClick={() => selectConversation(item.id)}><div className="contact-avatar">{initials(title)}<span /></div><div className="conversation-copy"><div><strong>{title}</strong><time>{timeLabel(item.last_message_at)}</time></div><p>{contact.profile_name || contact.phone} · {item.label}</p><small>{item.last_message_preview || "New conversation"}</small></div>{item.unread_count > 0 && <b className="unread">{item.unread_count}</b>}</button>; })}</div>
        </section>
        <section className="chat-panel">{!active ? <div className="empty-chat"><div>✦</div><h2>Your WhatsApp inbox is connected</h2><p>Send a message to the business number to create the first conversation.</p></div> : <><header className="chat-head"><div className="contact-avatar large">{initials(active.contact?.property_name || active.contact?.profile_name)}<span /></div><div><h2>{active.contact?.property_name || active.contact?.profile_name || "WhatsApp contact"}</h2><p>{active.contact?.profile_name || "Unknown contact"} · +{active.contact?.phone}</p></div><button className="circle" title="More options">•••</button></header><div className="chat-body"><div className="day-label">Conversation</div>{messages.map((message) => <div key={message.id} className={`message-wrap ${message.direction === "outgoing" ? "team" : "client"}`}>{message.sent_by && <span className="sender">{message.sent_by}</span>}<div className="message">{message.body || `[${message.message_type}]`}<time>{timeLabel(message.meta_timestamp || message.created_at)} {message.direction === "outgoing" && (message.delivery_status === "read" ? "✓✓" : "✓")}</time></div></div>)}</div><form className="composer" onSubmit={sendMessage}><div className="reply-mode"><span>Replying as <b>N K Hotels</b></span><span>{active.customer_window_expires_at && new Date(active.customer_window_expires_at) > new Date() ? "Customer window open" : "Template may be required"}</span></div><div className="compose-row"><button type="button" className="attach">＋</button><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a reply…" rows={1} /><button className="send" disabled={sending}>{sending ? "…" : "➤"}</button></div></form></>}</section>
        <aside className="details-panel">{active && <><div className="client-hero"><div className="contact-avatar xl">{initials(active.contact?.profile_name)}</div><h3>{active.contact?.profile_name || "WhatsApp contact"}</h3><p>{active.contact?.property_name || "Property not linked"}</p><span className="client-badge">{active.contact?.client_status || "Unknown"}</span></div><div className="detail-section"><h4>Conversation</h4><label>Status<select value={active.status} onChange={(e) => updateConversation({ status: e.target.value as Conversation["status"] })}><option>Open</option><option>Waiting</option><option>Follow-up</option><option>Closed</option></select></label><label>Assigned to<select value={active.assigned_to || ""} onChange={(e) => updateConversation({ assigned_to: e.target.value })}><option value="">Unassigned</option><option>Gayan</option><option>Visun</option><option>Hasitha</option><option>Namal</option></select></label><label>Label<select value={active.label} onChange={(e) => updateConversation({ label: e.target.value })}><option>Client Support</option><option>Existing Client</option><option>Lead</option><option>Payment</option><option>Renewal</option></select></label></div><div className="detail-section"><h4>Client information</h4><label>Property name<input className="detail-input" value={active.contact?.property_name || ""} onChange={(e) => setConversations((rows) => rows.map((row) => row.id === active.id ? { ...row, contact: { ...row.contact, property_name: e.target.value } } : row))} onBlur={(e) => updateConversation({ property_name: e.target.value })} /></label><dl><div><dt>WhatsApp</dt><dd>+{active.contact?.phone}</dd></div><div><dt>Account</dt><dd><span className="dot" /> Active</dd></div></dl></div><div className="detail-section notes"><h4>Internal note <span>Private</span></h4><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for your team…" /><button onClick={saveNote}>Save note</button></div></>}</aside>
      </div>
    </section>{toast && <div className="toast">✓ {toast}</div>}
  </main>;
}
