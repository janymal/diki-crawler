import type { AnyNode, Cheerio, CheerioAPI } from "cheerio";
import type { Context } from "../shared-types.js";
import { PropertiesValidator } from "../validator.js";
import type { DictionaryEntity } from "./dictionary-entity.js";
import { RecordingsAndTranscriptions } from "./recordings-and-transcriptions.js";
import { logUnknownItem } from "./utils.js";

export class Form {
    constructor(
        readonly term: string,
        readonly form: string,
        readonly recordingsAndTranscriptions?: RecordingsAndTranscriptions,
    ) {}
    static parse(
        $: CheerioAPI,
        context: Context<DictionaryEntity>,
        form: Cheerio<AnyNode>,
    ): Form {
        const validator = new PropertiesValidator<Form>(
            this.name,
            ["term", "form"],
            ["recordingsAndTranscriptions"],
        );
        form.children().each((_, childElement) => {
            const child = $(childElement);
            if (child.hasClass("foreignTermText"))
                validator.required.term = child.text();
            else if (child.hasClass("foreignTermHeader"))
                validator.required.form = child.text();
            else if (child.hasClass("recordingsAndTranscriptions")) {
                validator.optional.recordingsAndTranscriptions =
                    RecordingsAndTranscriptions.parse($, context, child);
            } else {
                logUnknownItem(context, child, this.name);
            }
        });

        return validator.validate();
    }
}
