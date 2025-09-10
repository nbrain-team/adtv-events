# Event Campaign Builder - Detail View Specification

## Tabs
- Overview
- Contacts
- RSVPs
- Create Communications
- Analytics
- Map View

## Core Data Models

### Campaign
- id: string
- name: string
- owner_name: string
- owner_email: string
- owner_phone?: string
- city?: string
- state?: string
- video_link?: string
- event_link?: string
- event_type: 'virtual' | 'in_person'
- event_date: ISO date string
- event_slots?: Array<{ date: string; time: string; calendly_link?: string }>
- hotel_name?: string
- hotel_address?: string
- calendly_link?: string
- target_cities?: string (multiline)
- status: 'draft' | 'enriching' | 'ready_for_personalization' | 'generating_emails' | 'ready_to_send'
- total_contacts: number
- enriched_contacts: number
- emails_generated: number

### Contact
- id: string
- first_name?: string
- last_name?: string
- email?: string
- phone?: string
- enriched_phone?: string
- company?: string
- title?: string
- enriched_company?: string
- enriched_title?: string
- neighborhood?: string
- is_rsvp?: boolean
- enrichment_status?: 'success' | 'failed' | 'processing' | 'pending'
- email_status?: 'generated' | 'sent' | other
- agreement_status?: 'signed' | 'viewed' | 'sent' | 'failed'
- excluded?: boolean
- geocoded_address?: string

## Overview Tab
- Header: back button, campaign title, owner_name, event_date, event_type
- Campaign Details (view/edit):
  - Campaign Name
  - Event Type (read-only in edit)
  - Associate Producer: owner_name
  - Associate Email: owner_email
  - Associate Phone: owner_phone
  - City, State
  - Video Link, Event Link
  - Launch Date (date)
  - If in_person: Event Date/Time (2 slots), Hotel Name/Address, Calendly Link
  - If virtual: up to 3 slots with Date, Time, Calendly Link
  - Locations To Scrape: target_cities (textarea)
  - Actions: Save, Cancel
- Quick Actions:
  - Refresh (reload campaign/contacts/enrichment)
  - Upload Contacts CSV (when status==='draft' or total_contacts===0)
  - Enrichment progress (when status==='enriching')
  - Generate Personalized Emails (when status==='ready_for_personalization')
  - Send Emails (placeholder when status==='ready_to_send')
- Contact Locations (mini map): mapped/unmapped badges, clustered markers, hotel marker (in_person)

## Contacts Tab
- Search input
- Bulk actions (visible on selection): Exclude/Include, Move to RSVP, Bulk Edit
- Table columns: Select, First Name, Last Name, Email, Phone, Company, Title, Neighborhood, Enrichment Status, Email Status, Agreement Status, Actions

## RSVPs Tab
- Shows contacts with is_rsvp===true
- Same table look-and-feel as Contacts

## Create Communications Tab
- Step 1: Select Contacts (All or RSVPs)
- Step 2: Select Email Templates (checkbox list; supports edit)
- Step 3: Generate CSV with columns:
  - ID, First Name, Last Name, Email, Phone, Company, Title, Neighborhood
  - For each selected template: "<TemplateName> Subject", "<TemplateName> Body"
- Generated Files list: Create Google Sheet, Download CSV, Delete
- Email Template Manager modal:
  - Fields: name, subject, body, template_type
  - Upload image to /api/campaigns/{campaignId}/upload-image; copy <img> HTML into body
  - Quick Insert buttons: [[VIDEO-LINK]], [[Event-Link]], [[Calendly Link]], mailto[[Associate email]]

## Mail-merge Placeholders
- Contact: {{FirstName}}, {{LastName}}, {{Email}}, {{Phone}}, {{Company}}, {{Title}}, {{Neighborhood}} (+ lowercase variants)
- Campaign: [[Associate Name]], [[Associate email]], [[Associate Phone]], [[City]], [[State]], [[VIDEO-LINK]], [[Event-Link]], [[Hotel Name]], [[Hotel Address]], [[Date1]]/[[Time1]] ... [[Date3]]/[[Time3]], [[Calendly Link]] and indexed variants

## Analytics Tab
- Enrichment Statistics (pie)
- Success Rates: Enrichment %, Email Generation %
- Data Capture Rates: Email %, Phone %
- Data Sources: Original/Enriched Emails, Original/Enriched Phones

## Map View Tab
- Non-excluded contacts rendered with derived coordinates
- Coordinate sources: state geocode cache, geocoded_address, known neighborhood centroids
- Hotel marker when applicable

## Minimal TypeScript Types
```ts
type CampaignStatus = 'draft' | 'enriching' | 'ready_for_personalization' | 'generating_emails' | 'ready_to_send';

type EventType = 'virtual' | 'in_person';

interface EventSlot { date: string; time: string; calendly_link?: string; }

interface Campaign {
  id: string; name: string; owner_name: string; owner_email: string; owner_phone?: string;
  city?: string; state?: string; video_link?: string; event_link?: string;
  event_type: EventType; event_date: string; event_slots?: EventSlot[];
  hotel_name?: string; hotel_address?: string; calendly_link?: string; target_cities?: string;
  status: CampaignStatus; total_contacts: number; enriched_contacts: number; emails_generated: number;
}

type EnrichmentStatus = 'success' | 'failed' | 'processing' | 'pending';

type AgreementStatus = 'signed' | 'viewed' | 'sent' | 'failed';

interface Contact {
  id: string; first_name?: string; last_name?: string; email?: string;
  phone?: string; enriched_phone?: string; company?: string; title?: string;
  enriched_company?: string; enriched_title?: string; neighborhood?: string; is_rsvp?: boolean;
  enrichment_status?: EnrichmentStatus; email_status?: string; agreement_status?: AgreementStatus;
  excluded?: boolean; geocoded_address?: string;
}
```
