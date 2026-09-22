-- Approved NKH knowledge seeded from https://www.nkhotels.lk/
-- Reviewed against the public website on 2026-09-22.
-- Re-run only after clearing/reconciling duplicate seed entries.

alter table if exists public.nkh_knowledge_entries
  add column if not exists source_url text;

insert into public.nkh_knowledge_entries
  (scope, title, content, owner, approval_status, source_url, last_updated_at, tags)
values
  ('company', 'NKH company overview',
   'N K Hotels (PVT) LTD is a Sri Lankan hospitality growth partner helping hotels, villas and resorts strengthen online presence, improve OTA performance, manage reservations professionally and grow revenue through a connected hospitality support ecosystem. The website states 8+ years experience, 40+ partner properties, 18+ destinations and 250+ OTA projects.',
   'Management', 'approved', 'https://www.nkhotels.lk/', now(), array['company','about']),
  ('sales', 'Service ecosystem',
   'N K Hotels has three core solutions. Hotel Tech Hub covers OTA setup, listing updates and fixes, troubleshooting, channel manager support and Google property support. OTAFix is a focused 3-month optimization program for properties already online but needing stronger visibility, content, promotions and conversion. Hotels360 provides professional reservation coordination and daily support including OTA and travel-agent reservations, guest communication, availability and rate updates, reports and insights.',
   'Management', 'approved', 'https://www.nkhotels.lk/', now(), array['services','sales']),
  ('sales', 'OTAFix approved public price',
   'OTAFix is publicly listed at Rs. 15,000 prepaid for 3 months. Use this exact public price only while this knowledge entry remains approved and current. Do not invent discounts or additional commercial terms.',
   'Management', 'approved', 'https://www.nkhotels.lk/', now(), array['pricing','otafix']),
  ('sales', 'Hotels360 approved public pricing',
   'Hotels360 has a one-time onboarding fee of Rs. 10,000. Essential: Rs. 10,000 monthly plus 3% OTA revenue share and 5% travel-agent commission. Growth: Rs. 15,000 monthly plus 2% OTA revenue share and 5% travel-agent commission. Accelerate: Rs. 20,000 monthly plus 1% OTA revenue share and 5% travel-agent commission. Do not invent discounts, waive fees or alter percentages without management approval.',
   'Management', 'approved', 'https://www.nkhotels.lk/', now(), array['pricing','hotels360']),
  ('sales', 'Hotel Tech Hub pricing',
   'Hotel Tech Hub pricing is quotation based. When asked for a price, explain that it depends on the required setup or fixes and collect only the property name, current OTA/channel situation and main issue needed to prepare the quotation.',
   'Management', 'approved', 'https://www.nkhotels.lk/', now(), array['pricing','hotel-tech-hub']),
  ('sales', 'Free OTA audit',
   'N K Hotels offers a free OTA audit. The audit can review Booking.com score, Genius or Preferred participation, promotions, OTA distribution, Google profile, photo quality, review responses and social presence. For a useful audit request, collect property name, location, Booking.com or website link if available, and the biggest current challenge.',
   'Management', 'approved', 'https://www.nkhotels.lk/', now(), array['audit','lead']),
  ('company', 'Channels supported',
   'The public NKH website lists Booking.com, Airbnb, Expedia, Agoda, Tripadvisor, Google Hotels, social media inquiries and travel-agent channels among the channels supported. Do not imply every channel or feature is included in every package unless approved information confirms it.',
   'Management', 'approved', 'https://www.nkhotels.lk/', now(), array['channels','faq']),
  ('company', 'Client control',
   'Clients keep ownership and control of their bookings. N K Hotels acts as an external reservation and OTA support partner.',
   'Management', 'approved', 'https://www.nkhotels.lk/', now(), array['faq','trust']),
  ('sales', 'How to start',
   'The preferred starting point for a new hotel enquiry is a free OTA audit. Based on the property condition and needs, N K Hotels can then recommend Hotel Tech Hub, OTAFix or Hotels360. The assistant should first understand the hotel problem and recommend the most relevant path rather than pushing the most expensive service.',
   'Management', 'approved', 'https://www.nkhotels.lk/', now(), array['onboarding','sales']),
  ('sales', 'Accommodation and travel-agent enquiries',
   'N K Hotels can support travelers, travel agents and tour organizers looking for accommodation through its hospitality network. For travelers, collect destination, travel dates and guest count. For travel agents, collect company or agency, market/country, destinations required and group size. FIT bookings, group inquiries, tour packages and accommodation sourcing are supported enquiry types.',
   'Management', 'approved', 'https://www.nkhotels.lk/', now(), array['travel','agents','leads']);
