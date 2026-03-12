import { writeLog, type GameLog } from "../internal/gamelogic/logs.js";
import { AckType } from "../internal/pubsub/pubsub.js";

export function handlerGameLog(log:GameLog): AckType {
    writeLog(log);
    process.stdout.write("> ");

    return AckType.Ack;
}