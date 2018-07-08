// The source for most of this backend is at https://scotch.io/tutorials/express-file-uploads-with-multer
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const Loki = require("lokijs");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DB_NAME = (process.env.DB_NAME || "db") + ".json";
const UPLOAD_PATH = process.env.UPLOAD_PATH || "uploads";
const COLUMN_NAME = process.env.COLUMN_NAME || "images";

const upload = multer({ dest: `${UPLOAD_PATH}/` });
const db = new Loki(`${UPLOAD_PATH}/${DB_NAME}`, { persistenceMethod: "fs" });

const app = express();
require("express-ws")(app);
app.use(cors());

function loadCollection(colName, db) {
  return new Promise(resolve => {
    db.loadDatabase({}, () => {
      const _collection =
        db.getCollection(colName) || db.addCollection(colName);
      resolve(_collection);
    });
  });
}

app.post("/", upload.single("video"), async (req, res) => {
  console.log("POST /");

  try {
    const col = await loadCollection(COLUMN_NAME, db);
    const data = col.insert(req.file);
    db.saveDatabase();

    res
      .send({
        id: data.$loki,
        fileName: data.filename,
        originalName: data.originalname
      })
      .end();
  } catch (err) {
    console.error(err);
    res.sendStatus(500).end();
  }
});

app.ws("/", function(ws) {
  let data = "";

  ws.on("message", function(msg) {
    data += msg;
  });

  ws.on("close", async function close() {
    const col = await loadCollection(COLUMN_NAME, db);
    col.insert(data);
    db.saveDatabase();
  });
});

app.get("/", async (req, res) => {
  console.log("GET /");
  const col = await loadCollection(COLUMN_NAME, db);

  res
    .json(col.data.map(entry => ({ id: entry["$loki"], path: entry.path })))
    .end();
});

app.get("/:id", async (req, res) => {
  console.log("GET /", req.params.id);
  try {
    const col = await loadCollection(COLUMN_NAME, db);
    const result = col.get(req.params.id);

    if (!result) {
      res.sendStatus(404);
      return;
    }

    // Tutorial on streaming: https://medium.com/@daspinola/video-stream-with-node-js-and-html5-320b3191a6b6
    // Prepare sending the request
    const filePath = path.join(UPLOAD_PATH, result.filename);
    const headers = {
      "Content-Type": result.mimetype
    };
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize
      });
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4"
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(400);
  }
});

app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
