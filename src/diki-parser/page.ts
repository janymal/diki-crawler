import { load as parseHTML } from "cheerio";
import type { Context } from "../shared-types.js";
import { DictionaryEntity } from "./dictionary-entity.js";

export function* Page(page: string, context: Context<DictionaryEntity>) {
    const $ = parseHTML(page);
    const dictionaryEntities = $("#en-pl")
        .parent()
        .next(".diki-results-container")
        .children(".diki-results-left-column")
        .children()
        .children(".dictionaryEntity");
    for (const dictionaryEntity of dictionaryEntities)
        yield DictionaryEntity.parse($, context, $(dictionaryEntity));
}
