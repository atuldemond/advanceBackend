import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const todoSchema = new Schema(
  {
    title: {
      require: true,
      type: String,
    },
    text: {
      require: true,
      type: String,
    },
  },
  { timestamps: true }
);
todoSchema.plugin(mongooseAggregatePaginate);
export const Todo = mongoose.model("Todo", todoSchema);
