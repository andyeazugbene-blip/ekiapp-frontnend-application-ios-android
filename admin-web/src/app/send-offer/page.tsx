import { redirect } from "next/navigation";

/**
 * Offers are marketing broadcasts and now go through the single governed
 * Communications flow (audience eligibility, consent, test send, confirm,
 * audit). The old page called the broadcast API without those controls.
 */
export default function SendOfferRedirect() {
  redirect("/communications");
}
