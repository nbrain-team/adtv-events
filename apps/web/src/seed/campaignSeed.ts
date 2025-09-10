export type Node = {
  id: string;
  type: string;
  name: string;
};

export type Edge = {
  from: string;
  to: string;
  condition?: Record<string, unknown>;
};

export type CampaignGraph = {
  schema_version: number;
  nodes: Node[];
  edges: Edge[];
  start_rules: Record<string, unknown>;
};

export const eventCampaignGraph: CampaignGraph = {
  schema_version: 1,
  nodes: [
    { id: 'N00', type: 'start', name: 'Event Master List' },
    { id: 'N10', type: 'stage', name: 'Campaign 1' },
    { id: 'N11', type: 'email_send', name: 'Email 1' },
    { id: 'N12', type: 'sms_send', name: 'SMS 1' },
    { id: 'N13', type: 'voicemail_drop', name: 'ElevenLabs VOICEMAIL DROP 1' },
    { id: 'N14', type: 'web_request', name: 'Pull Analytics' },
    { id: 'N15', type: 'decision', name: 'Check Data' },
    { id: 'N20', type: 'email_send', name: 'RSVP Email' },
    { id: 'N21', type: 'decision', name: 'Event Type Decision' },
    { id: 'N30', type: 'stage', name: 'Campaign 2 (+3 days)' },
    { id: 'N31', type: 'email_send', name: 'Email 2' },
    { id: 'N32', type: 'sms_send', name: 'SMS 2' },
    { id: 'N33', type: 'voicemail_drop', name: 'ElevenLabs VOICEMAIL DROP 2' },
    { id: 'N40', type: 'wait', name: 'Nurture (Sign Up Date Based)' },
    { id: 'N50', type: 'web_request', name: 'Virtual Event – Calendly Link' },
    { id: 'N53', type: 'webhook_wait', name: 'Confirmation via Calendly' },
    { id: 'N51', type: 'task', name: 'In Person – Email Coordinated/BDR' },
    { id: 'N52', type: 'task', name: 'BDR Responds' },
    { id: 'N54', type: 'task', name: 'BDR Confirmation' },
    { id: 'N60', type: 'stage', name: 'Event Day' },
    { id: 'N61', type: 'web_request', name: 'Virtual Event BDR TRIGGERS' },
    { id: 'N63', type: 'sms_send', name: 'Text Confirmation 8am event day' },
    { id: 'N62', type: 'email_send', name: 'Big Email During Event' },
    { id: 'N64', type: 'sms_send', name: 'Biggie-Small SMS (+1hr)' },
    { id: 'N70', type: 'decision', name: 'Post-Event Outcomes' },
    { id: 'N71', type: 'email_send', name: 'No Shows Email' },
    { id: 'N73', type: 'email_send', name: 'Cancellations Email' },
    { id: 'N74', type: 'decision', name: 'Selects #1/#2/#3' },
    { id: 'N77', type: 'email_send', name: 'Click #2 – Questions/Calendly' },
    { id: 'N78', type: 'email_send', name: 'Final Email' },
    { id: 'N79', type: 'decision', name: 'Question Response' },
    { id: 'N80', type: 'task', name: 'Attended / No Response → BDR' },
    { id: 'N81', type: 'task', name: 'BDR Outreach' },
    { id: 'N82', type: 'esign', name: 'eSign Agreement' },
    { id: 'N83', type: 'goal', name: 'Signs' },
    { id: 'N84', type: 'web_request', name: 'Podio Entry Created' },
    { id: 'N85', type: 'decision', name: 'No Signature?' },
    { id: 'N86', type: 'wait', name: 'eSign Follow Up (+1d)' },
    { id: 'N59', type: 'exit', name: 'Stop' },
    { id: 'N89', type: 'exit', name: 'Stop' }
  ],
  edges: [
    { from: 'N00', to: 'N10' },
    { from: 'N10', to: 'N11' },
    { from: 'N11', to: 'N12', condition: { after: 'PT10M' } },
    { from: 'N12', to: 'N13', condition: { after: 'P1D' } },
    { from: 'N13', to: 'N14' },
    { from: 'N14', to: 'N15' },
    { from: 'N15', to: 'N20', condition: { label: 'Pos Response' } },
    { from: 'N15', to: 'N52', condition: { label: 'Question Response' } },
    { from: 'N15', to: 'N59', condition: { label: 'Neg Response' } },
    { from: 'N15', to: 'N30', condition: { label: 'No Response' } },
    { from: 'N30', to: 'N31', condition: { after: 'P3D' } },
    { from: 'N31', to: 'N32', condition: { after: 'PT10M' } },
    { from: 'N32', to: 'N33', condition: { after: 'P1D' } },
    { from: 'N40', to: 'N20' },
    { from: 'N20', to: 'N21' },
    { from: 'N21', to: 'N50', condition: { label: 'Virtual' } },
    { from: 'N21', to: 'N51', condition: { label: 'In Person' } },
    { from: 'N50', to: 'N53' },
    { from: 'N53', to: 'N54', condition: { on: 'success' } },
    { from: 'N51', to: 'N54' },
    { from: 'N54', to: 'N60' },
    { from: 'N60', to: 'N61' },
    { from: 'N60', to: 'N63', condition: { at_local: '08:00' } },
    { from: 'N60', to: 'N62' },
    { from: 'N62', to: 'N64', condition: { after: 'PT1H' } },
    { from: 'N60', to: 'N70', condition: { after: 'PT4H' } },
    { from: 'N70', to: 'N71', condition: { label: 'no shows' } },
    { from: 'N70', to: 'N73', condition: { label: 'Cancellations' } },
    { from: 'N70', to: 'N80', condition: { label: 'Attended / No Response' } },
    { from: 'N71', to: 'N82' },
    { from: 'N73', to: 'N82' },
    { from: 'N80', to: 'N81' },
    { from: 'N82', to: 'N83', condition: { on: 'signed' } },
    { from: 'N82', to: 'N85', condition: { on: 'sent' } },
    { from: 'N85', to: 'N86' },
    { from: 'N86', to: 'N82' },
    { from: 'N83', to: 'N84' },
    { from: 'N83', to: 'N89' }
  ],
  start_rules: {
    enroll: [{ type: 'segment', segment_id: 'event_master_list' }],
    reentry_policy: 'single_entry',
    quiet_hours: { start: '21:00', end: '08:00', contact_timezone: true },
    caps: { email_per_day: 2, sms_per_day: 1, voicemail_per_day: 1 }
  }
};

export type SeedCampaign = {
  id: string;
  name: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  graph: CampaignGraph;
};

export const seedCampaigns: SeedCampaign[] = [
  {
    id: 'cmp_event_ad_tv',
    name: 'ADTV: Realtor Event Campaign',
    status: 'draft',
    version: 1,
    graph: eventCampaignGraph,
  },
];


