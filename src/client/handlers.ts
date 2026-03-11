import type { ConfirmChannel } from "amqplib";
import { ExchangePerilTopic, WarRecognitionsPrefix } from "../internal/routing/routing.js";

import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import type { ArmyMove, RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { AckType, publishJSON } from "../internal/pubsub/pubsub.js";
import { handleWar, WarOutcome, type WarResolution } from "../internal/gamelogic/war.js";
import { publishGameLog } from "./index.js";
import { channel } from "diagnostics_channel";

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
                    
                    try {
                        await publishJSON(ch, ExchangePerilTopic, `${WarRecognitionsPrefix}.${gs.getUsername()}`, rw);
                        return AckType.Ack;
                    }
                    catch (error){
                        return AckType.NackRequeue;
                    }
                    
                default:
                    return AckType.NackDiscard;
            }

        } finally {
            process.stdout.write("> ");
        }
    }
}

export function handlerWar(gs: GameState, ch:ConfirmChannel): (rw:RecognitionOfWar) => Promise<AckType> {
    return async (rw: RecognitionOfWar): Promise<AckType> => {
        const wr = handleWar(gs, rw);
        
        try {
            switch (wr.result){
            case WarOutcome.NotInvolved:
                return AckType.NackRequeue;
            case WarOutcome.NoUnits: 
                return AckType.NackDiscard;
            case WarOutcome.OpponentWon:
                await publishGameLog(ch, gs.getUsername(), `${wr.winner} won a war against ${wr.loser}`);
                return AckType.Ack;
            case WarOutcome.YouWon:
                await publishGameLog(ch, gs.getUsername(), `${wr.winner} won a war against ${wr.loser}`);
                return AckType.Ack;
            case WarOutcome.Draw:
                await publishGameLog(ch, gs.getUsername(), `A war between ${wr.attacker} and ${wr.defender} resulted in a draw`);
                return AckType.Ack;
            default:
                console.error("Unrecognized War Outcome");
                return AckType.NackDiscard;
            }
        }
        catch {
            return AckType.NackRequeue;
        }
        finally {
            process.stdout.write("> ");
        }
    }
}