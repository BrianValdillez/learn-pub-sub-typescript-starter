import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/pubsub.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";

async function main() {
  console.log("Starting Peril server...");

  const RABBIT_CONNECTION_URL = 'amqp://guest:guest@localhost:5672/';
  const conn = await amqp.connect(RABBIT_CONNECTION_URL);
  console.log("Successfully connected to Rabbit Server.")

  const ch = await conn.createConfirmChannel();

  const playingState:PlayingState = {isPaused: true};
  await publishJSON(ch, ExchangePerilDirect, PauseKey, playingState);

  process.on('SIGINT', async () => {
    console.log("Shutting down...");
    await conn.close();
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
