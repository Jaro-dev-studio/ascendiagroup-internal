# Ascendiagroup — full demo video script

A scene-by-scene script covering every feature, recorded **without any third
party integrations connected**. Integration keys are supplied by the client after
payment, so the integration-dependent screens are shown and narrated as future
state rather than clicked.

**Full runtime:** roughly 13 minutes. A 3 minute short cut is described at the end.

---

## Before you record

### No integrations required

Nothing in this script needs an API key. Every screen is shown either working
live against the database, or as a real UI you narrate over.

| Scene | Recorded live | Narrated as future state |
| --- | --- | --- |
| Dashboard, clients | Everything | — |
| Intake forms, branching, client submission | Everything | — |
| Submission ingestion, project scaffolding | Everything | — |
| Delivery board, tasks, automations | Board, cards, checklists | Trello mirroring |
| Client workspace panel | The panel and its links | Drive folder and Trello board creation |
| Calls | Logging a call, transcript, action items | Recorder webhook, Claude summary |
| Knowledge base | Documents, export, Claude project link | Ask Claude answers |
| WhatsApp | Manual capture, assignment, timeline | WhatsApp Business webhook |
| Strategy | Roadmap, editing, push to board | The Claude generation step only |
| Reporting | Reports, publishing, client portal | KPI sync from ad platforms |
| Integrations | The whole page | Connecting a provider |

### The narration convention

Whenever you hit a future-state moment, the platform itself puts an honest
message on screen — "Connect Claude under Integrations to enable the assistant",
or an empty KPI panel that names the platforms it needs. **Point at that message.**
It reads as a product that is finished and waiting for credentials, not a product
with holes in it.

A line that works throughout:

> "That is switched off right now because we have not put your keys in yet. The
> moment you do, this is what happens…"

### Do not click these on camera

They will show a red error toast because there are no credentials behind them:

- **Create Drive folder** and **Create Trello board** on the client Overview tab
- **Sync to Trello** on a project board
- **Summarise with Claude** on a call
- **Generate roadmap** on the strategy screen
- **Sync** on the reporting page
- **Test and save** in an integration dialog

Show the buttons, talk over them, move on.

### Data to prepare

Record against a workspace that already has a few practices so the dashboard is
not empty, and keep **one practice completely fresh** to take through onboarding
live. This script uses *Bright Smile Dental*.

Have ready in a scratch file to paste from:

- A sales call transcript, 400+ words, mentioning goals, budget and competitors
- Two or three WhatsApp style messages from a client
- A short report summary and three highlight bullets

### Recording setup

- 1920x1080, browser at 100% zoom, bookmarks bar hidden
- Sign in before you hit record so no password is on camera
- Have a second browser profile ready for the client-facing pages, so it does not
  look like the agency filling in its own form

---

## Scene 1 — The problem (0:00–0:35)

**On screen:** Title card, then the dashboard.

> "A dental practice signs with you. Today that kicks off a Google Sheet of
> questions, a Trello board somebody builds by hand, a Drive folder somebody
> remembers to create, and a strategy doc somebody writes from scratch.
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

> "This is the morning view. Who is onboarding, what is waiting on me, and what
> has moved since yesterday. Every number is live — nothing here is decorative."

Click a row in "Onboarding in progress" to move to Scene 3.

---

## Scene 3 — The client record (1:20–2:10)

**Navigate:** `/dashboard/clients`, then open a practice.

**Show:**

1. The client grid — status badge, contracted service chips, and the
   projects / tasks / documents counts. Use the search box once.
2. Open a client and walk the six tabs quickly: **Overview, Onboarding, Delivery,
   Strategy, Context, Reporting**.
3. Sit on **Overview** — the practice record and the internal notes block.

> "One record per practice. Services, retainer, the account manager who owns it,
> and the WhatsApp number we file their messages against. Everything else hangs
> off this."

---

## Scene 4 — The connected workspace *(narrated)* (2:10–2:45)

**Stay on:** the client Overview tab, on the **Connected workspace** panel.

**Do:** hover over **Create Drive folder** and **Create Trello board**. Do not
click. Then click **Portal link** in the header to copy the client's status page
URL — that one is live and you will use it in Scene 13.

> "These two buttons are wired to the real Google Drive and Trello APIs. Once your
> credentials are in, one click creates the practice's Drive folder under your
> shared drive, and one click creates their Trello board with the Onboarding, In
> progress, Review and Done lists already set up. Both links then live here on the
> record, so nobody goes hunting for them."

Point out **Open knowledge base**, which is live, as a bridge to Scene 10.

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

