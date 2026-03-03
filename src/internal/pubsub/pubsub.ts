import amqp from "amqplib";
import type { ConfirmChannel } from "amqplib";

export function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void>
{
    const bytes = Buffer.from(JSON.stringify(value))

    ch.publish(exchange, routingKey, bytes, { contentType: "application/json" });

    return ch.waitForConfirms();
}