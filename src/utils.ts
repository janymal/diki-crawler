import { createHash } from "node:crypto";
import fs from "node:fs";

export const ensureDir = (path: fs.PathLike) =>
{
  if (!fs.existsSync(path))
    fs.mkdirSync(path);
};

export const md5Hash = (string: string) =>
  createHash("md5").update(string).digest("hex").toString();