Mention the other field types and the **Settings** tab, where you set the
introduction the client reads and mark the form as the default.

**This scene is entirely live. Take your time here — it is the strongest thing in
the video.**

---

## Scene 6 — The client completes intake (4:30–5:30)

**Do:**

1. Click **Send to client**, pick the practice, click **Create link**.
2. Click **Open form** — switch to the second browser profile here.

**On the public form, show:**

1. The clean, branded, sign-in-free page and the introduction text.
2. Fill the practice and contact fields.
3. Select two services and let the conditional questions appear.
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

Call out the toasts, which report exactly what happened. All of this is live.

---

## Scene 8 — The delivery board (6:30–7:30)

**Stay on:** the project board.

**Show and do — all live:**

1. The five columns and the auto-generated cards, each with priority, due date
   and assignee.
2. Move a card using the **three-dot menu → In progress**. Mention it also works
   by dragging on desktop; the menu is what makes it usable on a phone.
3. Open a card to show the task editor.

**Then narrate the Trello button:**

> "Your weekly delivery meeting stays in Trello, so we do not try to replace it.
> Once your Trello key is in, this Sync button pushes every one of these cards
> onto the practice's board, and keeps the card IDs so it never duplicates them."

**Then show `/dashboard/automations`, which is live:**

- The **task template** that generated those cards, with per-task priority and a
  day offset.
- The **rule** binding it to the "Onboarding submitted" trigger, and the service
  line filter that decides which practices it applies to.

> "This is why the board built itself. Change the checklist once and every future
> practice onboards the new way."

Optionally show `/dashboard/tasks` — the cross-client queue with filters for
status, assignee and practice.

---

## Scene 9 — Calls, transcripts and action items (7:30–8:40)

**Navigate:** `/dashboard/meetings`

**Show and do — live:**

1. The call list with the Summarised / Needs summary / No transcript badges.
2. Click **Log a call**, fill the client, type, title and date, and paste your
   prepared transcript. Save.
3. Open the call and show the stored transcript.
4. Show the empty **Summary**, **Next steps** and **Action items** panels.

**Narrate the two switched-off pieces:**

> "Two things happen here once we are connected. First, your call recorder posts
> straight to this webhook — you never upload anything, the call just appears with
> its transcript attached. Second, this Summarise button sends the transcript to
> Claude and fills in these three panels: the recap, the next steps, and a list of
> action items with an owner against each one. Then this To board button turns
> those action items into real tasks on the delivery board."

Click **Webhook URL** to show the endpoint being copied — that part is live.

---

## Scene 10 — Knowledge base and Claude (8:40–10:00)

**Navigate:** `/dashboard/knowledge-base`

**Show and do — live:**

1. The client switcher with document counts.
2. The documents already filed automatically: the onboarding answers from Scene 7,
   the call transcript from Scene 9, and the WhatsApp thread you will add in
   Scene 11.
3. Use **Add document** to add a note by hand, with tags.
4. Click **Export context** — the entire knowledge base is copied as a single
   document. Paste it into a text editor to prove it is real.
5. Click **Claude project**, paste a project ID and URL, save, and show the
   **Open Claude project** link now in the header.

> "The team already lives in Claude projects, so we do not fight that. This button
> gives you the whole practice as one document to drop into a project, and we keep
> a link to it on the record so everyone opens the same context."

**Narrate the assistant panel:**

Point at the on-screen message, "Connect Claude under Integrations to enable the
assistant."

> "With your key in, you ask this panel a question about the practice and it
> answers from their documents only — the onboarding answers, the call
> transcripts, the WhatsApp thread. It cites which documents it used underneath
> the answer, and if the answer is not in there it tells you what is missing
> rather than inventing it."

---

## Scene 11 — WhatsApp capture (10:00–10:50)

**Navigate:** `/dashboard/whatsapp`

**Show and do — live:**

1. Use **Capture message** to paste in one of your prepared messages against a
   practice.
2. Show the message card — sender, number, direction, and the practice it is
   filed against.
3. Capture a second one with an unknown number, show the **unassigned** banner,
   and use the dropdown to assign it to a client.
4. Go back to the knowledge base for that practice and show the **WhatsApp
   conversation** document has grown.

**Narrate the webhook:**

Click **Webhook URL** to copy it.

> "Right now I am pasting these in. Once your WhatsApp Business number is
> connected to this webhook, every message your clients send lands here on its
> own, matched to the practice by phone number, and appended to that same
> conversation document — so the context is never out of date."

> "This was the real gap. The important decisions happen on WhatsApp and never
> make it into the system."

---

## Scene 12 — Strategy roadmap (10:50–11:50)

