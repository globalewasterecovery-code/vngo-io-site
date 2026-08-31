// WebMCP tool registration for VNGO (https://vngo.io).
//
// Exposes vngo.io's two existing, production quote-request flows (golf tour quotes and
// corporate team-building quotes) as agent-callable tools via the experimental
// `navigator.modelContext` browser API (https://github.com/webmachinelearning/webmcp),
// so an AI agent browsing vngo.io on a user's behalf can submit a real quote request
// directly, the same way a human filling in /golf-quote/ or /team-building/ already does.
//
// Deliberately reuses `submitLead()` from /js/leads.js verbatim -- the exact same function
// the human-facing forms call, which dual-writes to the canonical Supabase `leads` table
// and the Netlify Forms fallback. No new backend, no new validation path, no behavior
// change for the existing forms. If `navigator.modelContext` isn't supported (true for
// almost every browser today -- this is a draft standard), this file is a no-op.
//
// A `via_webmcp: true` marker is appended to every WebMCP-submitted lead's message field
// so it stays distinguishable from a human filling in the form directly -- see
// runtime/carbon-status/inbound-lead-monitor for how these get reviewed.
import { submitLead } from '/js/leads.js';

if ('modelContext' in navigator) {
  const CITY_OPTIONS = ['hcmc', 'danang', 'hanoi', 'undecided'];
  const CHANNEL_OPTIONS = ['wechat', 'whatsapp', 'zalo', 'email'];

  navigator.modelContext.registerTool({
    name: 'submit_golf_quote_request',
    description:
      "Request an estimated quote for a corporate golf trip in Vietnam (Ho Chi Minh City, "
      + "Da Nang/Hoi An, or Hanoi/Ha Long) via VNGO -- tee times, hotel class, ground "
      + "transport, VIP arrival service and gala/team-building add-ons. Returns an estimate "
      + "request, not a confirmed booking; VNGO follows up with the requester on their chosen "
      + "contact channel with real pricing once tee-time availability is confirmed.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Requester name' },
        country: { type: 'string', description: 'Requester country or region' },
        channel: { type: 'string', enum: CHANNEL_OPTIONS, description: 'Preferred contact channel' },
        contact: { type: 'string', description: 'Contact handle/number/email for the chosen channel' },
        city: { type: 'string', enum: CITY_OPTIONS, description: 'Target city, or "undecided"' },
        date: { type: 'string', description: 'Planned date, YYYY-MM-DD' },
        players: { type: 'integer', minimum: 1, description: 'Number of players' },
        rounds: { type: 'integer', minimum: 1, description: 'Planned number of rounds' },
        hotel_class: { type: 'string', enum: ['4star', '5star', 'luxury'], description: 'Optional hotel class' },
        transport: { type: 'string', enum: ['sedan', 'van', 'bus'], description: 'Optional ground transport' },
        vip_arrival: { type: 'boolean', description: 'Requesting VIP fast-track arrival service' },
        gala_team_building: { type: 'boolean', description: 'Requesting an add-on gala dinner or team building' },
        message: { type: 'string', description: 'Any additional notes' },
      },
      required: ['name', 'country', 'channel', 'contact', 'city', 'date', 'players', 'rounds'],
    },
    annotations: { readOnlyHint: false },
    async execute(input) {
      const notes = [];
      if (input.city) notes.push('城市: ' + input.city);
      if (input.rounds) notes.push('计划场次: ' + input.rounds);
      if (input.hotel_class) notes.push('酒店等级: ' + input.hotel_class);
      if (input.transport) notes.push('交通: ' + input.transport);
      if (input.vip_arrival) notes.push('需要VIP接机');
      if (input.gala_team_building) notes.push('需要晚宴/团建');
      if (input.message) notes.push(input.message);
      notes.push('via_webmcp: true');

      const netlifyFields = {
        name: input.name, country: input.country, channel: input.channel, contact: input.contact,
        city: input.city, date: input.date, players: String(input.players), rounds: String(input.rounds),
        hotel_class: input.hotel_class || '', transport: input.transport || '',
        vip_arrival: input.vip_arrival ? 'yes' : '', gala_team_building: input.gala_team_building ? 'yes' : '',
        message: input.message || '',
      };

      const result = await submitLead({
        formName: 'vngo-golf-quote',
        netlifyFields,
        fields: {
          name: input.name, country: input.country,
          contact_type: input.channel, contact_value: input.contact,
          party_size: input.players, travel_date: input.date,
          service_type: 'golf', budget_range: null,
          message: notes.join(' | '),
        },
      });
      return result.ok
        ? { status: 'submitted', note: 'VNGO will follow up on the chosen contact channel with a real quote.' }
        : { status: 'failed', note: 'Submission could not be delivered; ask the user to try https://vngo.io/golf-quote/ directly.' };
    },
  });

  navigator.modelContext.registerTool({
    name: 'submit_team_building_quote_request',
    description:
      'Request an estimated quote for a corporate team-building event in Vietnam via VNGO -- '
      + 'venue, hotel, transport and gala dinner add-on, by city, headcount, objective and '
      + 'budget. Returns an estimate request, not a confirmed booking.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' }, country: { type: 'string' },
        channel: { type: 'string', enum: CHANNEL_OPTIONS },
        contact: { type: 'string' },
        headcount: { type: 'integer', minimum: 1 },
        city: { type: 'string', enum: CITY_OPTIONS },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        budget: { type: 'string', description: 'Free-text budget range' },
        objective: { type: 'string', description: 'e.g. cross-team icebreaker, annual incentive trip' },
        setting: { type: 'string', description: 'Venue preference' },
        hotel_class: { type: 'string', enum: ['4star', '5star', 'luxury'] },
        transport: { type: 'string', enum: ['sedan', 'van', 'bus'] },
        gala: { type: 'boolean', description: 'Requesting an add-on themed gala dinner' },
        message: { type: 'string' },
      },
      required: ['name', 'country', 'channel', 'contact', 'headcount', 'city', 'date'],
    },
    annotations: { readOnlyHint: false },
    async execute(input) {
      const notes = [];
      if (input.objective) notes.push('目标: ' + input.objective);
      if (input.setting) notes.push('场地: ' + input.setting);
      if (input.hotel_class) notes.push('酒店等级: ' + input.hotel_class);
      if (input.transport) notes.push('交通: ' + input.transport);
      if (input.gala) notes.push('需要主题晚宴');
      if (input.message) notes.push(input.message);
      notes.push('via_webmcp: true');

      const netlifyFields = {
        name: input.name, country: input.country, channel: input.channel, contact: input.contact,
        headcount: String(input.headcount), city: input.city, date: input.date,
        budget: input.budget || '', objective: input.objective || '', setting: input.setting || '',
        hotel_class: input.hotel_class || '', transport: input.transport || '',
        gala: input.gala ? 'yes' : '', message: input.message || '',
      };

      const result = await submitLead({
        formName: 'vngo-team-building-quote',
        netlifyFields,
        fields: {
          name: input.name, country: input.country,
          contact_type: input.channel, contact_value: input.contact,
          party_size: input.headcount, travel_date: input.date,
          service_type: 'team_building', budget_range: input.budget || null,
          message: notes.join(' | '),
        },
      });
      return result.ok
        ? { status: 'submitted', note: 'VNGO will follow up on the chosen contact channel with a real quote.' }
        : { status: 'failed', note: 'Submission could not be delivered; ask the user to try https://vngo.io/team-building/ directly.' };
    },
  });
}
