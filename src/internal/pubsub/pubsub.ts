import amqp from "amqplib";
import type { ConfirmChannel } from "amqplib";

export enum SimpleQueueType {
  Durable,
  Transient,
}

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

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[amqp.Channel, amqp.Replies.AssertQueue]> {
  const ch = await conn.createChannel();

  const q = await ch.assertQueue(queueName, {
    durable: queueType === SimpleQueueType.Durable,
    autoDelete: queueType === SimpleQueueType.Transient,
    exclusive: queueType === SimpleQueueType.Transient
  } );
  await ch.bindQueue(queueName, exchange, key);

  return [ch, q];
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => void,
): Promise<void>{
  const ch_q = await declareAndBind(conn, exchange, queueName, key, queueType);
  const ch = ch_q[0];
  const q = ch_q[1];
  
  const replies = await ch.consume(q.queue, (msg: amqp.ConsumeMessage | null) => {
    if (msg === null){
      return;
    }
    
    const json = JSON.parse(msg.content.toString());
    handler(json);
    ch.ack(msg);
  } )
}