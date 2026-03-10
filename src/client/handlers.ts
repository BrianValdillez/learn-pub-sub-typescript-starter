import type { ConfirmChannel } from "amqplib";
import { ExchangePerilTopic, WarRecognitionsPrefix } from "../internal/routing/routing.js";

import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import type { ArmyMove, RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { AckType, publishJSON } from "../internal/pubsub/pubsub.js";
import { handleWar, WarOutcome, type WarResolution } from "../internal/gamelogic/war.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType
{
    return (ps: PlayingState): AckType => {
        handlePause(gs, ps);
        process.stdout.write("> ");

        return AckType.Ack;
    }
}

export function handlerMove(gs: GameState, ch: ConfirmChannel): (move: ArmyMove) => Promise<AckType> {
    return async (move: ArmyMove): Promise<AckType> => {
        const outcome = handleMove(gs, move);
        
        try {
            switch (outcome){
                case MoveOutcome.Safe:
                case MoveOutcome.SamePlayer:
                    return AckType.Ack;
                case MoveOutcome.MakeWar:
                    const rw: RecognitionOfWar = {
                        attacker: move.player,
                        defender: gs.getPlayerSnap(),
                    };
                    
                    console.log(`War Recognized: ${rw.attacker.username} -> ${rw.defender.username}`);
                    await publishJSON(ch, ExchangePerilTopic, `${WarRecognitionsPrefix}.${gs.getUsername()}`, rw);
                    return AckType.NackRequeue;
                default:
                    return AckType.NackDiscard;
            }

        } finally {
            process.stdout.write("> ");
        }
    }
}

export function handlerWar(gs: GameState): (rw:RecognitionOfWar) => AckType {
    return (rw: RecognitionOfWar): AckType => {
        const wr = handleWar(gs, rw);
        console.log(`War Result: ${wr.result}`);
        let ackResult = AckType.NackDiscard;

        switch (wr.result){
            case WarOutcome.NotInvolved:
                ackResult = AckType.NackRequeue;
            case WarOutcome.NoUnits: 
                ackResult = AckType.NackDiscard;
            case WarOutcome.OpponentWon:
                ackResult = AckType.Ack;
            case WarOutcome.YouWon:
                ackResult = AckType.Ack;
            case WarOutcome.Draw:
                ackResult = AckType.Ack;
            default:
                console.error("Unrecognized War Outcome");
                ackResult = AckType.NackRequeue;
        }

        process.stdout.write("> ");
        return ackResult;
    }
}