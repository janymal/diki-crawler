import type { AnyNode, Cheerio, CheerioAPI } from "cheerio";
import type { Context } from "../shared-types.js";
import { PropertiesValidator } from "../validator.js";
import type { DictionaryEntity } from "./dictionary-entity.js";
import { RecordingsAndTranscriptions } from "./recordings-and-transcriptions.js";
import { logUnknownItem } from "./utils.js";

export class RefItem {
    constructor(
        readonly term: string,
        readonly recordingsAndTranscriptions?: RecordingsAndTranscriptions,
    ) {}
    static parse(
        $: CheerioAPI,
        context: Context<DictionaryEntity>,
        refItem: Cheerio<AnyNode>,
    ): RefItem {
        const validator = new PropertiesValidator<RefItem>(
            RefItem.name,
            ["term"],
            ["recordingsAndTranscriptions"],
        );
        refItem.children().each((_, childElement) => {
            const child = $(childElement);
            if (child.prop("tagName") === "A")
                validator.required.term = child.text();
            else if (child.hasClass("recordingsAndTranscriptions")) {
                validator.optional.recordingsAndTranscriptions =
                    RecordingsAndTranscriptions.parse($, context, child);
            } else {
                logUnknownItem(context, child, RefItem.name);
            }
        });
        return validator.validate();
    }
}
