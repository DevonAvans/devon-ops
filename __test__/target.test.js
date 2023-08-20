const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { mockRequest, mockResponse } = require("jest-mock-req-res");

const TARGET_TABLE = "targets";
const USER_TABLE = "users";
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

describe("Create a valid target and linking it in the user", () => {
  // Business logic create function
  const create = async (req, res) => {
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

    const targetCollection = await db.collection(TARGET_TABLE);
    const findTarget = await targetCollection.findOne({
      targetname: targetname,
    });

    if (findTarget) {
      // removeFile(imageFilePath);
      return res.status(409).json({
        message: "Target name is already in use",
      });
    }

    if (
      req.file.mimetype !== "image/png" &&
      req.file.mimetype !== "image/jpeg" &&
      req.file.mimetype !== "image/jpg"
    ) {
      // removeFile(imageFilePath);
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
    };

    await targetCollection.insertOne(newTarget);
    return res.json({ message: "Target has been created!" });
  };

  const username = "Devon";
  const targetname = "This is a target name";
  const description = "It is a picture of the mooooon";
  const placename = "The moon";

  it("should add target to the target database", async () => {
    const request = mockRequest({
      headers: {
        username: username,
      },
      body: {
        targetname: targetname,
        description: description,
        placename: placename,
      },
      file: {
        path: "the_moon.png",
        mimetype: "image/png",
      },
    });
    const response = mockResponse();

    await create(request, response);

    const target = await db
      .collection(TARGET_TABLE)
      .findOne({ targetname: targetname });
    expect(target).toBeDefined();
    expect(target.targetname).toBe(targetname);
    expect(target.placename).toBe(placename);
    expect(target.username).toBe(username);
  });

  it("should add a valid target to the user", async () => {
    const password = "Clouds";
    const email = "devon@avans.nl";
    const role = "admin";

    const request = mockRequest({
      headers: {
        username: username,
      },
      body: {
        targetname: targetname,
        description: description,
        placename: placename,
      },
      file: {
        path: "the_moon.png",
        mimetype: "image/png",
      },
    });
    const response = mockResponse();

    await db.collection(USER_TABLE).insertOne({
      username: username,
      password: password,
      email: email,
      role: role,
      targets: [],
    });

    await create(request, response);

    const tArray = [targetname];
    await db
      .collection(USER_TABLE)
      .updateOne(
        { username: username },
        { $push: { targets: { $each: tArray } } }
      );

    const user = await db
      .collection(USER_TABLE)
      .findOne({ username: username });
    expect(user).toBeDefined();
    expect(user.username).toBe(username);
    expect(user.targets).toContain(targetname);
  });

  it("should return an error if target name already exists", async () => {
    const username = "Devon";
    const targetname = "Existing Target";
    const description = "This is a description for the target";
    const placename = "The moon";

    // Create an existing target with the same name
    await db.collection(TARGET_TABLE).insertOne({
      targetname: targetname,
      description: description,
      placename: placename,
      image: "existing_target.png",
      username: username,
    });

    const request = mockRequest({
      headers: {
        username: username,
      },
      body: {
        targetname: targetname,
        description: description,
        placename: placename,
      },
      file: {
        path: "the_moon.png",
        mimetype: "image/png",
      },
    });
    const response = mockResponse();

    await create(request, response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      message: "Target name is already in use",
    });

    const targets = await db
      .collection(TARGET_TABLE)
      .find({ targetname: targetname })
      .toArray();

    expect(targets).toHaveLength(1);
  });

  it("should return an error for an invalid file type", async () => {
    const username = "Devon";
    const targetname = "Invalid File Type";
    const description = "This is a description for the target";
    const placename = "The moon";
  
    const request = mockRequest({
      headers: {
        username: username,
      },
      body: {
        targetname: targetname,
        description: description,
        placename: placename,
      },
      file: {
        path: "invalid_file.pdf",
        mimetype: "text/plain",
      },
    });
    const response = mockResponse();
  
    await create(request, response);
  
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Invalid file type, it should be png, jpeg, jpg",
    });
  
    const target = await db
      .collection(TARGET_TABLE)
      .findOne({ targetname: targetname });
  
    expect(target).toBeNull();
  });
});
