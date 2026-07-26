/**
 * Crisis support resources, in one editable file (PSD 3.6).
 *
 * [VERIFY BEFORE DEMO DAY] Both entries below are UK and both are asserted from
 * the brief rather than checked against the provider on the day. Confirm the
 * Samaritans number and that Practitioner Health is still accepting self-referral
 * before a clinician judge reads them off the screen.
 *
 * Practitioner Health earns its place over a generic helpline because it is
 * specific to this population and, critically, is reached without going through
 * an employer — which is the thing the user is avoiding.
 */
export const CRISIS_RESOURCES = [
  {
    name: 'Samaritans',
    detail: 'Any time, day or night. Free from any phone.',
    action: '116 123',
    href: 'tel:116123',
  },
  {
    name: 'NHS Practitioner Health',
    detail: 'A confidential NHS service for healthcare staff. You refer yourself; your employer is not involved.',
    action: 'practitionerhealth.nhs.uk',
    href: 'https://www.practitionerhealth.nhs.uk',
  },
];

/**
 * The card's own words. Short, and not counselling — it points, and then it stops
 * talking. No reassurance, no assessment, no follow-up question.
 */
export const CRISIS_HEADING = 'Worth talking to someone who can sit with this properly.';