**Navigate:** `/dashboard/strategies` → **Generate strategy**

**Show — the source selection is live:**

1. Pick the practice.
2. Tick the **onboarding submission** from Scene 7 — it shows the answer count and
   date.
3. Tick the **call transcript** from Scene 9.
4. Type a line into **extra context**.
5. Point at the amber banner explaining Claude is not connected, and at the
   disabled **Generate roadmap** button. Do not click it.

> "Two sources, both already in the system: what they told us on the sales call,
> and what they told us on the onboarding form. Nobody re-types anything. With
> your Claude key in, this button writes the roadmap. Here is one we have already
> got for this practice."

**Then open the existing roadmap — everything from here is live:**

1. Go back to `/dashboard/strategies` and open
   *"Bright Smile Dental — 90 day growth roadmap"*.
2. Walk the top row: **Summary**, **Positioning**, **Audience**.
3. Stop on **Risks and open questions**.

> "This is the part people do not expect. It flags what the sources did not cover
> — no budget, no target patient volume, no confirmed Business Profile ownership —
> instead of quietly inventing them. That becomes the agenda for the kickoff call."

4. Walk the three phases: 30, 60 and 90 days. Point at an action's **priority**
   and its **delivery lane** chip.

**Do, on camera:**

1. Hover an action and click the pencil. Change a word in the title, save, and
   show it update.

> "It is a working document, not a read-only AI output. The account manager owns
> it."

2. Click **Push to board**.
3. Land on the delivery board and show the 14 actions arriving as real tasks, with
   due dates staged across the 30, 60 and 90 day horizons.
4. Go back to the roadmap and point at the green **On board** markers now against
   each action.

> "One button and the plan becomes scheduled work. That is the piece that takes a
> strategist half a day today."

---

## Scene 13 — Reporting and the client portal (11:50–12:30)

**Navigate:** `/dashboard/reporting`

**Show and do — live:**

1. **Link account** — show the dialog where a practice is tied to its
   AgencyAnalytics campaign or Google Ads customer ID. Save one.
2. Point at the empty KPI panel, which names the platforms it needs.
3. Click **New report**, fill the period, summary and highlights, and save.
4. Click **Publish**.

**Narrate the sync:**

> "Once the reporting platforms are connected, this Sync button pulls the
> practice's numbers straight in — sessions, conversions, ad spend, organic
> visibility — and they render on the client's own page."

**Then open the client portal** in the second browser profile, using the link you
copied in Scene 4:

- Delivery progress bar and what the team is working on
- **Your 90 day plan** — the approved roadmap from Scene 12, in the client's words
- The published report you just created

> "The practice gets one link. No login, no chasing for a status update."

---

## Scene 14 — Integrations and team (12:30–13:10)

**Navigate:** `/dashboard/integrations`

**Show:**

1. Scroll the whole page — ten providers across Core, Delivery and Marketing data.
2. Open one **Connect** dialog to show the fields it asks for. Close it without
   saving.
3. Point at the API docs link and the webhook URL on the WhatsApp card.

> "Everything is already built and waiting. You paste your keys in here, we test
> the connection against the live API before we save it, and it only goes green if
> the provider actually answered. Keys are encrypted before they touch the
> database and masked in this list."

**Then `/dashboard/team`:**

1. **Invite member** — email plus role, generating a single-use link.
2. The role reference table: Owner, Admin, Account manager, Specialist, Client.
3. Change a member's role and toggle a member inactive.

> "Owners and admins see everything. Account managers run their practices.
> Specialists see the work assigned to them. The sidebar changes per role."

Close on the dashboard.

> "Signed contract to a scaffolded 90 day plan, without the manual handover."

---

## Short cut — 3 minutes

For a landing page or cold outreach, keep only the fully live scenes:

1. **Scene 5** — the form branching in Preview (0:45)
2. **Scene 6** — the client completing it (0:30)
3. **Scene 7** — one click into a project (0:35)
4. **Scene 8** — the board that built itself, and the checklist behind it (0:35)
5. **Scene 10** — the knowledge base filling itself, and Export context (0:35)

No narrated future-state scenes at all, so nothing needs caveating.

---

## Things worth saying out loud

- **Nothing here is a mockup.** Every screen reads from and writes to the database.
  Where there is no data yet you get a proper empty state, never invented content.
- **The integration work is done, not pending.** The connectors are built and each
  one verifies itself against the live API before saving. What is outstanding is
  credentials, not code.
- **Credentials are encrypted at rest** with AES-256-GCM and masked in the UI until
  somebody explicitly reveals them.
- **They own it.** Their code, their hosting, their database.
