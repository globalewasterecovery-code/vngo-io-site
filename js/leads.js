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

function boundedText(value, max) {
  if (value == null) return null;
  var text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

export async function submitLead(opts) {
  var f = (opts && opts.fields) || {};
  var record = {
    site: 'vngo',
    source_page: boundedText(window.location.pathname, 500),
    source_campaign: boundedText(utmCampaign(), 200),
    language: boundedText(currentLanguage(), 35),
    country: boundedText(f.country, 100),
    name: boundedText(f.name, 200),
    contact_type: boundedText(f.contact_type, 50),
    contact_value: boundedText(f.contact_value, 320),
    travel_date: f.travel_date || null,
    party_size: f.party_size ? parseInt(f.party_size, 10) : null,
    service_type: boundedText(f.service_type, 100),
    budget_range: boundedText(f.budget_range, 100),
    message: boundedText(f.message, 5000),
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
  // The public domain is proxied in front of Netlify, so posting to `/` returns
  // the page but bypasses Netlify Forms. Send the fallback directly to the
  // stable Netlify site origin. `no-cors` is intentional: this is a write-only
  // backup channel and an opaque response still confirms the browser dispatched
  // the request. Supabase remains the canonical, verifiable lead store.
  var res = await fetch('https://vngo-io-site.netlify.app/', {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body,
  });
  if (res.type !== 'opaque' && !res.ok) throw new Error('netlify submit failed: ' + res.status);
  return res;
}
