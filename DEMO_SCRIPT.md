# Ascendiagroup — full demo video script

A scene-by-scene script covering every feature in the platform.

**Full runtime:** roughly 13 minutes. A 3 minute short cut is described at the end.

---

## Before you record

### Integrations to connect

Connect these under **Settings → Integrations** first. The platform tests each key
against the live provider API before saving, so a green "Connected" badge on
camera is real.

| Provider | Needed for | Demo impact if missing |
| --- | --- | --- |
| Claude | Strategy generation, call summaries, knowledge base Q&A | Scenes 6, 9, 10 cannot run |
| Trello | Board mirroring | Scene 8 falls back to the internal board only |
| Google Drive | Client folder creation | Scene 4 "Create Drive folder" errors |
| WhatsApp Business | Inbound message capture | Scene 11 uses manual capture only |
| Call recording | Transcript webhooks | Scene 9 uses a pasted transcript instead |

AgencyAnalytics, SEMrush, Google Ads, Google Business Profile and GoHighLevel are
optional and only affect Scene 12.

### Data to prepare

Record against a workspace that already has a few clients so the dashboard is not
empty, but keep **one practice completely fresh** to take through onboarding live.
The demo below uses a new practice called *Bright Smile Dental*.

Have ready in a scratch file to paste from:

- A sales call transcript (400+ words, mentioning goals, budget and competitors)
- Two or three WhatsApp style messages from a client

### Recording setup

- 1920x1080, browser at 100% zoom, bookmarks bar hidden
- Sign in before you hit record so no password is on camera
- Have a second browser profile ready for the client-facing pages, so the demo
  does not look like the agency filling in its own form

---

## Scene 1 — The problem (0:00–0:35)

**On screen:** Title card, then the Ascendiagroup dashboard.

> "A dental marketing agency signs a new practice. Today that kicks off a Google
> Sheet of questions, a Trello board somebody builds by hand, a Drive folder
> somebody remembers to create, and a strategy doc somebody writes from scratch.
> Ascendiagroup collapses all of that into one flow."

Pause on the dashboard so the sidebar reads as a full product.

---

## Scene 2 — Dashboard (0:35–1:20)

**Navigate:** `/dashboard`

**Show, in order:**

1. The four stat cards: Active clients, Active projects, Open tasks with the
   overdue count, and Intake to review.
2. **Onboarding in progress** — each practice, its account manager, whether intake
   has landed, and its task completion count.
3. **My open tasks** — the signed-in user's queue, sorted by due date.
4. **Recent activity** — the audit trail across every client.
5. **Workload split** — the comparative bar chart.

> "This is the account manager's morning view. Who is onboarding, what is waiting
> on me, and what has moved since yesterday. Every number here is live — nothing
> on this screen is decorative."

Click one row in "Onboarding in progress" to move to Scene 3.

---

## Scene 3 — The client record (1:20–2:10)

**Navigate:** `/dashboard/clients`, then open a practice.

**Show:**

1. The client grid — status badge, contracted service chips, and the
   projects / tasks / documents counts per practice. Use the search box once.
2. Open a client. Walk the six tabs quickly: **Overview, Onboarding, Delivery,
   Strategy, Context, Reporting**.
3. Sit on **Overview** — the practice record, the internal notes block, and the
   **Connected workspace** panel.

> "One record per practice. Services, retainer, the account manager who owns it,
> and the WhatsApp number we file their messages against. Everything else in the
> product hangs off this."

---

## Scene 4 — Provisioning the workspace (2:10–2:45)

**Stay on:** the client Overview tab.

**Do:**

1. Click **Create Drive folder**. Wait for the toast, then show the link now
   rendered in the panel and open it in a new tab to prove it is a real folder.
2. Click **Create Trello board**. Open the created board to show the
   Onboarding / In progress / Review / Done lists.
3. Click **Portal link** in the header to copy the client's status page URL.

> "Two clicks and the practice has its Drive folder and its Trello board, created
> through the real APIs, linked back to the record so nobody has to go hunting."

---

## Scene 5 — Building the intake form (2:45–4:30)

**Navigate:** `/dashboard/onboarding`

**Show:**

1. The form list with question and submission counts.
2. Open the form and stay on the **Builder** tab.

