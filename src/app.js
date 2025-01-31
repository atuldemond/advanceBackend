import express, { urlencoded } from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

// Load environment variables from .env file
dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
//multer upload

// routes Import
import userRouter from "./routes/user.routes.js";
import { upload } from "./middleware/multer.middleware.js";

//routes Declartion
app.use(
  "/users",
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  userRouter
);

app.get("/", (req, res) => {
  res.send("Your are Home Directory");
});

app.use("*", (req, res) => {
  res.send("Your are on wrong URL");
});

export { app };
