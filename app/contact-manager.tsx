"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Contact = { id?: string; phone: string; contact_name?: string | null; job_position?: string | null; is_active?: boolean; notes?: string | null };
type Property = { id?: string; client_code: string; property_name: string; preferred_language: string; client_status: string; package_name?: string | null; notes?: string | null; contacts: Contact[] };

const emptyProperty = (): Property => ({ client_code: "", property_name: "", preferred_language: "English", client_status: "Active", package_name: "", notes: "", contacts: [{ phone: "", contact_name: "", job_position: "", is_active: true, notes: "" }] });

export default function ContactManager({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState<Property>(emptyProperty());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/inbox/properties", { cache: "no-store" });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) { setError(data.error || "Unable to load contacts"); return; }
    setProperties(data.properties || []);
  }

  useEffect(() => { const timer = window.setTimeout(load, 0); return () => window.clearTimeout(timer); }, []);
  const filtered = useMemo(() => properties.filter((property) => `${property.client_code} ${property.property_name}`.toLowerCase().includes(search.toLowerCase())), [properties, search]);

  function updateContact(index: number, patch: Partial<Contact>) { setForm((current) => ({ ...current, contacts: current.contacts.map((contact, contactIndex) => contactIndex === index ? { ...contact, ...patch } : contact) })); }
  function addNumber() { setForm((current) => ({ ...current, contacts: [...current.contacts, { phone: "", contact_name: "", job_position: "", is_active: true, notes: "" }] })); }
  function removeNumber(index: number) { setForm((current) => ({ ...current, contacts: current.contacts.length === 1 ? current.contacts : current.contacts.filter((_, contactIndex) => contactIndex !== index) })); }

  async function save(event: FormEvent) {
    event.preventDefault(); setError(""); setSaving(true);
    const response = await fetch("/api/inbox/properties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) { setError(data.error || "Unable to save property"); return; }
    await load(); onSaved();
    const saved = { ...form, id: data.property_id };
    setForm(saved);
  }

  return <div className="contact-overlay" role="dialog" aria-modal="true" aria-label="Manage property contacts">
    <div className="contact-modal">
      <header className="contact-modal-head"><div><p>NKH client directory</p><h2>Manage Contacts</h2></div><button onClick={onClose} aria-label="Close">×</button></header>
      <div className="contact-layout">
        <aside className="property-list"><label className="contact-search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search NKH001 or property" /></label><button className="new-property" onClick={() => { setForm(emptyProperty()); setError(""); }}>＋ Add property</button><div>{loading ? <p className="contact-muted">Loading…</p> : filtered.map((property) => <button key={property.id} className={form.id === property.id ? "active" : ""} onClick={() => { setForm({ ...property, contacts: property.contacts.length ? property.contacts : [{ phone: "", is_active: true }] }); setError(""); }}><b>{property.client_code}</b><span>{property.property_name}</span><small>{property.contacts.length} number{property.contacts.length === 1 ? "" : "s"}</small></button>)}</div></aside>
        <form className="property-form" onSubmit={save}>
          <section className="property-fields"><label>Client code<input value={form.client_code} onChange={(event) => setForm({ ...form, client_code: event.target.value.toUpperCase() })} placeholder="NKH001" required /></label><label>Property name<input value={form.property_name} onChange={(event) => setForm({ ...form, property_name: event.target.value })} placeholder="Oshin Villa" required /></label><label>Preferred language<select value={form.preferred_language} onChange={(event) => setForm({ ...form, preferred_language: event.target.value })}><option>English</option><option>Sinhala</option><option>Singlish</option><option>Tamil</option></select></label><label>Client status<select value={form.client_status} onChange={(event) => setForm({ ...form, client_status: event.target.value })}><option>Active</option><option>Lead</option><option>Former</option><option>Inactive</option></select></label><label className="wide">Package<input value={form.package_name || ""} onChange={(event) => setForm({ ...form, package_name: event.target.value })} placeholder="OTA Management" /></label></section>
          <div className="numbers-title"><div><h3>WhatsApp numbers</h3><p>Add the people who may contact N K Hotels for this property.</p></div><button type="button" onClick={addNumber}>＋ Add number</button></div>
          <div className="number-list">{form.contacts.map((contact, index) => <section className="number-card" key={contact.id || index}><div className="number-card-head"><b>Contact {index + 1}</b><label className="active-toggle"><input type="checkbox" checked={contact.is_active !== false} onChange={(event) => updateContact(index, { is_active: event.target.checked })} /> Active</label></div><div className="number-grid"><label>WhatsApp number<input value={contact.phone || ""} onChange={(event) => updateContact(index, { phone: event.target.value })} placeholder="+94771234567" required /></label><label>Contact name <span>Optional</span><input value={contact.contact_name || ""} onChange={(event) => updateContact(index, { contact_name: event.target.value })} placeholder="Ranjith" /></label><label>Position <span>Optional</span><input value={contact.job_position || ""} onChange={(event) => updateContact(index, { job_position: event.target.value })} placeholder="Manager" /></label></div>{form.contacts.length > 1 && <button className="remove-number" type="button" onClick={() => removeNumber(index)}>Remove number</button>}</section>)}</div>
          {error && <div className="contact-error">{error}</div>}
          <footer className="contact-actions"><button type="button" onClick={onClose}>Cancel</button><button className="save-property" disabled={saving}>{saving ? "Saving…" : "Save property contacts"}</button></footer>
        </form>
      </div>
    </div>
  </div>;
}
