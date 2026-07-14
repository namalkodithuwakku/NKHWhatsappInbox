"use client";

import { FormEvent, useMemo, useState } from "react";

type Conversation = {
  id: number;
  initials: string;
  name: string;
  property: string;
  phone: string;
  preview: string;
  time: string;
  unread: number;
  status: "Open" | "Waiting" | "Follow-up" | "Closed";
  assignee: string;
  label: string;
  messages: { from: "client" | "team"; text: string; time: string; sender?: string }[];
};

const seed: Conversation[] = [
  { id: 1, initials: "PR", name: "Kasun Perera", property: "Palmera Eco Resort", phone: "+94 77 418 2290", preview: "Can you check why our Booking.com rates…", time: "10:42", unread: 2, status: "Open", assignee: "Visun", label: "Client support", messages: [
    { from: "client", text: "Good morning. Our Booking.com weekend rates are showing lower than the rate plan we sent yesterday.", time: "10:31" },
    { from: "team", text: "Good morning Kasun. I’m checking the rate plan and promotion settings now.", time: "10:35", sender: "Visun" },
    { from: "client", text: "Thank you. Can you also check why the Genius discount is applying on the family room?", time: "10:42" },
  ]},
  { id: 2, initials: "SV", name: "Nadeesha Silva", property: "Serenity Villa Mirissa", phone: "+94 71 620 1184", preview: "We received a new direct booking…", time: "09:18", unread: 0, status: "Waiting", assignee: "Gayan", label: "Existing client", messages: [
    { from: "client", text: "We received a new direct booking for 18–20 July. Please close those dates on OTAs.", time: "09:12" },
    { from: "team", text: "Received. Please send the guest name and room category and we’ll update the channels.", time: "09:18", sender: "Gayan" },
  ]},
  { id: 3, initials: "CH", name: "Tharindu Jayasinghe", property: "Cinnamon Hill Retreat", phone: "+94 76 889 3301", preview: "Please send the new package details.", time: "Yesterday", unread: 0, status: "Follow-up", assignee: "Hasitha", label: "Lead", messages: [
    { from: "client", text: "Please send the new package details. We’re considering your OTA management service.", time: "Yesterday" },
  ]},
  { id: 4, initials: "BV", name: "Ruwani Fernando", property: "Blue Wave Villa", phone: "+94 75 104 7792", preview: "Invoice received, will arrange payment.", time: "Mon", unread: 0, status: "Closed", assignee: "Visun", label: "Payment", messages: [
    { from: "client", text: "Invoice received, will arrange payment before Friday.", time: "Mon" },
    { from: "team", text: "Thank you, Ruwani. Please share the transfer slip once completed.", time: "Mon", sender: "Visun" },
  ]},
];

const Icon = ({ children }: { children: React.ReactNode }) => <span className="icon" aria-hidden>{children}</span>;

