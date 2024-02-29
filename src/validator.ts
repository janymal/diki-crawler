import type {
  Newable,
  OptionalKeys,
  RequiredKeys,
  Writable,
} from "ts-essentials";
import { getKeys, markAsNonOverwritable } from "./utils.js";

export class PropertiesValidator<
  T extends Newable<unknown>,
  Instance = InstanceType<T>,
  Optional = Writable<Pick<Instance, OptionalKeys<Instance>>>,
  Required = Writable<Pick<Instance, RequiredKeys<Instance>>>,
>
{
  public required: Partial<Required>;
  public optional: Partial<Optional>;

  constructor(
    private parentName: string,
    nonOverwritableRequired: Extract<keyof Required, string>[] = [],
    nonOverwritableOptional: Extract<keyof Optional, string>[] = [],
  )
  {
    this.required = {};
    this.optional = {};
    for (const property of nonOverwritableRequired)
      markAsNonOverwritable(this.required, property, parentName);
    for (const property of nonOverwritableOptional)
      markAsNonOverwritable(this.optional, property, parentName);
  }
  validate()
  {
    for (const key in this.required)
    {
      if (this.required[key] === undefined)
      {
        throw new TypeError(
          `Undefined property "${key}" in an object of type "${this.parentName}"`,
        );
      }
    }
    const returnValue = { ...this.required, ...this.optional };
    return getKeys(returnValue).length > 0 ?
      returnValue as Instance :
      undefined;
  }
}
