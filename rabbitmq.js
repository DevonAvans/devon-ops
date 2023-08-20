const amqp = require("amqplib/");
require("dotenv").config();

const RABBIT_MQ = process.env.RABBIT_MQ || "amqp://127.0.0.1:5672";

let rabbitMQConnection = null;

const connect = async () => {
  try {
    if (!rabbitMQConnection) {
      rabbitMQConnection = await amqp.connect(RABBIT_MQ);
    }
    return rabbitMQConnection;
  } catch (error) {
    console.log(error);
  }
};

const sendToQueue = async (name, message) => {
  if (!rabbitMQConnection) {
    throw new Error("fbinouwfinowp");
  }
  try {
    const channel = await rabbitMQConnection.createChannel();
    await channel.assertQueue(name);
    await channel.sendToQueue(name, Buffer.from(message));
    return Promise.resolve();
  } catch (e) {
    console.log(e);
    return Promise.reject(error);
  }
};

const consumeFromQueue = async (name, table, callback) => {
  if (!rabbitMQConnection) {
    throw new Error("fbinouwfinowp");
  }
  try {
    const channel = await rabbitMQConnection.createChannel();
    await channel.assertQueue(name, { durable: true }); // durable?
    channel.consume(
      name,
      async (message) => {
        const data = JSON.parse(message.content.toString());
        await callback(data, table);
      },
      { noAck: true } // wordt gelijk bericht bevestiging te geven
    );
  } catch (e) {
    return Promise.reject(e);
  }
};

const sendDirectExchange = async (queueName, message, routingKey) => {
  if (!rabbitMQConnection) {
    throw new Error("RabbitMQ connection is not established.");
  }
  try {
    const channel = await rabbitMQConnection.createChannel();
    await channel.assertExchange(queueName, "direct", { durable: true });
    await channel.publish(queueName, routingKey, Buffer.from(message));
    return Promise.resolve();
  } catch (error) {
    console.log(error);
    return Promise.reject(error);
  }
};

const consumeDirectExchange = async (
  exchangeName,
  dbName,
  routingKey,
  callback
) => {
  if (!rabbitMQConnection) {
    throw new Error("RabbitMQ connection is not established.");
  } else {
    try {
      const channel = await rabbitMQConnection.createChannel();

      const assertQueue = await channel.assertQueue(routingKey, {
        exclusive: false,
        durable: true,
      });
      await channel.assertExchange(exchangeName, "direct", { durable: true });
      await channel.bindQueue(assertQueue.queue, exchangeName, routingKey);
      channel.consume(
        assertQueue.queue,
        async (msg) => {
          const data = JSON.parse(msg.content.toString());
          await callback(data, dbName);
        },
        { noAck: true }
      );
    } catch (error) {
      return Promise.reject(error);
    }
  }
};

module.exports = {
  connect,
  sendToQueue,
  consumeFromQueue,
  sendDirectExchange,
  consumeDirectExchange,
};
