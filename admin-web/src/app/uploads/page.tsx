import { redirect } from "next/navigation";

/** The raw storage browser was replaced by the exception-based Content Review queue (handbook 7). */
export default function UploadsRedirect() {
  redirect("/content-review");
}
