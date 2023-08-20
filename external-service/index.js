const express = require("express");
const app = express();
require("dotenv").config();
const axios = require("axios");
const {
  connect,
  sendDirectExchange,
  consumeDirectExchange,
  consumeFromQueue,
} = require("../rabbitmq");

const fd = require("form-data");
const fs = require("fs");

const { API_KEY, API_SECRET, API_URL } = require("./api-secrets");
const { hasOpaqueToken } = require("../middleware/auth");
const multer = require("multer");

const mongoose = require("mongoose");
require("./mongooseconnection");
const db = mongoose.connection;

const Tag = require("./model/tag");
const path = require("path");
const TAG_TABLE = "tags";

const port = process.env.EXTERNAL_SERVICE_PORT || 3003;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

app.use(express.json());

app.get(
  "/tag/:name",
  hasOpaqueToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name } = req.params;

      const tag = await db.collection(TAG_TABLE).findOne({ tagname: name });

      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      if (tag.score === 0) {
        return res
          .status(200)
          .json({ message: "Score will soon be available" });
      }
      if (tag.score <= -1) {
        return res.status(200).json({
          message:
            "The detected tag, being identical to the target image, is now considered an invalid entry.",
        });
      }
      return res.json({ data: { tagname: name, score: tag.score } });
    } catch (e) {
      console.error(e);
      return res.status(e?.response?.status || 500).json({
        message: e?.response?.data?.message || "Internal server error",
      });
    }
  }
);

app.post(
  "/tag/create",
  hasOpaqueToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const { tagname, targetname } = req.body;
      const { username } = req.headers;
      const imageFilePath = req.file.path;

      if (!tagname) {
        return res.status(400).json({ message: "tagname is required" });
      }
      if (!targetname) {
        return res.status(400).json({ message: "targetname is required" });
      }
      if (!username) {
        return res
          .status(400)
          .json({ message: "username auth token is required" });
      }
      if (!imageFilePath) {
        return res.status(400).json({ message: "image is required" });
      }

      if (
        req.file.mimetype !== "image/png" &&
        req.file.mimetype !== "image/jpeg" &&
        req.file.mimetype !== "image/jpg"
      ) {
        return res
          .status(400)
          .json("Invalid file type, it should be png, jpeg, jpg");
      }

      const findTag = await Tag.findOne({ tagname });
      if (findTag) {
        return res.status(409).json({
          message: "Tag name is already in use",
        });
      }

      const newTag = {
        tagname: tagname,
        image: imageFilePath,
        targetname: targetname,
        username: username,
        score: 0,
      };

      await sendDirectExchange("tags", JSON.stringify(newTag), "tag_create");

      await sendDirectExchange("tags", JSON.stringify(newTag), "tag_target");

      return res.status(201).json({
        message:
          "Tag has been created. The score will be added to the tag shortly. If the tag image is the same as the target image, the tag will be removed.",
      });
    } catch (e) {
      console.error(e);
      return res.status(e?.response?.status || 500).json({
        message: e?.response?.data?.message || "Internal server error",
      });
    }
  }
);

app.listen(port, async () => {
  console.log(`External service online on ${port}`);

  const connection = await connect();

  if (!connection) {
    console.log("RabbitMQ is not connected");
    res.json({ message: "RabbitMQ is not connected" });
  } else {
    await consumeDirectExchange(
      "tags",
      TAG_TABLE,
      "tag_create",
      async (data) => {
        console.log(`Upload data: ${JSON.stringify(data)}`);
        await db.collection(TAG_TABLE).insertOne(data);
      }
    );
    await consumeDirectExchange(
      "tags",
      TAG_TABLE,
      "target_results",
      async (data) => {
        if (!data?.target?.value) return;
        const form = new fd();
        form.append(
          "image_base64",
          fs.readFileSync(data.target.value.image, "base64")
        );
        const tag = await db
          .collection(TAG_TABLE)
          .findOne({ tagname: data.tagname });
        form.append("image2_base64", fs.readFileSync(tag.image, "base64"));

        const response = await axios.post(
          `${API_URL}/v2/images-similarity/categories/general_v3`,
          form,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(
                `${API_KEY}:${API_SECRET}`
              ).toString("base64")}`,
              ...form.getHeaders(),
            },
            data: form,
          }
        );
        const distance = response.data.result.distance;
        const score = distance === 0 ? -1 : (1 / (distance + 1)) * 100;
        await db
          .collection(TAG_TABLE)
          .updateOne({ tagname: tag.tagname }, { $set: { score: score } });
      }
    );
    await consumeFromQueue("deleteTagsOfTarget", TAG_TABLE, async (data) => {
      db.collection(TAG_TABLE).deleteMany({
        tagname: {$in: data.target.value.tags}
      })
    });
  }
});
