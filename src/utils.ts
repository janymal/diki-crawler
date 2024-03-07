import { createHash } from "node:crypto";
import fs from "node:fs";
import type { OptionalKeys, PickKeys } from "ts-essentials";

export const getKeys = <T extends object>(object: T) =>
    Object.keys(object) as (keyof T & string)[];

export const ensureDir = (path: fs.PathLike) => {
    if (!fs.existsSync(path)) fs.mkdirSync(path);
};

export const md5Hash = (string: string) =>
    createHash("md5").update(string).digest("hex").toString();

export function arrayPushSafely<
    T,
    K extends PickKeys<T, unknown[] | undefined>,
>(
    target: T,
    property: K,
    item: T[K] extends (infer U)[] | undefined ? U : never,
) {
    if (target[property] === undefined) target[property] = [] as T[K];
    (target[property] as T[K] & unknown[]).push(item);
}

export function markAsNonOverwritable<T>(
    target: T,
    propertyKey: OptionalKeys<T> & string,
    objectType: string,
) {
    const valueVar = `__value_of_${propertyKey}__`;
    Object.defineProperty(target, valueVar, {
        writable: true,
        enumerable: false,
        value: undefined,
    });
    Object.defineProperty(target, propertyKey, {
        set(v) {
            if (this[valueVar] === undefined) this[valueVar] = v;
            else {
                throw new Error(
                    `Overwriting the property "${propertyKey}" in an object of type "${objectType}"`,
                );
            }
        },
        get() {
            return this[valueVar];
        },
        enumerable: true,
    });
}
