const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mjrrjle.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("foodie").collection("users");
    const foodCollection = client.db("foodie").collection("foods");

    // jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      res.send({ token });
    });

    // save users api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // lode user api
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // check user admin or not
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false }); // Send response and end request
        return;
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" ? true : false };
      res.send(result); // Send response and end request
    });

    // add Food
    app.post("/allFoods", async (req, res) => {
      const allFood = req.body;
      const result = await foodCollection.insertOne(allFood);
      res.send(result);
    });

    // get all Food
    app.get("/allFoods", async (req, res) => {
      const result = await foodCollection.find().toArray();
      res.send(result);
    });

    // get food using pagination
    app.get("/allFoods", async (req, res) => {
      const page = Number(req.query.page);
      const size = Number(req.query.size);

      try {
        const count = await foodCollection.countDocuments();
        const totalPages = Math.ceil(count / size);

        if (page > totalPages || page < 1) {
          return res.status(400).json({ error: "Invalid page number" });
        }

        const skip = (page - 1) * size;

        const food = await foodCollection
          .find()
          .skip(skip)
          .limit(size)
          .toArray();

        res.json({
          food,
          totalPages,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("An error occurred while setting up the server:", error);
  } finally {
    // Close the client connection when done
    // client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running..");
});

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
