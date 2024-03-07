import type { AnyNode, Cheerio, CheerioAPI } from "cheerio";
import type { Context } from "../shared-types.js";
import { arrayPushSafely } from "../utils.js";
import { PropertiesValidator } from "../validator.js";
import { AdditionalInformation } from "./additional-information.js";
import type { DictionaryEntity } from "./dictionary-entity.js";
import { ExampleSentence } from "./example-sentence.js";
import { Ref } from "./ref.js";
import { logUnknownItem } from "./utils.js";

export class Meaning {
    constructor(
        readonly id: string,
        readonly terms: string,
        readonly notForChildren: boolean,
        readonly additionalInformation?: AdditionalInformation,
        readonly grammarTags?: string[],
        readonly mf?: string, // TODO: figure out what actually that is
        readonly exampleSentences?: ExampleSentence[],
        readonly thematicDictionaries?: string[],
        readonly note?: string,
        readonly refs?: Ref[],
        readonly copyright?: string,
    ) {}
    static parse(
        $: CheerioAPI,
        context: Context<DictionaryEntity>,
        meaning: Cheerio<AnyNode>,
        isNotForChildren: boolean = false,
        id?: string,
    ): Meaning {
        const validator = new PropertiesValidator<Meaning>(
            this.name,
            ["id", "notForChildren"],
            ["additionalInformation", "mf", "note", "copyright"],
        );
        let meaningNotForChildren: Cheerio<AnyNode> | undefined;
        meaning.contents().each((_, childNode) => {
            const child = $(childNode);
            if (child.hasClass("hiddenNotForChildrenMeaning")) {
                isNotForChildren = true;
                meaningNotForChildren = child;
                return false;
            } else if (child.hasClass("hw") || childNode.nodeType === 3) {
                validator.required.terms =
                    (validator.required.terms ?? "") + child.text();
            } else if (child.hasClass("grammarTag")) {
                arrayPushSafely(
                    validator.optional,
                    "grammarTags",
                    child.text().slice(1, -1),
                );
            } else if (child.hasClass("meaningAdditionalInformation")) {
                validator.optional.additionalInformation =
                    AdditionalInformation.parse(
                        $,
                        context,
                        meaning.children(".meaningAdditionalInformation"),
                    );
            } else if (child.hasClass("exampleSentence")) {
                arrayPushSafely(
                    validator.optional,
                    "exampleSentences",
                    ExampleSentence.parse($, context, child),
                );
            } else if (child.hasClass("cat")) {
                arrayPushSafely(
                    validator.optional,
                    "thematicDictionaries",
                    child.text().trim(),
                );
            } else if (child.hasClass("ref")) {
                arrayPushSafely(
                    validator.optional,
                    "refs",
                    Ref.parse($, context, child),
                );
            } else if (child.hasClass("nt"))
                validator.optional.note = child.text().trim();
            else if (child.hasClass("mf"))
                validator.optional.mf =
                    validator.optional.mf + child.text().trim();
            else if (child.hasClass("meaning_copyright"))
                validator.optional.copyright = child.text().trim();
            else if (child.hasClass("repetitionAddOrRemoveIconAnchor")) return;
            else logUnknownItem(context, child, this.name);
            return true;
        });
        let idFromAttr = meaning.attr("id")?.trim().slice(7, -3);
        if (meaningNotForChildren !== undefined) {
            return Meaning.parse(
                $,
                context,
                meaningNotForChildren,
                isNotForChildren,
                idFromAttr,
            );
        }
        validator.required.notForChildren = isNotForChildren;
        validator.required.id = id ?? idFromAttr;
        validator.required.terms = validator.required.terms?.trim();
        return validator.validate();
    }
}
