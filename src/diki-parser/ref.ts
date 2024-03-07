import type { AnyNode, Cheerio, CheerioAPI } from "cheerio";
import type { Context } from "../shared-types.js";
import { PropertiesValidator } from "../validator.js";
import { logUnknownItem, newDiv } from "./utils.js";

import type { DictionaryEntity } from "./dictionary-entity.js";
import { RefItem } from "./ref-item.js";

export class Ref {
    constructor(
        readonly type: string,
        readonly items: RefItem[],
    ) {}
    static parse(
        $: CheerioAPI,
        context: Context<DictionaryEntity>,
        ref: Cheerio<AnyNode>,
    ): Ref {
        const validator = new PropertiesValidator<Ref>(this.name, ["items"]);
        let secondSectionStartIndex: number | undefined;
        const refContents = ref.children().contents();
        refContents.each((i, childNode) => {
            const child = $(childNode);
            if (childNode.nodeType === 3) {
                validator.required.type =
                    (validator.required.type ?? "") + child.text();
            } else if (child.prop("tagName") === "A") {
                secondSectionStartIndex = i;
                return false;
            } else if (child.hasClass("refIcon")) return;
            else logUnknownItem(context, child, this.name);
            return true;
        });
        validator.required.items = refContents
            .slice(secondSectionStartIndex)
            .filter("a")
            .map((_, aElement) => {
                const refItem = $(aElement)
                    .nextUntil("a")
                    .addBack()
                    .wrapAll(newDiv("refItem"))
                    .parent();
                return RefItem.parse($, context, refItem);
            })
            .get();
        validator.required.type = validator.required.type?.trim().slice(0, -1);
        return validator.validate();
    }
}
