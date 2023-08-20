const express = require("express");
const app = express();
require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const passportJWT = require("passport-jwt");
const bcrypt = require("bcrypt");
const db = mongoose.connection;

const User = require("./model/user");
const { hasOpaqueToken } = require("../middleware/auth");
const { connect, sendToQueue, consumeFromQueue } = require("../rabbitmq");
require("./mongooseconnection");

const USERS_TABLE = "users";
const extractJWT = passportJWT.ExtractJwt;

const jwtOptions = {
  jwtFromRequest: extractJWT.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

const port = process.env.AUTH_SERVICE_PORT || 3001;

app.use(express.json());

app.post("/login", hasOpaqueToken, async (req, res) => {
  const { username, password } = req.body;
  const findUser = await User.findOne({ username: username });

  if (!findUser) {
    return res.status(401).json({ message: "Username doesn't exist." });
  }
  if (await bcrypt.compare(password, findUser.password)) {
    const payload = {
      username: findUser.username,
      role: findUser.role,
    };
    const authToken = jwt.sign(payload, jwtOptions.secretOrKey, {
      expiresIn: 604800, // -> tantoe veel seconde
    });
    return res.json({ token: authToken });
  }
  return res.status(401).json({ message: "Password is incorrect." });
});

app.post("/register", hasOpaqueToken, async (req, res) => {
  const userCollection = await db.collection(USERS_TABLE);

  const { username, password, email, role } = req.body;
  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }
  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  if (!role) {
    return res.status(400).json({ message: "Role is required" });
  }

  const findUser = await db.collection(USERS_TABLE).findOne({ username });

  if (findUser) {
    return res.status(409).json({
      message: "Username is already in use",
    });
  }

  const hash = await bcrypt.hash(password, 10);

  const newUser = {
    username: username,
    password: hash,
    email: email,
    role: role,
  };

  await userCollection.insertOne(newUser);
  return res.status(201).json({ message: "User has been created!" });
});

app.listen(port, async () => {
  console.log(`AUTH service online on ${port}`);

  connection = await connect();

  if (!connection) {
    console.log("RabbitMQ is not connected");
    res.json({ message: "RabbitMQ is not connected" });
  } else {
    await consumeFromQueue("userTargets", USERS_TABLE, async (data) => {
      const user = await User.findOne({ username: data.username });
      if (user != null) {
        const targets = [data.targetname];
        await User.updateOne(
          { username: data.username },
          { $push: { targets: { $each: targets } } }
        );
      }
    });
    await consumeFromQueue("deleteUserTarget", USERS_TABLE, async (data) => {
      await User.findOneAndUpdate(
        { username: data.username },
        { $pull: { targets: data.targetname } },
        { new: true }
      );
    });
  }
});
