import amqp from "amqplib";
import { declareAndBind, SimpleQueueType, subscribeJSON, publishJSON } from "../internal/pubsub/pubsub.js";
import { ArmyMovesPrefix, ExchangePerilDirect, ExchangePerilTopic, PauseKey, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { GameState, type PlayingState } from "../internal/gamelogic/gamestate.js";
import { clientWelcome, commandStatus, getInput, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { handlerMove, handlerPause, handlerWar } from "./handlers.js";

async function main() {
  console.log("Starting Peril client...");

  const RABBIT_CONNECTION_URL = 'amqp://guest:guest@localhost:5672/';
  const conn = await amqp.connect(RABBIT_CONNECTION_URL);
  console.log("Successfully connected to Rabbit Server.")
  
  const publishCh = await conn.createConfirmChannel();

  const username = await clientWelcome();
  const gs:GameState = new GameState(username);

  //await declareAndBind(conn, ExchangePerilDirect, `${PauseKey}.${username}`, PauseKey, SimpleQueueType.Transient);
  await subscribeJSON(conn, ExchangePerilDirect, `${PauseKey}.${username}`, PauseKey, SimpleQueueType.Transient, handlerPause(gs));

  //await declareAndBind(conn, ExchangePerilTopic, armyMovesQueue, armyMovesKey, SimpleQueueType.Transient);
  await subscribeJSON(conn, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, `${ArmyMovesPrefix}.*`, SimpleQueueType.Transient, handlerMove(gs, publishCh));

  //await declareAndBind(conn, ExchangePerilTopic, WarRecognitionsPrefix, `${WarRecognitionsPrefix}.#`, SimpleQueueType.Durable);
  await subscribeJSON(conn, ExchangePerilTopic, WarRecognitionsPrefix, `${WarRecognitionsPrefix}.#`, SimpleQueueType.Durable, handlerWar(gs));

  while (true){
    const words = await getInput();
    if (words.length === 0){
      continue;
    }
    const word = words[0];

    switch (word){
      case "spawn":
        try {
          commandSpawn(gs, words);
        }
        catch (error){
          console.log(error);
        }
        break;
      case "move":
        try {
        const move = commandMove(gs, words);
        await publishJSON(publishCh, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, move);
        console.log("Move successful.");
        }
        catch (error){
          console.log(`Move failed: ${error}`);
        }
        break;
      case "status":
        await commandStatus(gs);
        break;
      case "help":
        printClientHelp();
        break;
      case "spam":
        console.log("Spamming not allowed yet!");
        break;
      case "quit":
        printQuit();
        process.exit(0);
      default:
        console.log("Invalid command");
        break;
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
