import amqp from "amqplib";

async function main() {
  console.log("Starting Peril server...");

  const RABBIT_CONNECTION_URL = 'amqp://guest:guest@localhost:5672/';
  const conn = await amqp.connect(RABBIT_CONNECTION_URL);
  console.log("Successfully connected to Rabbit Server.")

  process.on('SIGINT', async () => {
    console.log("Shutting down...");
    await conn.close();
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
