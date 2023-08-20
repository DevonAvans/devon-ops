const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { mockRequest, mockResponse } = require("jest-mock-req-res");
const bcrypt = require("bcrypt");

const USERS_TABLE = "auth";
let memServer;
let db;

beforeAll(async () => {
  memServer = await MongoMemoryServer.create();
  const uri = memServer.getUri();
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  db = mongoose.connection;
});

afterAll(async () => {
  await mongoose.connection.close();
  await memServer.stop();
});

describe("User Registration", () => {
  const username = "Devon_test";
  const password = "Clouds";
  const email = "devon_test@avans.nl";
  const roleAdmin = "admin";

  const admin = {
    username: username,
    password: password,
    email: email,
    role: roleAdmin,
  };

  const register = async (req, res) => {
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
  };

  it("should register a new user", async () => {
    const request = mockRequest({
      body: {
        username: admin.username,
        password: admin.password,
        email: admin.email,
        role: admin.role,
      },
    });
    const response = mockResponse();

    await register(request, response);

    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({
      message: "User has been created!",
    });

    const user = await db
      .collection(USERS_TABLE)
      .findOne({ username: admin.username });

    expect(user).toBeDefined();
    expect(user.username).toBe(admin.username);
    expect(user.email).toBe(admin.email);
    expect(user.role).toBe(admin.role);

    const passwordMatch = await bcrypt.compare(password, user.password);
    expect(passwordMatch).toBe(true);
  });

  it("should return an error if username already exists", async () => {
    const userCollection = await db.collection(USERS_TABLE);

    const existingUser = {
      username: admin.username,
      password: admin.password,
      email: admin.email,
      role: admin.role,
    };

    const request = mockRequest({
      body: {
        username: admin.username,
        password: admin.password,
        email: admin.email,
        role: admin.role,
      },
    });
    const response = mockResponse();

    await register(request, response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      message: "Username is already in use",
    });

    const user = await userCollection.findOne({ username: username });

    expect(user).toBeDefined();
    expect(user.username).toBe(existingUser.username);
    expect(user.email).toBe(existingUser.email);
    expect(user.role).toBe(existingUser.role);
  });

  it("should return an error for missing fields", async () => {
    const request = mockRequest({
      body: {},
    });
    const response = mockResponse();

    await register(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Username is required",
    });
  });

  it("should check if the user has an admin role", async () => {
    const request = mockRequest({
      body: {
        username: admin.username,
        password: admin.password,
        email: admin.email,
        role: admin.role,
      },
    });
    const response = mockResponse();

    await register(request, response);

    const user = await db
      .collection(USERS_TABLE)
      .findOne({ username: admin.username });

    expect(user).toBeDefined();
    expect(user.username).toBe(admin.username);
    expect(user.email).toBe(admin.email);
    expect(user.role).toBe(admin.role);

    const isAdmin = user.role === "admin";
    expect(isAdmin).toBe(true);
  });

  it("should check if the user does not have an admin role", async () => {
    const userObject = {
      username: "user",
      password: "password",
      email: "user@example.com",
      role: "user",
    };

    const request = mockRequest({
      body: {
        username: userObject.username,
        password: userObject.password,
        email: userObject.email,
        role: userObject.role,
      },
    });
    const response = mockResponse();

    await register(request, response);

    const user = await db
      .collection(USERS_TABLE)
      .findOne({ username: userObject.username });

    expect(user).toBeDefined();
    expect(user.username).toBe(userObject.username);
    expect(user.email).toBe(userObject.email);
    expect(user.role).toBe(userObject.role);

    const isAdmin = user.role === "admin";
    expect(isAdmin).toBe(false);
  });
});
