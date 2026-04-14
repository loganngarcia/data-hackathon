/** One person’s generated contact methods + mail draft (synthetic; UI presents as normal work contacts). */
export type OrgOutreachPersonDraft = {
  contactEmail: string;
  /** E.164 or digits-only string safe for `tel:` href */
  phoneTel: string;
  emailSubject: string;
  emailBody: string;
};

export type OrgOutreachDraftResponse = {
  people: OrgOutreachPersonDraft[];
};
