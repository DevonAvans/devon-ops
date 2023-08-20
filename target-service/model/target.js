const mongoose = require("mongoose");

const TARGET_TABLE = "target";

const targetSchema = new mongoose.Schema({
  targetname: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  placename: {
    type: String,
    required: true,
  },
  image: {
    data: {
      type: Buffer,
      required: true,
    },
    contentType: {
      type: String,
      required: true,
    },
  },
  username: {
    type: String,
    required: true,
  },
  tags: [
    {
      type: String,
    },
  ],
});

mongoose.model(TARGET_TABLE, targetSchema);

module.exports = mongoose.model(TARGET_TABLE);
