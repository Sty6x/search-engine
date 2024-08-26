import express, { Request, Response, NextFunction } from "express";
import path from "path";
import amqp, { Connection, Channel } from "amqplib";
import connect_rabbitmq from "./rabbitmq";
const cors = require("cors");
const body_parser = require("body-parser");
const app = express();
const PORT = 8080;

app.listen(PORT, () => {
  console.log("Listening to Port:", PORT);
});

app.use(body_parser.urlencoded({ extended: false }));
app.use(body_parser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  express.static(path.join(__dirname, "public/scripts")),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.path.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript");
    }
    next();
  },
);

app.get("/", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/crawl", async (req: Request, res: Response, next: NextFunction) => {
  const docs = [
    "https://fzaid.vercel.app/",
    "https://docs.python.org/3/",
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    "https://go.dev/doc/",
    "https://motherfuckingwebsite.com/",
  ];
  const encoder = new TextEncoder();
  const encoded_docs = encoder.encode(JSON.stringify({ docs }));

  console.log("Crawl");
  try {
    const queue = "crawl_rpc_queue";
    const message = "Start Crawl";
    const corID = "f27ac58-7bee-4e90-93ef-8bc08a37e26c";
    const { connection, channel } = await connect_rabbitmq();
    const response_queue = await channel.assertQueue(
      "crawl_notification_queue",
      { exclusive: false },
    );
    await channel.sendToQueue(queue, Buffer.from(encoded_docs.buffer), {
      replyTo: response_queue.queue,
      correlationId: corID,
    });

    const consumer = await channel.consume(
      response_queue.queue,
      (response) => {
        if (response === null) throw new Error("No Response");
        if (response.properties.correlationId === corID) {
          console.log(
            "LOG: Response from crawler received: %s",
            response.content.toString(),
          );
          res.send("<p>Success</p>");
          channel.cancel(consumer.consumerTag).catch(console.error);
        }
      },
      { noAck: true },
    );
  } catch (err) {
    const error = err as Error;
    console.log("LOG:Something went wrong with RPC queue");
    console.error(error.message);
    next(err);
  }
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});
