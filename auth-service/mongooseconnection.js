const mongoose = require("mongoose");
require("dotenv").config();

require("./model/user");

mongoose.connect(
  process.env.AUTH_SERVICE_DB || "mongodb://127.0.0.1:27017/auth"
);
