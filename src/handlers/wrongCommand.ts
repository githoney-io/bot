import minimist from "minimist";
import { callEp } from "../helpers";

// Calls to {BACKEND_URL}/metrics/wron-cmd (POST)
export async function collectWrongCommand(parsed: minimist.ParsedArgs) {
  try {
    const command = parsed._[0];

    await callEp("metrics/wrong-cmd", {
      command,
      args: parsed
    });
  } catch (err) {
    console.error("Failed to collect wrong command", err);
  }
}
