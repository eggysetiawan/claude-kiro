#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const isProject = process.argv.includes("--project");

const sourceDir = path.join(__dirname, "..", "kiro-handoff");
const skillsDir = isProject
  ? path.join(process.cwd(), ".claude", "skills")
  : path.join(os.homedir(), ".claude", "skills");
const targetDir = path.join(skillsDir, "kiro-handoff");

fs.mkdirSync(skillsDir, { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });

const scope = isProject ? "this project" : "your user (global)";
console.log(`Installed kiro-handoff skill for ${scope}:`);
console.log(`  ${targetDir}`);
console.log("");
console.log("Restart Claude Code (or start a new session) to pick it up.");
