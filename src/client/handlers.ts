import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import type { ArmyMove } from "../internal/gamelogic/gamedata.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { AckType } from "../internal/pubsub/pubsub.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType
{
    return (ps: PlayingState): AckType => {
        handlePause(gs, ps);
        console.log("> ");

        return AckType.Ack;
    }
}

export function handlerMove(gs: GameState): (move: ArmyMove) => AckType {
    return (move: ArmyMove): AckType => {
        const outcome = handleMove(gs, move);
        console.log('> ');

        if (outcome === MoveOutcome.MakeWar || outcome === MoveOutcome.Safe){
            return AckType.Ack;
        }

        return AckType.NackDiscard;
    }
}