# NKH WhatsApp Inbox — Phase 1 Operating Rules

This document defines the safe operating contract for the first reliable automatic-inbox release.

## Core rule

The assistant must distinguish between:

1. **Answering** — giving information from approved NKH knowledge.
2. **Acknowledging** — confirming receipt of a request or confirming that a task was created.
3. **Completing** — only reporting completion after the linked operational system confirms completion.

Creating a task is never proof that inventory changed, a guest received help, a rate was updated, or a client request was completed.

## AI modes

Each conversation has one AI mode:

- `auto`: assistant may process supported incoming messages.
- `paused`: assistant must not send automatic replies.
- `human`: a staff member has taken over; assistant must stay silent until AI is resumed.

Staff controls should map to:

- **Take over** → `human`
- **Pause AI** → `paused`
- **Resume AI** → `auto`

## Knowledge rules

Only approved knowledge entries may be used to answer factual company/service questions.

Knowledge entries must include:

- scope;
- owner;
- approval status;
- last-updated date;
- optional property restriction;
- optional validity dates.

Unknown or unapproved prices, commitments, availability, deadlines, concessions, refunds, discounts, and property-specific actions must not be invented.

## Conversation context

Before producing an automatic reply, the assistant should consider recent messages from the same conversation so that short replies such as “yes”, “tomorrow”, “same room”, or “any update?” are interpreted in context.

The assistant should prefer clarification over guessing when property, date, room, reservation reference, or requested action is uncertain.

## Task rules

Operational requests should extend the existing NKH dashboard task integration.

A created task should preserve:

- hotel/property;
- booking/reference when available;
- original source message;
- owner;
- priority;
- deadline when known;
- task status;
- completion note/evidence;
- whether the client was notified.

Related messages should update an existing unresolved task where practical rather than creating duplicates.

## Human escalation

Escalate instead of auto-answering when:

- complaint intent is detected;
- the request is unclear;
- the assistant lacks approved knowledge;
- a price or commercial commitment is not approved;
- a task is blocked or overdue;
- a message requests an action that cannot be verified from the current integrations;
- delivery or automation fails.

## Reliability

Incoming webhook events must be idempotent. Existing `meta_message_id` deduplication should remain in place.

Webhook signature verification must remain enabled when `WHATSAPP_APP_SECRET` is configured.

All automatic decisions should be auditable through `wa_ai_events`.

## Phase 1 boundary

Direct WhatsApp conversations are in scope.

WhatsApp group monitoring is not part of this release.

Forwarded requests must not inherit the forwarding employee's hotel assignment automatically; the target property must be explicitly resolved.
