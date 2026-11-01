# Personal Site Refresh — "Humane, Not LinkedIn" Implementation Plan

> **For Hermes:** This is a plan, not execution. D9s approves scope before any file is touched.

**Goal:** Reconcile `hidayattaufiqur.dev` with LinkedIn on *facts* (title, company spelling, experience claim) while making the site *more* human — not more corporate. Add the texture that already exists on LinkedIn but never made it to the site.

**Hard constraint (d9s, 2026-11-01):** the site shows the humane part of him, not a fully professional-clad, capitalism-ready LinkedIn facade. Any recommendation that turns the site into LinkedIn-with-a-blog gets dropped.

**Source of truth consulted:**
- Live site repo: `~/Fun/Projects/hidayattaufiqur.dev` (Astro 5, content collections, HEAD `6db5745`, 2 commits behind origin)
- OpenCode laptop session `ses_e6a011815ffeJyZjYj9f7o010z` — "Jev browser automation in Brave" (its LinkedIn↔site audit + follow-up verdict on the humane constraint)

---

## Current state (verified by reading the repo, not memory)

| File | What it says today |
|---|---|
| `src/pages/index.astro:34-39` | "Software Engineer with **3+ years**... **Associate Technical Consultant**... also a notoriously brutal Mobile Legends jungler" |
| `src/pages/about.astro:34-39` | Same title + "3+ years"; ML paragraph lives in the **second** paragraph |
| `src/pages/about.astro:52-53` | "**Nine Dots Consulting** / Associate Technical Consultant · 2025–present" |
| `src/pages/about.astro:94-135` | Toolbox **already grouped by domain** (Languages / Frameworks / Databases / Cloud & DevOps / Monitoring / Specialized) |
| `src/pages/about.astro:149-152` | CV link → **Google Drive** `file/d/1Yn0.../view?usp=sharing` |
| `src/site-config.ts:5` | description repeats "3+ years building production APIs" |
| Certifications | **absent everywhere** (grep for MB-500 / GH-200 across `src/` → 0 hits) — the laptop session re-verified against the live deployment: 0 matches on `/`, `/about`, `/projects`, `/photography`, `/blog`. Confirmed, no correction needed. |

**LinkedIn facts** (from the laptop session, pulled while signed in): headline "Software Engineer, Microsoft Dynamics 365 F&O developer"; actual job title **Associate Technical Developer**, company **9 Dots Consulting**, Mar 2025–present; education **Informatics** (site says Computer Science); certs MB-500 (Dec 2025) + GH-200 (Aug 2026).

---

## What got dropped, and why

The laptop session's first pass produced a normal LinkedIn-parity report (impact-metric strip, cert row, 2–3 quantified bullets per role). Under the humane constraint it reversed or dropped most of that itself. Final agreed verdict:

| Original rec | Verdict | Why |
|---|---|---|
| One canonical title + company spelling | **Keep, narrowed** | Fix only real contradictions. Do not import the LinkedIn headline as the site's identity. |
| Reframe "3+ years" | **Keep** | Truthfulness, not positioning. |
| Homepage 3-metric impact strip | **Drop** | The single most LinkedIn-ifying item. A KPI band *is* the facade. |
| Certification row | **Drop as a row** | Certs are LinkedIn's job. Optional single prose clause at most. |
| 2–3 quantified bullets per role | **Drop** | That's a résumé. Compact timeline is the right shape here. |
| Move ML paragraph down / cut it | **Reverse** | Personality is the product on this site; it just shouldn't be the *only* thing. |
| Group toolbox | **Already done** — no action |
| Feature FnO Dev Copilot co-primary | **Keep, repitched** | Frame as obsession/curiosity, not "strongest professional sentence". |
| `/resume.pdf` instead of Drive | **Keep** | Pure utility, no facade. |
| CS vs Informatics | **Keep** | Minor consistency. |

**The insight worth acting on:** the gap isn't missing metrics, it's **missing texture**. Two of the best human sentences already exist in the LinkedIn About and never made it to the site — *"reading the standard application until you find where a process actually breaks"* and the unused-tax-calc-in-the-exchange-rate-call bug (a real debugging war story). Those belong on the site. The bullet lists don't.

---

## Approach

Three small, separable changes. Each is a single commit, each verifiable in the built output. No new sections, no new pages, no design overhaul — the site's shape is right; the *content* inside it needs to be truer and more textured.

---

### Task 1: Fix the factual contradictions (P0)

**Objective:** One title, one company spelling, one honest experience claim — everywhere.

**Files:**
- Modify: `src/pages/index.astro:33-40`
- Modify: `src/pages/about.astro:6-9, 34-40, 52-53`
- Modify: `src/site-config.ts:5`

**Decisions (need d9s sign-off, pick one per row):**

