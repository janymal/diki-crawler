import type { AnyNode, Cheerio } from "cheerio";
import console from "node:console";
import type { OptionalKeys, RequiredKeys, Writable } from "ts-essentials";
import type { Context } from "../shared-types.js";

const getKeys = <T extends object>(object: T) =>
  Object.keys(object) as (keyof T)[];

type Newable = abstract new(...args: any[]) => any;

export class PropertiesValidator<
  T extends Newable,
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

export const newDiv = (className: string) => `<div class="${className}"></div>`;

export function logUnknownItem<T>(
  context: Context<T>,
  item: Cheerio<AnyNode>,
  sectionName: string,
)
{
  console.warn(
    `Unknown item in the ${sectionName} section: ${item.prop("outerHTML")}`,
    context.request.url,
  );
}
