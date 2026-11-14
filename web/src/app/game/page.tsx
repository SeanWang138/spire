import { redirect } from "next/navigation";

/** /game routes entrants directly to 1-Click Start onboarding. */
export default function GameIndex() {
  redirect("/game/start");
}
