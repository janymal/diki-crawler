import type { OptionalKeys, RequiredKeys } from "ts-essentials";
import { getKeys, markAsNonOverwritable } from "./utils.js";

type OptionalKeyStrings<T> = OptionalKeys<T> & string;

type WritablePartial<T> = { -readonly [K in keyof T]?: T[K] };

type TRequired<T> = WritablePartial<Pick<T, RequiredKeys<T>>>;
type TOptional<T> = WritablePartial<Pick<T, OptionalKeys<T>>>;

export class PropertiesValidator<T> {
    public required: TRequired<T>;
    public optional: TOptional<T>;

    constructor(
        private objectType: string,
        nonOverwritableRequired: OptionalKeyStrings<TRequired<T>>[] = [],
        nonOverwritableOptional: OptionalKeyStrings<TOptional<T>>[] = [],
    ) {
        this.required = {};
        this.optional = {};
        for (const key of nonOverwritableRequired)
            markAsNonOverwritable(this.required, key, this.objectType);
        for (const key of nonOverwritableOptional)
            markAsNonOverwritable(this.optional, key, this.objectType);
    }
    validate() {
        for (const key of getKeys(this.required)) {
            if (this.required[key] === undefined) {
                throw new TypeError(
                    `Undefined property "${key}" in an object of type "${this.objectType}"`,
                );
            }
        }
        const finalObject = { ...this.required, ...this.optional };
        return (
            getKeys(finalObject).length > 0 ? finalObject : undefined
        ) as RequiredKeys<T> extends never ? T | undefined : T;
    }
}
