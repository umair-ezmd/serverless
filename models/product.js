const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
