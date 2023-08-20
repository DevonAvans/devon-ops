const jwt = require("jsonwebtoken");
require("dotenv").config();

const isAuthorized = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(400).send("Auth token not found");
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (error, decodedToken) => {
    if (error) {
      return res.status(401).send("Invalid token");
    }

    req.user = decodedToken;
    next();
  });
};

const hasRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    next();
  };
};

const hasOpaqueToken = (req, res, next) => {
  const token = req.headers.opaque_token;

  if (!token) {
    return res.status(400).send("Opaque token not found");
  }

  if (token !== process.env.OPAQUE_TOKEN) {
    return res.status(401).send("Invalid token");
  }

  next();
};

module.exports = { isAuthorized, hasRole, hasOpaqueToken };
