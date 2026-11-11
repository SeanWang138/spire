import { redirect } from "next/navigation";

/** /game is the shell — land players on the title screen. */
export default function GameIndex() {
  redirect("/game/start");
}
