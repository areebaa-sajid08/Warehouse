import "dotenv/config";
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../src/models/users.model.js";
import connectDB from "../src/db/db.js";

const prompt = createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => prompt.question(question, resolve));

function askPassword(question) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(new Error("Run this command from an interactive terminal to enter the password securely."));
  }

  process.stdout.write(question);
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      input.setRawMode(false);
      input.removeListener("data", onData);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Admin setup cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };
    input.on("data", onData);
  });
}

async function main() {
  await connectDB();
  if (await User.exists({ role: "admin" })) {
    throw new Error("An admin account already exists. Sign in with it to manage the team.");
  }

  const name = (await ask("Admin name: ")).trim();
  const email = (await ask("Admin email: ")).trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A name and valid email address are required.");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const confirm = (await ask(`Promote the existing account ${email} to admin? (y/N): `)).trim().toLowerCase();
    if (confirm !== "y") throw new Error("Admin setup cancelled.");
  }
  prompt.close();

  const password = await askPassword("Admin password (hidden): ");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const passwordHash = await bcrypt.hash(password, 12);

  if (existingUser) {
    existingUser.username ||= email;
    existingUser.name = name;
    existingUser.password = passwordHash;
    existingUser.role = "admin";
    await existingUser.save();
  } else {
    await User.create({ username: email, name, email, password: passwordHash, role: "admin" });
  }

  console.log(`Admin account ready for ${email}. Sign in through the Wareflow frontend.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    prompt.close();
    await mongoose.disconnect();
  });
