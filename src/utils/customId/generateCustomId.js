// utils/generateCustomId.js
const { v4: uuidv4 } = require("uuid");
const Counter = require("../../models/counter.model");

const PREFIX = "WE"; // Always constant

function extractDigitsFromUUID(count) {
  const uuid = uuidv4().replace(/[^0-9]/g, "");
  return uuid.slice(0, count).padEnd(count, "0");
}

async function generateCustomId(entityType, entityCode) {
  if (!entityCode || typeof entityCode !== "string") {
    throw new Error("Entity code must be a valid string");
  }

  const counterDoc = await Counter.findOneAndUpdate(
    { _id: entityType },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const counterStr = counterDoc.seq.toString();
  const requiredDigits = 6;

  let paddedPart;

  if (counterStr.length < requiredDigits) {
    const uuidDigits = extractDigitsFromUUID(
      requiredDigits - counterStr.length
    );
    paddedPart = uuidDigits + counterStr;
  } else {
    paddedPart = counterStr;
  }

  return `${PREFIX}${entityCode}${paddedPart}`;
}

module.exports = generateCustomId;
