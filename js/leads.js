// Carbon standardized Lead submission helper — shared by every VNGO quote/partner form.
//
// Design: best-effort DUAL WRITE.
//   1) Supabase `leads` table (Carbon's canonical, queryable/exportable lead store).
//   2) The existing Netlify Forms endpoint (unchanged mechanism already relied on today).
// Both are attempted in parallel; either succeeding counts as a successful submission, so
// nothing regresses even before supabase/migrations/20260829_create_leads.sql has been applied
// (the Supabase insert just fails silently and is logged, Netlify still captures the lead).
import { supabase } from '/js/supabase-client.js';

function currentLanguage() {
  try { return document.documentElement.lang || 'zh-CN'; } catch (e) { return 'zh-CN'; }
}

function utmCampaign() {
  try { return new URLSearchParams(window.location.search).get('utm_campaign') || null; } catch (e) { return null; }
}

export async function submitLead(opts) {
  var f = (opts && opts.fields) || {};
  var record = {
    site: 'vngo',
    source_page: window.location.pathname,
    source_campaign: utmCampaign(),
    language: currentLanguage(),
    country: f.country || null,
    name: f.name || null,
    contact_type: f.contact_type || null,
    contact_value: f.contact_value || null,
    travel_date: f.travel_date || null,
    party_size: f.party_size ? parseInt(f.party_size, 10) : null,
    service_type: f.service_type || null,
    budget_range: f.budget_range || null,
    message: f.message || null,
    status: 'new',
  };

  var results = await Promise.allSettled([
    supabase.from('leads').insert(record),
    netlifySubmit(opts.formName, opts.netlifyFields || {}),
  ]);

  var supaResult = results[0];
  var supaOk = supaResult.status === 'fulfilled' && !(supaResult.value && supaResult.value.error);
  var netlifyOk = results[1].status === 'fulfilled';

  if (supaResult.status === 'fulfilled' && supaResult.value && supaResult.value.error) {
    console.warn('[leads] Supabase insert failed (non-fatal, Netlify fallback used):', supaResult.value.error.message);
  } else if (supaResult.status === 'rejected') {
    console.warn('[leads] Supabase insert threw (non-fatal, Netlify fallback used):', supaResult.reason);
  }

  return { ok: supaOk || netlifyOk, supaOk: supaOk, netlifyOk: netlifyOk };
}

async function netlifySubmit(formName, fields) {
  var params = Object.assign({ 'form-name': formName }, fields);
  var body = Object.keys(params)
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k] == null ? '' : params[k]); })
    .join('&');
  var res = await fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body,
  });
  if (!res.ok) throw new Error('netlify submit failed: ' + res.status);
  return res;
}
