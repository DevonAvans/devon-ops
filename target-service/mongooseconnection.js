const mongoose = require("mongoose");
require("dotenv").config();

require("./model/target");

mongoose.connect(
  process.env.TARGET_SERVICE_DB || "mongodb://127.0.0.1:27017/target"
);
