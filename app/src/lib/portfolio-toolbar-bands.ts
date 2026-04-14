/**
 * Shared bucket IDs for Employees / Volunteers toolbar filters (aligned with Worker query params).
 */

export const COUNT_BAND_IDS = ["all", "0_1", "1_10", "10_50", "50_100", "100p"] as const;
export type CountBandId = (typeof COUNT_BAND_IDS)[number];

/** Menu row labels (tiers are inclusive on both ends where ranges overlap — matches Worker SQL). */
export const COUNT_BAND_MENU_LABELS: Record<Exclude<CountBandId, "all">, string> = {
  "0_1": "0–1",
  "1_10": "1–10",
  "10_50": "10–50",
  "50_100": "50–100",
  "100p": "100+",
};

export function isCountBandId(s: string): s is CountBandId {
  return (COUNT_BAND_IDS as readonly string[]).includes(s);
}

/** US states + DC, A–Z by full name; value is USPS abbreviation. */
export const US_STATE_OPTIONS: { abbrev: string; name: string }[] = [
  { abbrev: "AL", name: "Alabama" },
  { abbrev: "AK", name: "Alaska" },
  { abbrev: "AZ", name: "Arizona" },
  { abbrev: "AR", name: "Arkansas" },
  { abbrev: "CA", name: "California" },
  { abbrev: "CO", name: "Colorado" },
  { abbrev: "CT", name: "Connecticut" },
  { abbrev: "DE", name: "Delaware" },
  { abbrev: "DC", name: "District of Columbia" },
  { abbrev: "FL", name: "Florida" },
  { abbrev: "GA", name: "Georgia" },
  { abbrev: "HI", name: "Hawaii" },
  { abbrev: "ID", name: "Idaho" },
  { abbrev: "IL", name: "Illinois" },
  { abbrev: "IN", name: "Indiana" },
  { abbrev: "IA", name: "Iowa" },
  { abbrev: "KS", name: "Kansas" },
  { abbrev: "KY", name: "Kentucky" },
  { abbrev: "LA", name: "Louisiana" },
  { abbrev: "ME", name: "Maine" },
  { abbrev: "MD", name: "Maryland" },
  { abbrev: "MA", name: "Massachusetts" },
  { abbrev: "MI", name: "Michigan" },
  { abbrev: "MN", name: "Minnesota" },
  { abbrev: "MS", name: "Mississippi" },
  { abbrev: "MO", name: "Missouri" },
  { abbrev: "MT", name: "Montana" },
  { abbrev: "NE", name: "Nebraska" },
  { abbrev: "NV", name: "Nevada" },
  { abbrev: "NH", name: "New Hampshire" },
  { abbrev: "NJ", name: "New Jersey" },
  { abbrev: "NM", name: "New Mexico" },
  { abbrev: "NY", name: "New York" },
  { abbrev: "NC", name: "North Carolina" },
  { abbrev: "ND", name: "North Dakota" },
  { abbrev: "OH", name: "Ohio" },
  { abbrev: "OK", name: "Oklahoma" },
  { abbrev: "OR", name: "Oregon" },
  { abbrev: "PA", name: "Pennsylvania" },
  { abbrev: "RI", name: "Rhode Island" },
  { abbrev: "SC", name: "South Carolina" },
  { abbrev: "SD", name: "South Dakota" },
  { abbrev: "TN", name: "Tennessee" },
  { abbrev: "TX", name: "Texas" },
  { abbrev: "UT", name: "Utah" },
  { abbrev: "VT", name: "Vermont" },
  { abbrev: "VA", name: "Virginia" },
  { abbrev: "WA", name: "Washington" },
  { abbrev: "WV", name: "West Virginia" },
  { abbrev: "WI", name: "Wisconsin" },
  { abbrev: "WY", name: "Wyoming" },
].sort((a, b) => a.name.localeCompare(b.name, "en"));
