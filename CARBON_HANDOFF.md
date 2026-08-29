DATE=2026-08-29
AI_WORKER=Claude
PROJECT=VNGO (vngo-build)
BRANCH=main
LAST_COMMIT=28ab86e
COMPLETED=
- Vendored the shared Carbon i18n runtime (js/i18n.js v2, css/i18n.css), built and verified first against SoulEntropy, generalized here with a new "overlay" mode: unlike SoulEntropy's per-locale pages, VNGO keeps ONE URL/locale (zh-CN, the site's real content locale) and swaps chrome text in place at runtime via data-i18n attributes. No new hreflang claims are made — this deliberately avoids the "thin duplicate SEO page" anti-pattern, since VNGO's long-form marketing copy (region descriptions, team-building narrative, FAQ answers, process steps) stays zh-CN-only for now.
- Added data-i18n attributes to VNGO's high-value UI surfaces per the user's Phase-1 scope: nav (brand tagline, 高尔夫/企业团建/关于我们/社区/定制行程), hero (h1 both lines, intro, both CTA buttons, 3 trust bullets), stats band (3 items), all 6 section H2/H3 headings (golf/team/story/process/inquiry/faq) plus the inquiry note, footer tagline, and the full login/signup flow (h1, hint text, both OAuth buttons, the "or use email code" hint, email/code/display-name labels, the code-sent hint, both step buttons per page, the "don't have an account / already have an account" switch lines).
- 11 real, hand-written (not machine-translated) locales populated in vngo/i18n-src/strings.json: zh-CN (source), zh-TW, en, vi, ko, ja, th, id, ms, hi, ar — matching the user's exact VNGO priority list in item C. registry.json marks ar as dir:"rtl"; all others ltr. 50 keys per locale, verified consistent (no missing/extra keys per locale) via a Node script before deploy.
- registry.json/strings.json/build-data.js live in i18n-src/ (source of truth); js/i18n-data.js is the generated runtime data file (regenerate via `node i18n-src/build-data.js i18n-src js/i18n-data.js` after any strings.json edit — do NOT hand-edit js/i18n-data.js).
- DELIBERATE SCOPE BOUNDARY — the lead-capture <form id="form" name="vngo-consult"> was NOT touched. Its <select> options (channel/service/budget) have no explicit value= attribute, so their Chinese text IS the value submitted to Netlify. Translating that text via data-i18n would silently change what value ends up in every lead record depending on the visitor's chosen language, corrupting the sales pipeline's data — a real business risk, not just a translation nicety. Fixing this properly means adding explicit value="<original-Chinese>" attributes first (a small, safe, additive change) and only then wiring data-i18n on the visible text; deferred instead of rushed. The whole form's visible text remains zh-CN.
- Dynamic JS-set auth messages (登录失败:/发送失败:/验证码已发送... inside the login/signup <script type="module"> blocks) were also NOT translated — they are string-concatenated at runtime inside the working OTP/OAuth flow logic, and touching them risks the "critical debug" surface for a UX gain scoped as lower priority than nav/CTA/forms per item B. Left as a documented follow-up.
- Backups of the three pre-change files kept at i18n-src/index.html.pre-i18n-backup, i18n-src/login.index.html.pre-i18n-backup, i18n-src/signup.index.html.pre-i18n-backup.
TESTED=
- All 3 changed pages (index/login/signup) parsed cleanly with BeautifulSoup (no broken tags) before deploy.
- Every data-i18n key used in the HTML cross-checked against strings.json keys — zero missing.
- Live Playwright functional test against the actual deployed HTML/JS/CSS (headless Chromium): 11-option language switcher renders and defaults to zh-CN; switching to English updates hero text, CTA text, <html lang> and dir correctly; switching to Arabic sets dir="rtl" and shows correct Arabic text; the untouched lead-form <option> ("微信") stays zh-CN as intended (scope-boundary check); a page reload after selecting Arabic re-applies Arabic from localStorage (LANGUAGE_PERSIST confirmed); a full sweep of every [data-i18n] element after the above found zero blank/"undefined" strings (FALLBACK safety confirmed). Same switcher+translation behavior re-verified independently on both login/index.html and signup/index.html (tested with vi).
NOT_TESTED=
- Real end-to-end OAuth/OTP login or lead-form submission through Netlify (out of scope for this pass — no functional/business logic was touched, only display text and only outside the form).
- Visual/CSS regression on narrow mobile widths with the new switcher control in the nav (added a plain <select>; no custom mobile styling written beyond the generic i18n.css rules).
- Cross-browser check beyond Chromium (Safari/Firefox not tested here).
BLOCKERS=
- GitHub push still not attempted from this environment this pass (per item H, not retried to avoid wasting quota) — repo kept clean and fast-forwardable; push should be attempted by the next OpenClaw heartbeat / whichever AI has network access next.
FILES_CHANGED=
index.html, login/index.html, signup/index.html (data-i18n attributes + i18n.css link + i18n runtime script tags added; no other content/logic changed), js/i18n.js (new), js/i18n-data.js (new, generated), css/i18n.css (new), i18n-src/registry.json (new), i18n-src/strings.json (new), i18n-src/build-data.js (new), i18n-src/*.pre-i18n-backup (new, safety backups), CARBON_HANDOFF.md (this file).
DATABASE_CHANGES=none
ROLLBACK=
Restore the three page files from i18n-src/*.pre-i18n-backup (or `git checkout origin/main -- index.html login/index.html signup/index.html`); the new css/js/i18n-src files are additive and can simply be left unused (deleting them is optional, not required for rollback) since nothing else references them except the 3 restored pages.
NEXT_ACTION=
1. (Safe, low-risk) Add explicit value="..." attributes to the vngo-consult form's <option> elements (channel/service/budget), preserving current Chinese text as the value, then add data-i18n to their visible text — unblocks safely translating the lead form.
2. Extend strings.json with the remaining "long-form" content (region descriptions, team-building narrative bullets, FAQ answers, process step descriptions) if/when the business decides that content is worth localizing — currently intentionally left as zh-CN fallback per the "no thin SEO" principle.
3. See I18N_TRANSLATION_QUEUE.json (repo root, to be added alongside this handoff by the same P2 pass) for the structured list OpenClaw/Qwen can pick up for locale completeness scanning.
4. Attempt `git push origin main` once network to GitHub is confirmed working (last known failures were DNS-resolution errors in safe_git_push logs, intermittent not permanent).
SAFE_TO_CONTINUE=yes
