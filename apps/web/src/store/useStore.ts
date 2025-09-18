import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SeedCampaign } from '@seed/campaignSeed';

export type CampaignMeta = {
  name: string;
  associateProducer?: string;
  associateEmail?: string;
  eventType?: 'virtual' | 'in_person';
  city?: string;
  state?: string;
  eventDates?: { date: string; time?: string; calendly?: string }[];
  launchDate?: string;
  locationsToScrape?: string[];
  associatePhone?: string;
  videoLink?: string;
  eventLink?: string;
  hotelName?: string;
  hotelAddress?: string;
};

export type CampaignStatus = 'draft' | 'enriching' | 'ready_for_personalization' | 'generating_emails' | 'ready_to_send' | 'active' | 'paused' | 'stopped';
export type EventType = 'virtual' | 'in_person';
export interface EventSlot { date: string; time: string; calendly_link?: string }
export interface Campaign {
  id: string; name: string; owner_name: string; owner_email: string; owner_phone?: string;
  city?: string; state?: string; videoLink?: string; eventLink?: string;
  event_type: EventType; event_date: string; event_slots?: EventSlot[];
  hotel_name?: string; hotel_address?: string; calendly_link?: string; target_cities?: string; launch_date?: string;
  status: CampaignStatus; total_contacts: number; enriched_contacts: number; emails_generated: number;
  template_id?: string;
  sender_email?: string;
}

export type ContactStatus =
  | 'No Activity'
  | 'Needs BDR'
  | 'Received RSVP'
  | 'Showed Up To Event'
  | 'Post Event #1'
  | 'Post Event #2'
  | 'Post Event #3'
  | 'Received Agreement'
  | 'Signed Agreement';

export type Contact = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  url?: string;
  status: ContactStatus;
  stageId?: string;
  raw: Record<string, string | number | null | undefined>;
};

export type ContentTemplateType = 'email'|'sms'|'voicemail';
export type ContentTemplate = {
  id: string;
  type: ContentTemplateType;
  name: string;
  subject?: string;
  body?: string;
  text?: string;
  tts_script?: string;
};

type Toast = { id: string; title: string; description?: string; variant?: 'success'|'error'|'info'|'warning' };

type StoreState = {
  campaigns: SeedCampaign[]; // funnel templates
  liveCampaigns: Campaign[]; // instantiated campaigns per spec
  contactsByCampaignId: Record<string, Contact[]>;
  contentTemplates: ContentTemplate[];
  campaignMetaById: Record<string, CampaignMeta | undefined>;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  setCampaigns: (c: SeedCampaign[]) => void;
  upsertCampaign: (c: SeedCampaign) => void;
  addLiveCampaign: (c: Campaign) => void;
  updateLiveCampaign: (id: string, update: Partial<Campaign>) => void;
  deleteLiveCampaign: (id: string) => void;
  replaceLiveCampaigns: (list: Campaign[]) => void;
  setContactsForCampaign: (id: string, contacts: Contact[]) => void;
  upsertContactForCampaign: (id: string, contact: Contact) => void;
  upsertContentTemplate: (t: ContentTemplate) => void;
  setCampaignMeta: (id: string, meta: CampaignMeta) => void;
};

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      campaigns: [],
      liveCampaigns: [],
      contactsByCampaignId: {},
      contentTemplates: [],
      campaignMetaById: {},
      toasts: [],
      addToast: (t) => set((s) => ({ toasts: [...s.toasts, { id: Math.random().toString(36).slice(2), ...t }] })),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      setCampaigns: (c) => set({ campaigns: c }),
      upsertCampaign: (c) => set((s) => {
        const exists = s.campaigns.some((x) => x.id === c.id);
        return { campaigns: exists ? s.campaigns.map((x) => (x.id === c.id ? c : x)) : [c, ...s.campaigns] };
      }),
      addLiveCampaign: (c) => set((s) => ({ liveCampaigns: [c, ...s.liveCampaigns] })),
      updateLiveCampaign: (id, update) => set((s) => ({ liveCampaigns: s.liveCampaigns.map((c) => (c.id === id ? { ...c, ...update } : c)) })),
      deleteLiveCampaign: (id) => set((s) => ({ liveCampaigns: s.liveCampaigns.filter((c) => c.id !== id) })),
      replaceLiveCampaigns: (list) => set(() => ({ liveCampaigns: list })),
      setContactsForCampaign: (id, contacts) => set((s) => ({ contactsByCampaignId: { ...s.contactsByCampaignId, [id]: contacts } })),
      upsertContactForCampaign: (id, contact) => set((s) => {
        const list = s.contactsByCampaignId[id] || [];
        const exists = list.some((c) => c.id === contact.id);
        const next = exists ? list.map((c) => (c.id === contact.id ? contact : c)) : [contact, ...list];
        return { contactsByCampaignId: { ...s.contactsByCampaignId, [id]: next } };
      }),
      upsertContentTemplate: (t) => set((s) => {
        const exists = s.contentTemplates.some((x) => x.id === t.id);
        return { contentTemplates: exists ? s.contentTemplates.map((x) => x.id === t.id ? t : x) : [t, ...s.contentTemplates] };
      }),
      setCampaignMeta: (id, meta) => set((s) => ({ campaignMetaById: { ...s.campaignMetaById, [id]: meta } })),
    }),
    { name: 'adtv-event-static-store' }
  )
);


