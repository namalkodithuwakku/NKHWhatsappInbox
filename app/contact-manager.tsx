"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Contact = { id?: string; phone: string; name_prefix?: string | null; contact_name?: string | null; job_position?: string | null; is_active?: boolean; notes?: string | null };
type Property = { id?: string; client_code: string; property_name: string; preferred_language: string; client_status: string; package_name?: string | null; notes?: string | null; contacts: Contact[] };

const emptyProperty = (): Property => ({ client_code: "", property_name: "", preferred_language: "English", client_status: "Active", package_name: "", notes: "", contacts: [{ phone: "", name_prefix: "", contact_name: "", job_position: "", is_active: true, notes: "" }] });

<<<<<<< HEAD
export default function ContactManager({ role, onClose, onSaved }: { role: "ADMIN" | "TEAM"; onClose: () => void; onSaved: () => void }) {
=======
export default function ContactManager({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
>>>>>>> ca9629391a316b7c3a31c127fc87b8e25b301d26
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
  function addNumber() { setForm((current) => ({ ...current, contacts: [...current.contacts, { phone: "", name_prefix: "", contact_name: "", job_position: "", is_active: true, notes: "" }] })); }
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

<<<<<<< HEAD
  async function deleteProperty() {
    if (role !== "ADMIN" || !form.id) return;
    const confirmation = window.prompt(`Permanently delete ${form.property_name} and its contacts/conversations?\n\nType DELETE to confirm.`);
    if (confirmation !== "DELETE") return;
    setSaving(true); setError("");
    const response = await fetch(`/api/inbox/properties?id=${encodeURIComponent(form.id)}`, { method: "DELETE" });
    const data = await response.json(); setSaving(false);
    if (!response.ok) { setError(data.error || "Unable to delete property"); return; }
    setForm(emptyProperty()); await load(); onSaved();
  }

=======
>>>>>>> ca9629391a316b7c3a31c127fc87b8e25b301d26
  return <div className="contact-overlay" role="dialog" aria-modal="true" aria-label="Manage property contacts">
    <div className="contact-modal">
      <header className="contact-modal-head"><div><p>NKH client directory</p><h2>Manage Contacts</h2></div><button onClick={onClose} aria-label="Close">×</button></header>
      <div className="contact-layout">
        <aside className="property-list"><label className="contact-search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search NKH001 or property" /></label><button className="new-property" onClick={() => { setForm(emptyProperty()); setError(""); }}>＋ Add property</button><div>{loading ? <p className="contact-muted">Loading…</p> : filtered.map((property) => <button key={property.id} className={form.id === property.id ? "active" : ""} onClick={() => { setForm({ ...property, contacts: property.contacts.length ? property.contacts : [{ phone: "", is_active: true }] }); setError(""); }}><b>{property.client_code}</b><span>{property.property_name}</span><small>{property.contacts.length} number{property.contacts.length === 1 ? "" : "s"}</small></button>)}</div></aside>
        <form className="property-form" onSubmit={save}>
          <section className="property-fields"><label>Client code<input value={form.client_code} onChange={(event) => setForm({ ...form, client_code: event.target.value.toUpperCase() })} placeholder="NKH001" required /></label><label>Property name<input value={form.property_name} onChange={(event) => setForm({ ...form, property_name: event.target.value })} placeholder="Oshin Villa" required /></label><label>Preferred language<select value={form.preferred_language} onChange={(event) => setForm({ ...form, preferred_language: event.target.value })}><option>English</option><option>Sinhala</option><option>Singlish</option><option>Tamil</option></select></label><label>Client status<select value={form.client_status} onChange={(event) => setForm({ ...form, client_status: event.target.value })}><option>Active</option><option>Lead</option><option>Former</option><option>Inactive</option></select></label><label className="wide">Package<input value={form.package_name || ""} onChange={(event) => setForm({ ...form, package_name: event.target.value })} placeholder="OTA Management" /></label></section>
          <div className="numbers-title"><div><h3>WhatsApp numbers</h3><p>Add the people who may contact N K Hotels for this property.</p></div><button type="button" onClick={addNumber}>＋ Add number</button></div>
          <div className="number-list">{form.contacts.map((contact, index) => <section className="number-card" key={contact.id || index}><div className="number-card-head"><div><b>Contact {index + 1}</b><small>WhatsApp contact details</small></div><label className="active-toggle"><input type="checkbox" checked={contact.is_active !== false} onChange={(event) => updateContact(index, { is_active: event.target.checked })} /> Active contact</label></div><div className="number-grid"><label className="phone-field">WhatsApp number<input value={contact.phone || ""} onChange={(event) => updateContact(index, { phone: event.target.value })} placeholder="+94771234567" required /></label><label className="prefix-field">Prefix <span>Optional</span><select value={contact.name_prefix || ""} onChange={(event) => updateContact(index, { name_prefix: event.target.value })}><option value="">No prefix</option><option>Mr</option><option>Ms</option><option>Mrs</option><option>Dr</option><option>Rev</option></select></label><label className="name-field">Contact name <span>Optional</span><input value={contact.contact_name || ""} onChange={(event) => updateContact(index, { contact_name: event.target.value })} placeholder="Ranjith" /></label><label className="position-field">Position <span>Optional</span><input value={contact.job_position || ""} onChange={(event) => updateContact(index, { job_position: event.target.value })} placeholder="Manager" /></label></div>{form.contacts.length > 1 && <button className="remove-number" type="button" onClick={() => removeNumber(index)}>Remove number</button>}</section>)}</div>
          {error && <div className="contact-error">{error}</div>}
<<<<<<< HEAD
          <footer className="contact-actions">{role === "ADMIN" && form.id && <button className="delete-property" type="button" onClick={deleteProperty} disabled={saving}>Delete property</button>}<span className="contact-action-spacer" /><button type="button" onClick={onClose}>Cancel</button><button className="save-property" disabled={saving}>{saving ? "Saving…" : "Save property contacts"}</button></footer>
=======
          <footer className="contact-actions"><button type="button" onClick={onClose}>Cancel</button><button className="save-property" disabled={saving}>{saving ? "Saving…" : "Save property contacts"}</button></footer>
>>>>>>> ca9629391a316b7c3a31c127fc87b8e25b301d26
        </form>
      </div>
    </div>
  </div>;
}
