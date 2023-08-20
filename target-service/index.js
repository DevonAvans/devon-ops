const express = require("express");
const app = express();
const mongoose = require("mongoose");
require("dotenv").config();
const { hasOpaqueToken } = require("../middleware/auth");
const {
  connect,
  sendToQueue,
  consumeFromQueue,
  consumeDirectExchange,
  sendDirectExchange,
} = require("../rabbitmq");
const fs = require("fs");

const port = process.env.TARGET_SERVICE_PORT || 3002;

const Target = require("./model/target");

const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");

require("./mongooseconnection");
const db = mongoose.connection;

const TARGET_TABLE = "targets";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

const removeFile = (imageFilePath) => {
  const fileBuffalo = Buffer.from(imageFilePath).toString("utf-8");
  fs.unlinkSync(path.join(__dirname, "..", fileBuffalo));
};

let connection;

app.get("/targets", hasOpaqueToken, async (req, res) => {
  const { size = 10, page = 1 } = req.query;

  const query = Target.find({});

  if (size && page) {
    const limit = parseInt(size) <= 0 ? 10 : parseInt(size);
    let pageNum = parseInt(page) <= 0 ? 1 : parseInt(page);
    const skip = (pageNum - 1) * limit;
    query.limit(limit).skip(skip);
  }

  const targets = await query.exec();

  return res.json({
    count: targets.length,
    pagination: {
      page: parseInt(page),
      size: parseInt(size),
    },
    data: targets,
  });
});

app.post(
  "/targets/create",
  hasOpaqueToken,
  upload.single("image"),
  async (req, res) => {
    const { targetname, description, placename } = req.body;
    const imageFilePath = req.file.path;

    if (!targetname) {
      return res.status(400).json({ message: "targetname is required" });
    }
    if (!description) {
      return res.status(400).json({ message: "description is required" });
    }
    if (!placename) {
      return res.status(400).json({ message: "placename is required" });
    }
    if (!imageFilePath) {
      return res.status(400).json({ message: "image is required" });
    }

    const findTarget = await db
      .collection(TARGET_TABLE)
      .findOne({ targetname: targetname });

    if (findTarget) {
      removeFile(imageFilePath);
      return res.status(409).json({
        message: "Target name is already in use",
      });
    }

    if (
      req.file.mimetype !== "image/png" &&
      req.file.mimetype !== "image/jpeg" &&
      req.file.mimetype !== "image/jpg"
    ) {
      removeFile(imageFilePath);
      return res
        .status(400)
        .json({ message: "Invalid file type, it should be png, jpeg, jpg" });
    }

    const username = req.headers.username;

    const newTarget = {
      targetname: targetname,
      description: description,
      placename: placename,
      image: imageFilePath,
      username: username,
      tags: [],
    };

    await sendToQueue("targets", JSON.stringify(newTarget));
    await sendToQueue("userTargets", JSON.stringify(newTarget));

    return res.json({ message: "Target has been created!" });
  }
);

app.get("/targets/fieldvalueof", hasOpaqueToken, async (req, res) => {
  const { targetname, field } = req.query;

  if (!targetname || !field)
    return res
      .status(400)
      .json({ message: "Must submit a targetname and a field" });

  const targets = await Target.findOne({ targetname }, field);

  if (!targets) return res.status(404).json({ message: "target not found" });

  const result = targets[field];

  if (!result) return res.status(404).json({ message: "field not found" });

  return res.json({ data: targets[field] });
});

app.get("/targets/placename/:placename", hasOpaqueToken, async (req, res) => {
  const { placename } = req.params;

  const targets = await Target.find({ placename: placename });

  return res.json({ count: targets.length, data: targets });
});

app.delete("/targets/delete/:targetname", hasOpaqueToken, async (req, res) => {
  const { targetname } = req.params;
  const username = req.headers.username;

  const target = await Target.findOne({
    targetname: targetname,
    username: username,
  });

  if (!target) return res.status(404).json({ message: "Target not found" });

  const deleted = await db.collection(TARGET_TABLE).findOneAndDelete({
    targetname: targetname,
    username: username,
  });

  await sendToQueue(
    "deleteUserTarget",
    JSON.stringify({ targetname: targetname, username: username })
  );

  await sendToQueue("deleteTagsOfTarget", JSON.stringify({ target: deleted }));

  await sendToQueue(
    "deleteUserTarget",
    JSON.stringify({ targetname: targetname, username: username })
  );

  return res
    .status(204)
    .json({ message: "Target has been successfully deleted" });
});

app.listen(port, async () => {
  console.log(`Target service: ${port}`);

  const connection = await connect();

  if (!connection) {
    console.log("RabbitMQ is not connected");
    res.json({ message: "RabbitMQ is not connected" });
  } else {
    await consumeFromQueue("targets", TARGET_TABLE, async (data) => {
      await db.collection(TARGET_TABLE).insertOne(data);
    });

    await consumeFromQueue("tagTarget", TARGET_TABLE, async (data) => {
      await db.collection(TARGET_TABLE).findOne({ username: data.username });
    });

    await consumeDirectExchange(
      "tags",
      TARGET_TABLE,
      "tag_target",
      async (data, dbName) => {
        const target = await db
          .collection(dbName)
          .findOneAndUpdate(
            { targetname: data.targetname },
            { $push: { tags: data.tagname } }
          );
        if (target !== null) {
          await sendDirectExchange(
            "tags",
            JSON.stringify({ target: target, tagname: data.tagname }),
            "target_results"
          );
        }
      }
    );
  }
});
