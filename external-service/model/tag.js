const mongoose = require("mongoose");

const TAG_TABLE = "tag";

const tagSchema = new mongoose.Schema({
  tagname: {
    type: String,
    required: true,
    unique: true,
  },
  image: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  targetname: {
    type: String,
    required: true,
  },
  score: {
    type: String,
    required: true,
  },
});
mongoose.model(TAG_TABLE, tagSchema);

module.exports = mongoose.model(TAG_TABLE);
