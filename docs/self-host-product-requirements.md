# Asky — self-host product requirements

**Status:** owner-stated product direction (not a build spec)  
**Audience:** product and implementation  
**Related:** landscape scan of ASKfm-class platforms lives separately at `/opt/cursor/project/attachments/asky/docs/ask-platform-requirements.md`

This document records the product the owner described. It does not add features from the market scan, and it does not decide open details (auth scheme, exact Cloudflare bindings, thumbnail layout, and so on).

---

## Purpose

A **tiny, self-hosted question box**. Someone who already has a Cloudflare account deploys Asky onto that account and points followers (mainly from Twitter/X and other social media) at it.

Goals that were stated:

- The operator hosts it themselves.
- It depends **entirely on the Cloudflare stack** so cost stays low.
- Followers can ask questions; the operator answers from a hidden admin page.
- Public answers can be shared, including a generated thumbnail of the question text.

This is a **personal ask inbox with a public wall**, not a multi-user social network (no follower graph, no guest accounts, no discovery feed of other people).

---

## Hosting model

| Requirement | Notes from owner |
| --- | --- |
| Self-hosted by the operator | Each user runs their own instance on **their** Cloudflare account. |
| Cloudflare-only | The app should not need a non-Cloudflare backend, database, or CDN. |
| Low cost | Fit a personal / creator use case, not a large shared SaaS. |

How that maps onto Workers, Pages, D1, KV, R2, Turnstile, Analytics, and so on is **not decided here**. Those are implementation choices inside the Cloudflare constraint.

---

## Public site (main page)

The main page is the whole public product.

1. **Ask question** component is on the main page (always available to visitors).
2. **Answered questions** are listed on the same page **only when** `is_public = true`.
3. Unpublished, unanswered, and non-public items must not appear on the main page.

Ask form behavior (both of these are in scope):

- **Anonymous questions** are allowed.
- Questions **from anyone typing a name and email** are allowed.

The owner did not specify whether name/email is optional on every ask, a second mode next to anonymous, or required unless the asker chooses anonymous. That is an open gap.

---

## Hidden admin

A **hidden admin page** for the operator only.

| Requirement | Notes from owner |
| --- | --- |
| Operator-chosen path | The admin URL is not a well-known `/admin`. The operator picks the path. |
| Authentication | “Maybe password or some sort of authentication.” Scheme is not decided. |
| Capabilities | See the question list; answer questions; manage all asked questions (including public/unlisted, delete, and similar management — exact actions beyond answer + manage were not enumerated). |

There is a single admin user (the instance owner). There is no public registration.

---

## Question identity and visibility

| Requirement | Notes from owner |
| --- | --- |
| Unique public reference | Each question has a UUID (or equivalent) **apart from sequential ids**. Sharing and lookup must not use `?question_id=1`, `2`, `3`, … |
| `is_public` | Controls whether an answered question appears on the main page. |
| Anonymous | Supported. |
| Identified ask | Name + email supported. |

Sequential database primary keys may exist internally; they must not be the public reference.

---

## Sharing

| Requirement | Notes from owner |
| --- | --- |
| Share to Twitter and other social media | Visitors / the operator can share a question (implied: a public answered question, or a permalink). Exact share targets beyond Twitter were not listed. |
| Share thumbnail | Sharing generates a **thumbnail with the question text** on a **designed background**. |

Open: whether the image is an Open Graph / Twitter card at a permalink, a downloadable image, or both. The stated need is that social posts show the question text on a nice background.

---

## Abuse and availability

| Requirement | Notes from owner |
| --- | --- |
| Rate limiting | Required on asking (and implied on other write paths). |
| DDoS prevention | Required. Cloudflare is the intended mechanism (WAF / bot fight / Turnstile / similar — not chosen). |

---

## Metrics (additional)

Collect metrics **from Cloudflare**, using what the platform already exposes (including Cloudflare headers) where possible:

- Page views
- Unique visits
- Metrics by country
- More if Cloudflare can provide it without a non-CF analytics vendor

Where these appear (admin page vs Cloudflare dashboard vs in-app widgets) was not specified.

---

## Out of scope (for this direction)

Not requested in this brief, so not requirements:

- Multi-tenant SaaS (one Asky company hosting everyone’s inboxes)
- Visitor accounts, follows, likes, or a social graph
- Paid unmasking / sender hints
- Native iOS/Android apps
- Community / topic Q&A (Quora-style) or AMAs

---

## Open gaps (do not invent)

Leave these undecided until the owner says so:

1. **Ask form:** anonymous vs name+email as a toggle, two fields always optional, or something else; whether email is validated or stored for notify-on-answer.
2. **Admin auth:** password on the secret path, Cloudflare Access, Turnstile + shared secret, or another CF-native method.
3. **Admin path:** config at deploy time vs a setting after first login.
4. **Manage** actions: publish/unpublish, delete, edit answers, mark spam, export — only “answer and manage all asked questions” was stated.
5. **Cloudflare building blocks:** Pages vs Worker, D1 vs KV, R2 for OG images, Analytics Engine vs web analytics vs `CF-IPCountry` logs.
6. **Share permalink:** `/q/{uuid}` vs query param `?ref={uuid}`; which networks besides Twitter.
7. **Thumbnail:** size, template, languages/long text overflow, whether unanswered questions can be shared.
8. **Notify asker** when an identified (name+email) question is answered.
9. **Custom domain** vs `*.workers.dev` / Pages default host.
10. **Deploy path:** Wrangler / GitHub + Cloudflare, one-click Deploy to Cloudflare, or a template repo only.

---

## Requirement checklist (owner list)

Must-have as stated:

- [ ] Tiny self-hosted instance on the operator’s Cloudflare account
- [ ] Entire runtime on Cloudflare
- [ ] Main page: ask component + public answered questions (`is_public = true`)
- [ ] Hidden admin at an operator-chosen path, with some authentication
- [ ] Admin can list, answer, and manage questions
- [ ] Anonymous asks
- [ ] Asks with name and email
- [ ] Rate limiting and DDoS prevention
- [ ] Public question references via UUID (not sequential ids)
- [ ] Share to Twitter / social media
- [ ] Generated share thumbnail (question text + designed background)

Additional:

- [ ] Cloudflare-sourced metrics: page views, unique visits, by country, plus whatever else CF can supply
