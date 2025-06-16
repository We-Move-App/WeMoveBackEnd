const mongoose = require("mongoose");

const UserDocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    documentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        required: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

const UserDocumentModel = mongoose.model("UserDocument", UserDocumentSchema);
module.exports = { UserDocumentModel };
