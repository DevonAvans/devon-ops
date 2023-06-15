const express = require("express");
const app = express();
const mongoose = require("mongoose");
require("dotenv").config();
const { hasOpaqueToken } = require("../middleware/auth");

const port = process.env.TARGET_SERVICE_PORT;

const Target = require("./model/target");

const bodyParser = require("body-parser");
const multer = require("multer");

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

app.get("/targets", hasOpaqueToken, async (req, res) => {
  const { size = 10, page = 1 } = req.query;

  const query = Target.find({});

  if (size && page) {
    const limit = parseInt(size) <= 0 ? 10 : parseInt(size);
    const pagenum = parseInt(page) <= 0 ? 1 : parseInt(page);
    const skip = (pagenum - 1) * limit;
    query.limit(limit).skip(skip);
  }

  const targets = await query.exec();

  return res.json({ count: targets.length, data: targets });
});

app.post(
  "/targets/create",
  hasOpaqueToken,
  upload.single("image"),
  async (req, res) => {
    const { targetname, description, placename } = req.body;
    const imageFilePath = req.file.path;

    if (!targetname)
      return res.status(400).json({ message: "targetname is required" });

    const findTarget = await db
      .collection(TARGET_TABLE)
      .findOne({ targetname: targetname });

    if (findTarget) {
      return res.status(409).json({
        message: "Target name is already in use",
      });
    }

    if (!description)
      return res.status(400).json({ message: "description is required" });
    if (!placename)
      return res.status(400).json({ message: "placename is required" });
    if (!imageFilePath)
      return res.status(400).json({ message: "image is required" });
    if (
      req.file.mimetype !== "image/png" &&
      req.file.mimetype !== "image/jpeg" &&
      req.file.mimetype !== "image/jpg"
    ) {
      return res
        .status(400)
        .json("Invalid file type, it should be png, jpeg, jpg");
    }

    const username = req.headers.username;

    const newTarget = {
      targetname: targetname,
      description: description,
      placename: placename,
      image: imageFilePath,
      username: username,
    };

    const targets = await db.collection(TARGET_TABLE);
    targets.insertOne(newTarget);

    return res.json({ message: "Target has been created!" });
  }
);

app.get("/targets/fieldvalueof", hasOpaqueToken, async (req, res) => {
  const { targetname, field } = req.query;

  if (!target || !field)
    return res
      .status(400)
      .json({ message: "Must submit a targetname and a field" });

  const targets = await Target.findOne({ targetname }, field);

  if (!targets) return res.status(404).json({ message: "target not found" });

  const result = targets[field];

  if (!result) return res.status(404).json({ message: "field not found" });

  return res.json({ data: targets[field] });
});

app.post("/targets/create", hasOpaqueToken, async (req, res) => {
  const { targetname: targetname, description, placename, image } = req.body;

  if (!targetname)
    return res.status(400).json({ message: "targetname is required" });

  const findTarget = await db
    .collection(TARGET_TABLE)
    .findOne({ targetname: targetname });

  if (findTarget) {
    return res.status(409).json({
      message: "target name is already in use",
    });
  }
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

  target.deleteOne({ targetname: targetname, username: username });

  return res
    .status(204)
    .json({ message: "Target has been successfully deleted" });
});

app.listen(port, () => {
  console.log(`Target service: ${port}`);
});
