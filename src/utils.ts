import { createHash } from "node:crypto";
import fs from "node:fs";

export const getKeys = <T extends object>(object: T) =>
  Object.keys(object) as (keyof T)[];

export const ensureDir = (path: fs.PathLike) =>
{
  if (!fs.existsSync(path))
    fs.mkdirSync(path);
};

export const md5Hash = (string: string) =>
  createHash("md5").update(string).digest("hex").toString();

export function markAsNonOverwritable<T extends Record<string, unknown>>(
  target: T,
  propertyKey: string,
  targetName: string,
)
{
  const valueVar = `__value_of_${propertyKey}__`;
  Object.defineProperty(target, valueVar, {
    writable: true,
    enumerable: false,
    value: undefined,
  });
  Object.defineProperty(target, propertyKey, {
    set(v)
    {
      if (this[valueVar] === undefined)
        this[valueVar] = v;
      else
      {
        throw new Error(
          `Overwriting the property "${propertyKey}" in an object of type "${targetName}"`,
        );
      }
    },
    get()
    {
      return this[valueVar];
    },
    enumerable: true,
  });
}