**Do — the split decision tree, which is the centrepiece:**

1. Point at the first question, *"Which services are in your package?"*, a
   **Service select**.
2. Click **Add question**. Set Section to `Google Ads`, type to **Credential**,
   label it `Google Ads customer ID`, tick **Contains credentials**.
3. In the **Conditional logic** box, change *Always show* to *"Which services are
   in your package?"*, leave the operator on **Is any of**, and click the
   **Google Ads** chip.
4. Save, and point at the blue **"Shows when …"** label now under the question.

> "Not every practice buys every service, so the form branches. This question only
> exists for practices that bought Google Ads, and it is flagged as a credential,
> which changes how it is stored and displayed."

**Then prove it on the Preview tab:**

1. Click **Preview**. Neither conditional question is visible.
2. Click **Google Ads** — the credential question appears.
3. Click **Seo** — the SEO question appears too.
4. Click **Google Ads** again — that question disappears, the SEO one stays.

> "The whole branch shows and hides live, exactly as the client will see it."

Mention the other 13 field types and the **Settings** tab, where you set the
introduction the client reads and mark the form as the default.

---

## Scene 6 — The client completes intake (4:30–5:30)

**Do:**

1. Click **Send to client**, pick the existing practice, click **Create link**.
2. Click **Open form** — switch to the second browser profile here.

**On the public form, show:**

1. The clean, branded, sign-in-free page and the introduction text.
2. Fill the practice and contact fields.
3. Select two services, and let the conditional questions appear.
4. Fill the credential field — point out it is masked as you type.
5. Submit, and pause on the confirmation.

> "The practice never creates an account. They get a link, they answer only the
> questions that apply to them, and their credentials are encrypted on the way in."

---

## Scene 7 — Ingesting the submission (5:30–6:30)

**Navigate:** `/dashboard/onboarding/submissions`

**Show:**

1. The status filters — Awaiting response, Submitted, Processed.
2. Open the new submission. Answers are grouped by section.
3. Click **Reveal credentials** to unmask the Google Ads ID.

**Do:**

1. Click **Create project**, confirm the client and project name, and create it.
2. You land on the delivery board.

> "One click turns the answers into delivery. It created the project, applied the
> services they selected to their record, seeded their knowledge base with the
> answers, and generated the task board from our onboarding checklist."

Call out the toasts, which report exactly what happened.

---

## Scene 8 — The delivery board and Trello (6:30–7:30)

**Stay on:** the project board.

**Show and do:**

1. The five columns and the auto-generated cards, each with priority, due date
   and assignee.
2. Move a card using the **three-dot menu → In progress**. Mention it also works
   by dragging on desktop; the menu is what makes it usable on a phone.
3. Open a card to show the task editor.
4. Click **Sync to Trello**, then open the Trello board to show the same cards.

> "Trello stays their source of truth for weekly delivery, so we push to it rather
> than trying to replace it."

Then show `/dashboard/automations`:

- The **task template** that generated those cards, with per-task priority and a
  day offset.
- The **rule** that binds it to the "Onboarding submitted" trigger, and the
  service line filter that decides which practices it applies to.

> "This is why the board built itself. Change the checklist once and every future
> practice onboards the new way."

---

## Scene 9 — Calls, summaries and action items (7:30–8:40)

**Navigate:** `/dashboard/meetings`

**Show:**

1. The call list with the Summarised / Needs summary / No transcript badges.
2. Click **Webhook URL** and explain that the call recorder posts transcripts here
   automatically. Then use **Log a call** and paste the transcript so the demo does
   not depend on a live recording.
3. Open the call and click **Summarise with Claude**.

**When it returns, walk through:**

- The **Summary**
- The **Next steps**
- The **Action items** panel

**Do:** click **To board** and show the action items land on the delivery board as
real tasks.

> "Every call becomes a summary, a set of next steps, and tasks somebody owns —
> and the transcript is added to the practice's knowledge base automatically."

---

## Scene 10 — Knowledge base and Claude (8:40–10:00)

**Navigate:** `/dashboard/knowledge-base`

**Show:**

1. The client switcher with document counts.
2. The documents already there: the onboarding answers, the call transcript, the
   WhatsApp thread — all filed automatically, plus anything added by hand.
3. Use **Add document** to add a note.