export default function Home() {
  const [conversations, setConversations] = useState(seed);
  const [activeId, setActiveId] = useState(1);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const active = conversations.find((item) => item.id === activeId) ?? conversations[0];
  const visible = useMemo(() => conversations.filter((item) => {
    const matches = `${item.name} ${item.property} ${item.phone}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter === "All" || item.status === filter);
  }), [conversations, filter, query]);

  function updateActive(patch: Partial<Conversation>) {
    setConversations((items) => items.map((item) => item.id === activeId ? { ...item, ...patch } : item));
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    updateActive({ messages: [...active.messages, { from: "team", text: draft.trim(), time: "Now", sender: "You" }], preview: draft.trim(), time: "Now" });
    setDraft("");
    setToast("Reply added to the conversation demo");
    window.setTimeout(() => setToast(""), 2400);
  }

  return (
    <main className="app-shell">
      <aside className="rail">
        <div className="brand-mark"><b>N K</b><span>Hotel OS</span></div>
        <nav aria-label="Main navigation">
          <button title="Overview"><Icon>⌂</Icon></button>
          <button title="Tasks"><Icon>✓</Icon></button>
          <button className="selected" title="Marketing inbox"><Icon>✦</Icon></button>
          <button title="Clients"><Icon>♙</Icon></button>
          <button title="Reports"><Icon>▥</Icon></button>
        </nav>
        <div className="avatar">NK</div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p>Marketing</p><h1>WhatsApp Inbox</h1></div>
          <div className="top-actions"><span className="connection"><i /> Demo mode</span><button className="ghost">Templates</button><button className="primary">＋ New message</button></div>
        </header>

        <div className="inbox-grid">
          <section className="conversation-list" aria-label="Conversations">
            <div className="list-tools">
              <label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients or properties" /></label>
              <div className="filters">{["All", "Open", "Waiting", "Follow-up"].map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item}{item === "Open" && <em>2</em>}</button>)}</div>
            </div>
            <div className="conversation-scroll">
              {visible.map((item) => <button key={item.id} className={`conversation ${activeId === item.id ? "active" : ""}`} onClick={() => { setActiveId(item.id); updateActive({ unread: 0 }); }}>
                <div className="contact-avatar">{item.initials}<span /></div>
                <div className="conversation-copy"><div><strong>{item.property}</strong><time>{item.time}</time></div><p>{item.name} · {item.label}</p><small>{item.preview}</small></div>
                {item.unread > 0 && <b className="unread">{item.unread}</b>}
              </button>)}
            </div>
          </section>

          <section className="chat-panel" aria-label={`Conversation with ${active.name}`}>
            <header className="chat-head">
              <div className="contact-avatar large">{active.initials}<span /></div>
              <div><h2>{active.property}</h2><p>{active.name} · {active.phone}</p></div>
              <button className="circle" title="Call">⌕</button><button className="circle" title="More options">•••</button>
            </header>
            <div className="chat-body">
              <div className="day-label">Today</div>
              {active.messages.map((message, index) => <div key={index} className={`message-wrap ${message.from}`}>
                {message.sender && <span className="sender">{message.sender}</span>}
                <div className="message">{message.text}<time>{message.time} {message.from === "team" && "✓✓"}</time></div>
              </div>)}
            </div>
            <form className="composer" onSubmit={sendMessage}>
              <div className="reply-mode"><span>Replying as <b>N K Hotels</b></span><span>WhatsApp customer window open</span></div>
              <div className="compose-row"><button type="button" className="attach" title="Attach file">＋</button><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a reply…" rows={1} /><button className="send" aria-label="Send reply">➤</button></div>
              <div className="compose-foot"><span>☺ &nbsp; ▣ &nbsp; Quick reply</span><span>Enter to send</span></div>
            </form>
          </section>

          <aside className="details-panel">
            <div className="client-hero"><div className="contact-avatar xl">{active.initials}</div><h3>{active.name}</h3><p>{active.property}</p><span className="client-badge">✓ Existing client</span></div>
            <div className="detail-section"><h4>Conversation</h4><label>Status<select value={active.status} onChange={(e) => updateActive({ status: e.target.value as Conversation["status"] })}><option>Open</option><option>Waiting</option><option>Follow-up</option><option>Closed</option></select></label><label>Assigned to<select value={active.assignee} onChange={(e) => updateActive({ assignee: e.target.value })}><option>Gayan</option><option>Visun</option><option>Hasitha</option><option>Namal</option></select></label><label>Label<select value={active.label} onChange={(e) => updateActive({ label: e.target.value })}><option>Client support</option><option>Existing client</option><option>Lead</option><option>Payment</option><option>Renewal</option></select></label></div>
            <div className="detail-section"><h4>Client information</h4><dl><div><dt>Phone</dt><dd>{active.phone}</dd></div><div><dt>Client since</dt><dd>March 2025</dd></div><div><dt>Package</dt><dd>OTA Management</dd></div><div><dt>Account status</dt><dd><span className="dot" /> Active</dd></div></dl><button className="full-button">Open client profile ↗</button></div>
            <div className="detail-section notes"><h4>Internal note <span>Private</span></h4><textarea placeholder="Add a note for your team…" /><button onClick={() => setToast("Internal note saved in demo mode")}>Save note</button></div>
          </aside>
        </div>
      </section>
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}
