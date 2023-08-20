const mongoose = require("mongoose");

const USER_TABLE = "user";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  targets: [
    {
      type: String,
    },
  ],
});
mongoose.model(USER_TABLE, userSchema);

module.exports = mongoose.model(USER_TABLE);
