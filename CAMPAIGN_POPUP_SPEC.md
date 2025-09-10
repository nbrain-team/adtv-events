# Campaign Create Modal (Popup) – Functional Specification

## Trigger
- Clicking “New Campaign” on the Campaigns page opens the modal.

## Initial State
- Empty form with submit disabled until required fields are valid.

## Required Fields
- Campaign Name
- Associate Producer
- Event Type (In-Person or Virtual)
- Launch Date
- First Event Slot: Date + Time

## Form Fields (Top → Bottom)
1) Campaign Name (text, required)
2) Associate Producer (select, required)
   - Options (as configured): Kalena Conley, Evan Jones, Sigrid Smith, Amy Dodsworth, Bailey Jacobs
   - Selection maps to owner_name and owner_email; owner_phone is a separate field
3) Event Type (select, required)
   - Values: `in_person` or `virtual`
   - Reveals event-specific sections after selection
4) City (text)
5) State (text)
6) Event Dates & Times (slot list)
   - Slot 1: Date (required), Time (required)
   - Add Time Slot button
     - Max slots: 2 for In-Person, 3 for Virtual
   - For Virtual events only: each slot includes a Calendly Link field
   - Each additional slot optional; deletable if more than one slot
7) In-Person only section
   - Hotel Name (text)
   - Hotel Address (textarea)
   - Calendly Link (single, not per slot)
8) Launch Date (date, required)
9) Locations To Scrape (textarea; multiline list)
10) Associate Phone (text)
11) Video Link (text/URL)
12) Event Link (text/URL)

## Button State
- “Create Campaign” disabled until all required fields are valid.

## Submit Behavior
- Endpoint: `POST /api/campaigns`
- Payload mapping:
```json
{
  "name": "<string>",
  "owner_name": "<from Associate Producer>",
  "owner_email": "<from Associate Producer>",
  "owner_phone": "<string>",
  "video_link": "<string>",
  "event_link": "<string>",
  "city": "<string>",
  "state": "<string>",
  "launch_date": "YYYY-MM-DD",
  "event_type": "in_person | virtual",
  "event_slots": [
    { "date": "YYYY-MM-DD", "time": "HH:MM", "calendly_link": "<virtual only>" }
  ],
  "target_cities": "<multiline>",
  "hotel_name": "<in-person only>",
  "hotel_address": "<in-person only>",
  "calendly_link": "<in-person only>"
}
```

## Virtual vs In‑Person Logic
- Virtual:
  - Up to 3 time slots
  - Each slot supports a Calendly Link
- In-Person:
  - Up to 2 time slots
  - Single Calendly Link at the bottom (not per slot)
  - Hotel Name + Address fields appear

## Main Screen Context
- Header: “Event Campaign Builder” and “New Campaign” button
- Cards show: Name, Owner, Event Date, Event Type (Virtual/In-Person), enrichment progress and actions, key stats (Enriched, Emails, Sent)

## Source References
- UI & form logic: `frontend/src/pages/CampaignsPage.tsx`
- Post-create editing UX: `frontend/src/pages/CampaignDetailPage.tsx`
