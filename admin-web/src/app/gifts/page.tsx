import { redirect } from "next/navigation";

// Gifts & Rewards and Hot Deals now live on /hot-deals; purchased gift cards on /gift-cards.
export default function GiftsRedirectPage() {
  redirect("/hot-deals");
}
