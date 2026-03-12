import amqp from "amqplib";
import type { ConfirmChannel } from "amqplib";
import { decode, encode } from "@msgpack/msgpack";

export enum SimpleQueueType {
  Durable,
  Transient,
}

export enum AckType {
  Ack,
  NackRequeue,
  NackDiscard,
}

export function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void>
{
    const bytes = Buffer.from(JSON.stringify(value));

    ch.publish(exchange, routingKey, bytes, { contentType: "application/json" });

    return ch.waitForConfirms();
}

export function publishMsgPack<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T
): Promise<void> {
  const bytes = Buffer.from(encode(value));

  ch.publish(exchange, routingKey, bytes, { contentType: "application/x-msgpack" });

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
    exclusive: queueType === SimpleQueueType.Transient,
    arguments: {
      "x-dead-letter-exchange": 'peril_dlx',
    },
  } );
  await ch.bindQueue(queueName, exchange, key);

  return [ch, q];
}

export async function subscribe<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
  deserializer: (data: Buffer) => T,
): Promise<void>{
  const [ch, q] = await declareAndBind(conn, exchange, queueName, key, queueType);
  
  await ch.prefetch(1);
  await ch.consume(q.queue, async (msg: amqp.ConsumeMessage | null) => {
    if (!msg){
      return;
    }
    
    const data = deserializer(msg.content);
    const ackType = await handler(data);
    switch (ackType){
      case AckType.Ack:
        ch.ack(msg);
        break;
      case AckType.NackRequeue:
        ch.nack(msg, false, true);
        break;
      case AckType.NackDiscard:
        ch.nack(msg, false, false);
        break;
      default:
        console.log('UNEXPECTED ACK');
        break;
    }
  });
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void>{
  await subscribe<T>(conn, exchange, queueName, key, queueType, handler, (data:Buffer): T => {
    return JSON.parse(data.toString());
  });
}

export async function subscribeMsgPack<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void>{
  await subscribe<T>(conn, exchange, queueName, key, queueType,handler, (data: Buffer) => decode(data) as T)
}