**Do — the Ask Claude panel:**

1. Ask something only their own context can answer, for example
   *"What did they say about new patient goals, and which pages are we prioritising for SEO?"*
2. Wait for the answer and point at the **Sources** line under it.

> "Claude answers from this practice's documents only, and it tells you which ones
> it used. If the answer is not in there it says so, rather than inventing it."

**Then the Claude project link:**

1. Click **Export context** — the whole knowledge base is copied as one document.
2. Click **Claude project**, paste the project ID and URL, save.
3. Show the **Open Claude project** link now in the header.

> "The team already lives in Claude projects, so we hand the context over and keep
> a link to it, rather than asking anyone to change how they work."

---

## Scene 11 — WhatsApp capture (10:00–10:50)

**Navigate:** `/dashboard/whatsapp`

**Show:**

1. Messages already captured, each filed against a practice.
2. The **unassigned** banner, and use the dropdown on an unmatched message to
   assign it to a client.
3. Click **Webhook URL** and explain the WhatsApp Business webhook posts here.
4. Use **Capture message** to paste a message in manually.

**Then:** go back to the knowledge base for that client and show the WhatsApp
conversation document has grown.

> "This was the real gap — the important decisions happen on WhatsApp and never
> make it into the system. Now every message lands in the timeline and the
> knowledge base, so Claude is never out of date."

---

## Scene 12 — Strategy generation (10:50–12:00)

**Navigate:** `/dashboard/strategies` → **Generate strategy**

**Do:**

1. Pick the practice.
2. Select the **onboarding submission** and tick the **call transcript** — both
   sources, on camera.
3. Add a line of extra context.
4. Click **Generate roadmap** and let it run.

**On the result, walk through:**

- Summary, Positioning, Audience
- **Risks and open questions** — call out that it flags what the sources did not
  cover instead of guessing
- The three phase columns: 30, 60 and 90 days, each action with a priority and a
  delivery lane

**Do:**

1. Edit one action inline to show the roadmap is a working document, not a
   read-only output.
2. Click **Push to board** and show the actions arrive on the delivery board with
   due dates staged across the 30, 60 and 90 day horizons.

> "The 90 day plan is built from the sales call and the onboarding form together,
> the account manager edits it, and then it becomes scheduled work."

---

## Scene 13 — Reporting and the client portal (12:00–12:40)

**Navigate:** `/dashboard/reporting`

**Show:**

1. **Link account** — connecting a practice to its AgencyAnalytics campaign or
   Google Ads customer ID.
2. **Sync** — KPIs pulled in and rendered.
3. **New report**, then **Publish**.

**Then open the client portal** in the second browser profile:

- Delivery progress bar and what the team is working on
- The approved 90 day plan
- Latest performance
- The published report

> "The practice gets one link. No login, no chasing for a status update."

---

## Scene 14 — Team and access (12:40–13:00)

**Navigate:** `/dashboard/team`

**Show:**

1. **Invite member** — email plus role, which generates a single-use link.
2. The role reference table: Owner, Admin, Account manager, Specialist, Client.
3. Change a member's role and toggle a member inactive.

> "Owners and admins see everything. Account managers run their practices.
> Specialists see the work assigned to them. The sidebar changes per role."

Close on the dashboard.

> "Signed contract to a scaffolded 90 day plan, without the manual handover."

---

## Short cut — 3 minutes

For a landing page or a cold outreach clip, keep only:

1. **Scene 5** — the form branching in Preview (0:40)
2. **Scene 6** — the client completing it (0:30)
3. **Scene 7** — one click into a project (0:30)
4. **Scene 12** — strategy generated from call plus form, pushed to the board (0:50)
5. **Scene 10** — asking Claude a question and getting a cited answer (0:30)

Skip the dashboard tour, reporting, team and integrations entirely.

---

## Things worth saying out loud

- **Nothing here is a mockup.** Every screen reads from and writes to the database.
  Where there is no data yet you get a proper empty state, never invented content.
- **The integrations are tested live.** Saving a key calls the provider's API and
  only marks it connected if the call succeeds.
- **Credentials are encrypted at rest** with AES-256-GCM and masked in the UI until
  somebody explicitly reveals them.
- **They own it.** Their code, their hosting, their database.
