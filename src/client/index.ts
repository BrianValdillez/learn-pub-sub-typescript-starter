import amqp from "amqplib";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/pubsub.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";
import { clientWelcome } from "../internal/gamelogic/gamelogic.js";

async function main() {
  console.log("Starting Peril client...");

  const RABBIT_CONNECTION_URL = 'amqp://guest:guest@localhost:5672/';
  const conn = await amqp.connect(RABBIT_CONNECTION_URL);
  console.log("Successfully connected to Rabbit Server.")
  
  const ch = await conn.createConfirmChannel();

  const username = await clientWelcome();

  await declareAndBind(conn, ExchangePerilDirect, `${PauseKey}.${username}`, PauseKey, SimpleQueueType.Transient);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
