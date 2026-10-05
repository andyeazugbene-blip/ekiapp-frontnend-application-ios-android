import { redirect } from "next/navigation";

/** Reports now live in Content Review's Reports tab. */
export default function ContentReportsRedirect() {
  redirect("/content-review?tab=reports");
}