*(a) Job title in the timeline.* Site says "Associate Technical Consultant", LinkedIn says "Associate Technical Developer". Recommendation: use the literal **Associate Technical Developer** in the experience list (it's checkable in one click), keep "Software Engineer" as the hero identity if he wants it. Do not let the hero silently upgrade a checkable title.

*(b) Company spelling.* Site "Nine Dots Consulting" vs LinkedIn "9 Dots Consulting". Recommendation: match LinkedIn exactly — **9 Dots Consulting**.

*(c) The "3+ years" line.* Replace with the two-part honest version:

```astro
I'm a <b>Software Engineer</b> with <b>3+ years writing software</b> — the last
<b>1.5+ of them shipping D365FO in production</b> as an
<b>Associate Technical Developer</b> at <b>9 Dots Consulting</b>.
```

Apply the same correction to `site-config.ts:5` description (drop the bare "3+ years building production APIs" claim, or scope it).

*(d) Degree name.* Site "Computer Science" vs LinkedIn "Informatics". Recommendation: use whatever the diploma literally says, everywhere.

**Verification:**
```bash
cd ~/Fun/Projects/hidayattaufiqur.dev
grep -rn "Associate Technical" src/        # expect only the canonical form
grep -rn "Nine Dots" src/                  # expect 0 hits
grep -rn "3+ years" src/                   # expect only the scoped version
npm run build && grep -o "Associate Technical [A-Za-z]*" dist/index.html dist/about/index.html
```

---

### Task 2: Add the texture (the actual point of this refresh)

**Objective:** Move three pieces of human evidence that exist only on LinkedIn onto the site — as prose, not bullets.

**Files:**
- Modify: `src/pages/about.astro` (body paragraphs)
- Modify: `src/pages/index.astro` (only if a one-line hook is wanted)

**Content to add — story-shaped:**

1. **The Power BI refresh-timeout hunt.** A real root-cause story: a refresh timing out, traced to an unused tax-calculation side effect inside the standard exchange-rate call. This is the single most distinctive thing on his LinkedIn and it's *narratively* good — debugging archaeology, exactly the "reading the standard application until you find where a process actually breaks" line. Suggested shape (one paragraph, first person, no bullet points):

   > One of my favourite bugs was a Power BI refresh that kept timing out. The cause turned out to be an unused tax-calculation side effect hiding inside the standard exchange-rate call — nothing in the report pointed there. That's most of what this job actually is: reading the standard application until you find where a process really breaks.

2. **The sales order import.** Frame as outcome-in-human-terms, not a feature list:

   > We replaced a room full of manual order keying with an import that takes five Excel templates, validates them in staging, and creates the orders and lines — with optional auto-invoicing. The win wasn't the code; it was people not typing the same numbers twice.

3. **D365FO day-job context, one sentence.** Enough that a non-ERP reader knows what the job is, without a bullet list of acronyms. Something like: *"Day job: I extend Microsoft Dynamics 365 Finance & Operations — the ERP that runs finance and supply chain for large companies — and try to make it behave."*

**Explicitly NOT added:** EHF/PEPPOL format design, SSRS report inventories, AX 2012 → D365FO migration writeup, Azure DevOps/UAT/go-live process, certification IDs, 1.5×/3× numbers, 250+ students, per-role dated bullets. Those stay on LinkedIn — they're the professional surface.

**Placement:** insert **after** the existing "I care about backend architecture..." paragraph and **before** the Experience block, so personality lands first (as d9s wants) and the evidence follows as story rather than credentials. Keep total addition to ~3 short paragraphs — if it grows past that, it's becoming a résumé again.

**Verification:** read `/about` in the built output; count paragraphs. If the page now reads like a CV, cut.

---

### Task 3: Kill the Drive dependency + FnO Dev Copilot repitch (P3, small)

**Objective:** Two low-risk utility fixes.

**Files:**
- Create: `public/resume.pdf` (copy of the current CV)
- Modify: `src/pages/about.astro:149-152`
- Modify: `src/content/projects/fno-dev-copilot-case-study.md` frontmatter/description if the framing needs softening

**Steps:**
1. Download the current CV from the Drive link, save as `public/resume.pdf`.
2. Replace the Drive href with `/resume.pdf`, keep the same link text and `aria-label`. Add `download` attribute if a direct download is preferred over in-browser view.
3. Leave the FnO Dev Copilot case study as-is unless d9s wants the homepage mention reframed from "featured project" to "thing I'm obsessed with" — the case-study page itself is already narrative and fine.

**Verification:**
```bash
npm run build && ls -la dist/resume.pdf
grep -c "drive.google.com/file" dist/about/index.html   # expect 0
```

---

## Files likely to change

```
src/pages/index.astro           (title line, maybe one hook sentence)
src/pages/about.astro           (title, timeline, +3 texture paragraphs, resume link)
src/site-config.ts              (meta description)
src/content/projects/fno-dev-copilot-case-study.md   (only if repitching homepage copy)
public/resume.pdf               (new)
```

No layout, component, or styling changes. No new pages. No dependency changes.

---

## Tests / validation

No test suite in this repo. Validation is:
1. `npm run build` exits 0 (Astro static build).
2. `grep` assertions above return the expected counts.
3. Read the built `/about` and `/` HTML — does it read as a person or a profile?
4. Visual check on mobile width (the site is responsive; adding paragraphs shouldn't break anything, but confirm).

---

## Risks / tradeoffs / open questions

**Risks:**
- **Over-correcting into corporate.** The whole point of the constraint. Mitigation: Task 2 is capped at ~3 paragraphs and forbids bullets/metrics. If d9s reads the draft and it feels like LinkedIn, cut harder, don't add more.
- **The "3+ years" reframe could read as defensive.** It's honest but slightly wordy. If it sounds like apologizing, revert to a plain "3+ years" and accept the mild overstatement — it's a personal site, not an SEC filing. d9s's call.
- **Repo is 2 commits behind origin** (`189e3b1`, `ca3654b` — security/deps fixes). Pull before branching to avoid a merge mess.

**Open questions for d9s:**
1. Timeline title: literal **Associate Technical Developer** (checkable) or the site's **Associate Technical Consultant** (his preference as stated in memory)? Currently the site contradicts LinkedIn here.
2. Company spelling: adopt LinkedIn's **9 Dots Consulting**?
3. Degree: **Computer Science** or **Informatics** — which does the diploma say?
4. Does the CV PDF allow public hosting, or should the link stay gated behind Drive?
5. Is the ML jungler paragraph staying exactly as-is, or does the addition of real war stories mean it should shrink to one line?

---

## Not in scope

- Blog content changes
- Photography
- Any redesign, animation, or styling
- Certifications section (explicitly dropped)
- Metrics/KPI strips (explicitly dropped)
