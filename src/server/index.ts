import amqp from "amqplib";
import { declareAndBind, publishJSON, SimpleQueueType, subscribeMsgPack } from "../internal/pubsub/pubsub.js";
import { ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey } from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";
import { handlerGameLog } from "./handlers.js";
import { decode } from "@msgpack/msgpack";
import { type GameLog } from "../internal/gamelogic/logs.js";

async function main() {
  console.log("Starting Peril server...");

  const RABBIT_CONNECTION_URL = 'amqp://guest:guest@localhost:5672/';
  const conn = await amqp.connect(RABBIT_CONNECTION_URL);
  console.log("Successfully connected to Rabbit Server.")

  const ch = await conn.createConfirmChannel();

  await subscribeMsgPack(conn, ExchangePerilTopic, GameLogSlug, `${GameLogSlug}.#`, SimpleQueueType.Durable, handlerGameLog);

  // Used to run the server from a non-interactive source, like the multiserver.sh file
  if (!process.stdin.isTTY) {
    console.log("Non-interactive mode: skipping command input.");
    return;
  }

  printServerHelp();

  let exit = false;
  while (!exit){
    const inputs= await getInput();

    if (inputs.length === 0){
      continue;
    }

    const word = inputs[0];

    switch(word){
      case "pause": {
        console.log("Sending pause message.");
        await publishJSON(ch, ExchangePerilDirect, PauseKey, {isPaused: true});
        break;
      }
      case "resume": {
        console.log("Sending resume message.");
        await publishJSON(ch, ExchangePerilDirect, PauseKey, {isPaused: false});
        break;
      }
      case "quit": {
        console.log("Shutting down the server...");
        exit = true;
        break;
      }
      default: {
        console.log("Unknown command");
        break;
      }
    }
  }

  process.on('SIGINT', async () => {
    console.log("Shutting down...");
    await conn.close();
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});