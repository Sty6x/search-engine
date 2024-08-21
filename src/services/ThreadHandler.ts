import path from "path";
import { threadId, Worker } from "worker_threads";
import { data_t } from "../types/data_t";
import { arrayBuffer } from "stream/consumers";
import { Database, sqlite3 } from "sqlite3";
import { title } from "process";

const BUFFER_SIZE = 5048;
const FRAME_SIZE = 1024;
const WORKER_FILE = path.join(__dirname, "./Bot/index.ts");

type thread_response_t = {
  type: "insert" | "error";
  shared_buffer?: SharedArrayBuffer;
  data_length: number;
};

export default class ThreadHandler {
  webpages: Array<string> = [];
  db;
  current_threads: number;
  private THREAD_POOL: number;

  constructor(
    webpages: Array<string>,
    database: Database,
    thread_pool: number,
  ) {
    this.webpages = webpages;
    this.db = database;
    this.current_threads = thread_pool;
    this.THREAD_POOL = thread_pool;
    this.crawl_and_index();
  }

  private event_handlers(worker: Worker, shared_buffer: SharedArrayBuffer) {
    console.log(`WorkerID: ${worker.threadId}`);
    worker.on("message", (message: thread_response_t) => {
      if (message.type === "error") {
        console.log("Thread s% Threw an error: ", worker.threadId);
      }

      if (message.type === "insert") {
        if (message.shared_buffer == undefined) return;
        this.message_decoder(shared_buffer);
        console.log(
          "Thread #%s changed buffer: ",
          worker.threadId,
          shared_buffer.byteLength,
        );
      }
    });
    worker.on("exit", () => {
      console.log(`Worker Exit`);
    });
  }

  private message_decoder(shared_buffer: SharedArrayBuffer) {
    const view = new Int32Array(shared_buffer);
    let received_chunks = [];
    let current_index = 0;

    // TBH I really dont understand how Atomics work... I need to study more.
    while (current_index < view.length) {
      const chunk_size = Math.min(FRAME_SIZE, view.length - current_index);
      if (view[current_index] !== 0) {
        Atomics.wait(view, current_index, 0);
      }
      received_chunks.push(
        ...view.slice(current_index, current_index + chunk_size),
      );
      current_index += chunk_size;
      for (let i = current_index - chunk_size; i < current_index; i++) {
        Atomics.store(view, i, 0);
      }
    }

    // if the transfered data sits on a buffer is greater than the next one,
    // the next transffered data might include the remaining data left by the its predecessor;
    // this includes the received chunks array, because it just copies

    const string_array = new Uint8Array(received_chunks);
    for (let i = 0; i < received_chunks.length; i++) {
      string_array[i] = received_chunks[i];
    }

    const decoder = new TextDecoder();
    const decoded_data = decoder.decode(string_array);
    const last_brace_index = decoded_data.lastIndexOf("}");
    const sliced_object = decoded_data.slice(0, last_brace_index) + "}"; // Buh
    try {
      const deserialize_data = JSON.parse(sliced_object);
      console.log({ received_chunks, sliced_object });
      console.log({ deserialize_data });
      this.insert_indexed_page(deserialize_data);
    } catch (err) {
      const error = err as Error;
      console.error(error.message);
      console.error(error.stack);
    }
  }

  private crawl_and_index() {
    const shared_buffer = new SharedArrayBuffer(BUFFER_SIZE);
    try {
      for (let i = 0; i < 2; i++) {
        const worker = new Worker(WORKER_FILE, {
          argv: [i],
          workerData: { shared_buffer },
        });
        this.event_handlers(worker, shared_buffer);
      }
    } catch (err) {
      const error = err as Error;
      console.log("Log: Something went wrong when creating thread workers.\n");
      console.error(error.message);
    }
  }
  private insert_indexed_page(data: data_t) {
    if (this.db == null) {
      throw new Error("Database is not connected.");
    }

    this.db.serialize(() => {
      this.db.run("PRAGMA foreign_keys = ON;");
      this.db.run(
        "INSERT OR IGNORE INTO known_sites (url, last_added) VALUES ($url, $last_added);",
        {
          $url: new URL("/", data.header.url).hostname,
          $last_added: Date.now(),
        },
      );
      const insert_indexed_sites_stmt = this.db.prepare(
        "INSERT OR IGNORE INTO indexed_sites (primary_url, last_indexed) VALUES ($primary_url, $last_indexed);",
      );
      const insert_webpages_stmt = this.db.prepare(
        "INSERT INTO webpages (webpage_url, title, contents, parent) VALUES ($webpage_url, $title, $contents, $parent);",
      );
      insert_indexed_sites_stmt.run(
        {
          $primary_url: new URL("/", data.header.url).hostname,
          $last_indexed: Date.now(),
        },
        function (err) {
          if (err) {
            console.error("Unable to add last indexed site:", err.message);
            return;
          }
          const parentId = this.lastID;
          data.webpages.forEach((el) => {
            if (el === undefined) return;
            const {
              header: { title, webpage_url },
              contents,
            } = el;

            insert_webpages_stmt.run(
              {
                $webpage_url: webpage_url,
                $title: title,
                $contents: contents,
                $parent: parentId,
              },
              (err) => {
                if (err) {
                  console.error("Error inserting webpage:", err.message);
                }
              },
            );
          });
        },
      );
      insert_webpages_stmt.finalize();
      insert_indexed_sites_stmt.finalize();
    });
  }
}
