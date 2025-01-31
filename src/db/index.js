import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}`
    );
    console.log(
      `⚙️  connected to DB host !! ${connectionInstance.connection.host}/${DB_NAME}`
    );
  } catch (error) {
    console.log("unable to connect DB", error);
    process.exit(1);
  }
};

export default connectDB;
