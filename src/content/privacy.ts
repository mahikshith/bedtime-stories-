import policy from './privacy.json';

/**
 * The privacy policy.
 *
 * Both stores require one: Apple wants the link in App Store Connect AND
 * reachable inside the app in an easily accessible manner; Play requires the
 * same plus a matching Data safety declaration.
 *
 * The text lives in `privacy.json` so that the in-app screen and the hosted
 * page built by `scripts/build-privacy.mjs` cannot drift apart. Edit the JSON,
 * never a copy.
 *
 * It is short because the app genuinely collects nothing. Do not pad it.
 */

export interface PolicySection {
  heading: string;
  body: string[];
}

export const PRIVACY_CONTACT: string = policy.contact;
export const PRIVACY_UPDATED: string = policy.updated;
export const PRIVACY_TITLE: string = policy.title;
export const PRIVACY_POLICY: PolicySection[] = policy.sections;
