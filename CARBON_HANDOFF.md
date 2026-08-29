DATE=2026-08-29
AI_WORKER=Claude
PROJECT=VNGO (vngo-io-site / vngo.io)
BRANCH=main
LAST_COMMIT=(see `git log -1` after this commit — P3 conversion build)
COMPLETED=
i18n (P2, prior commits 28ab86e/bef18ff/310d437): 11-locale overlay-mode chrome vocabulary, RTL, fallback, persistence — unchanged this pass.
P3 conversion build (this pass):
- Rebuilt the homepage #inquiry form into a proper "Request a Quote" form: exactly 8 required fields (Name, Country/Region, Contact channel, Contact value, Travelers, Estimated date, Main need, Budget range) plus optional Company/Destination/Notes. All <select> options now carry explicit value= attributes (wechat/whatsapp/zalo/email, golf/team_building/ground_service/business_reception/mice/other, economy/premium/luxury/undecided) — this also retroactively fixes the value-corruption risk flagged in the P2 handoff (visible text no longer doubles as the submitted value).
- New pages, each a self-contained form wired the same way: /golf-quote/ (city/date/players/rounds/hotel class/transport/VIP arrival/gala-team-building checkbox/notes, "Estimated/Request latest quote" language, no hardcoded course pricing), /team-building/ (headcount/city/objective/date/budget/indoor-outdoor/gala/hotel/transport), /corporate/ (MICE entry — role select: HR/Admin, Travel Planner, Overseas Agency, Golf Club, Event Company; role pre-fillable via ?role= query param), /partner/ (B2B "Partner With Us" — partner type: travel agency/corporate admin/golf society/event company/other).
- Added a "Start Here" quick-action CTA strip and a dark MICE/Corporate teaser section (role chips linking to /corporate/?role=...) to the homepage, unifying CTAs: Get a Quote / Plan My Vietnam Trip / Plan Corporate Golf / Plan Team Building / Partner With Us.
- Kept WhatsApp/WeChat/Zalo/Email as the only contact channels everywhere; mobile-first (all new pages use the existing responsive .two/.form-wrap grid pattern with a 640px breakpoint collapsing to 1 column).
- No fabricated customer counts, partner courses, case studies, order numbers, or reviews anywhere in new copy.
- Carbon standardized Lead pipeline: new `js/leads.js` — every form (existing #inquiry plus the 4 new pages) now calls `submitLead()`, which best-effort dual-writes to (a) a new Supabase `leads` table matching the Carbon schema exactly (lead_id/site/source_page/source_campaign/language/country/name/contact_type/contact_value/travel_date/party_size/service_type/budget_range/message/created_at/status) and (b) the existing Netlify Forms endpoint (unchanged mechanism, so nothing regresses). Either succeeding counts as a successful submission.
- `supabase/migrations/20260829_create_leads.sql` — full CREATE TABLE + RLS policies (anon: insert-only; authenticated: select/update) for the `leads` table. NOT YET APPLIED — see BLOCKERS.
- Sitemap updated with the 4 new URLs.
TESTED=
- python3 html.parser on index.html + all 4 new pages: PARSE_OK, zero "undefined" leaks.
- node --check on every extracted <script type="module"> block across all 5 pages: syntax OK.
- Static local http.server + curl: all 5 new/changed URLs plus /login/ and /signup/ return HTTP 200.
- Isolated Node unit test of js/leads.js against mocked Supabase + fetch: verified (a) the exact Carbon-schema record shape is produced from form fields with correct type coercion (party_size parsed to int, status defaulted to 'new', site='vngo', source_page from window.location.pathname), (b) when the Supabase insert fails (simulating the not-yet-applied migration), the function still returns ok:true via the Netlify fallback and logs a non-fatal warning, (c) when both succeed, both are attempted and both report ok. All assertions passed (ALL_LEADS_JS_TESTS_PASSED).
- Confirmed all 4 new pages' CSS depends only on classes/vars already defined in assets/site.css (--ink/--green/--muted, .btn/.primary/.ghost, .tags, .eyebrow, .dark, .section) — no new stylesheet needed.
NOT_TESTED=
- Live browser round-trip (no Playwright/Chromium and no network egress available in this Mac sandbox this pass — same environment constraint as VietChipHub's tail this session).
- End-to-end Supabase insert against the real `leads` table (table does not exist yet — see BLOCKERS). Netlify Forms submission itself also not live-tested (needs the deployed site).
- Cross-browser/device manual QA.
BLOCKERS=
1) supabase/migrations/20260829_create_leads.sql has NOT been applied to the live Supabase project — this session only has the anon publishable key (from js/supabase-client.js), which cannot run DDL. Needs the user or an ops session with dashboard/service-role access to run it. Until then, leads still land via Netlify Forms only (no data loss, just not yet in Carbon's canonical store).
2) GitHub push not (re-)attempted this pass — same persistent 403-from-proxy condition documented earlier this engagement; one attempt per repo was already used, not retried per standing rule.
FILES_CHANGED=
index.html (form rewrite + new sections + submit handler), index.html.pre-p3-backup (new, pre-P3 snapshot), sitemap.xml, js/leads.js (new), supabase/migrations/20260829_create_leads.sql (new), golf-quote/index.html (new), team-building/index.html (new), corporate/index.html (new), partner/index.html (new), I18N_TRANSLATION_QUEUE.json (synced from carbon-base with VietChipHub-done/VietnamZiChan-blocked status updates), CARBON_MASTER_HANDOFF.md (new, cross-project handoff copy), CARBON_TASK_QUEUE.json (new, OpenClaw/Qwen delegation list), CARBON_HANDOFF.md (this file).
DATABASE_CHANGES=
New Supabase table `public.leads` DEFINED (migration file written) but NOT YET APPLIED to the live project. See BLOCKERS #1.
ROLLBACK=
Restore index.html from index.html.pre-p3-backup; delete js/leads.js, supabase/migrations/, golf-quote/, team-building/, corporate/, partner/; revert sitemap.xml's 4 new <url> entries. No live database rollback needed since the migration was never applied.
NEXT_ACTION=
1. Apply supabase/migrations/20260829_create_leads.sql (dashboard or service-role access required) — this alone flips the Lead pipeline from PARTIAL to a real working PASS with zero further code changes.
2. Live browser verification of all 5 forms once deployed (Netlify build + Supabase insert both landing correctly).
3. See CARBON_TASK_QUEUE.json for delegated OpenClaw/Qwen follow-ups (test submissions, sitemap/health checks, git-safety push retries).
SAFE_TO_CONTINUE=yes

UPDATE_2026_08_29_SUPABASE=
- Applied the security-hardened leads migration in the production Supabase dashboard after explicit user confirmation.
- Before applying, removed the unsafe generic authenticated SELECT/UPDATE policies because community accounts share that role; commit 927dc29 records the hardened migration.
- Independent verification query returned public.leads, 16 columns, RLS enabled, and exactly one policy: anon INSERT. No generic authenticated read/update access remains.
- T11 is DONE. T09 remains pending until VNGO is pushed and deployed; no fabricated production lead was inserted during migration verification.

UPDATE_2026_08_29_LEADS_HARDENING=
- Applied supabase/migrations/20260829_harden_leads.sql after explicit user confirmation.
- Added 11 new-write constraints for source/language/country/name/contact/party-size/service/budget/message bounds; existing rows were preserved with NOT VALID constraints while new rows are enforced immediately.
- Replaced the anon policy with a strict check requiring site='vngo' and status='new'.
- Independent pg_catalog verification returned RLS=true, 13 named constraints total (11 new bounds plus the existing key/status constraints), and exactly one anon INSERT policy with the expected site/status condition.
- Client js/leads.js now trims and bounds text consistently; commit 993eaf3. No production test lead was inserted.
