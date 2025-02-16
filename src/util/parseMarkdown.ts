import {
  ApiFormattedText,
  ApiMessageEntity,
  ApiMessageEntityTypes,
} from "../api/types";

type ParserEntityTypes =
  | ApiMessageEntityTypes.Bold
  | ApiMessageEntityTypes.Italic
  | ApiMessageEntityTypes.Strike
  | ApiMessageEntityTypes.Code
  | ApiMessageEntityTypes.Pre
  | ApiMessageEntityTypes.Spoiler;

const EntityChar: { [key: string]: ParserEntityTypes | undefined } = {
  "*": ApiMessageEntityTypes.Bold,
  _: ApiMessageEntityTypes.Italic,
  "~": ApiMessageEntityTypes.Strike,
  "`": ApiMessageEntityTypes.Code,
  "|": ApiMessageEntityTypes.Spoiler,
};

type Token = (
  | {
      type: "entity";
      entity: ApiMessageEntityTypes.Pre;
      lang?: string;
    }
  | {
      type: "entity";
      entity: Exclude<ParserEntityTypes, ApiMessageEntityTypes.Pre>;
    }
  | { type: "text" }
) & {
  str: string;
};

function tokenize(text: string): Token[] {
  let tokens: Token[] = [];
  let addFormI = 0;
  let accum = "";
  let dumpAccum = () => {
    if (accum.length)
      tokens.push({
        type: "text",
        str: accum,
      });
    accum = "";
  };

  for (let i = 0; i < text.length; i++) {
    let cur = text[i];
    let lookAhead = text[i + 1] ?? "";
    let sLookAhead = text[i + 2] ?? "";

    let curEnt = EntityChar[cur];
    if (curEnt == ApiMessageEntityTypes.Code) {
      dumpAccum();
      if (lookAhead == "`" && sLookAhead == "`") {
        tokens.push({
          type: "entity",
          entity: ApiMessageEntityTypes.Pre,
          str: "```",
        });
        i += 2;
      } else {
        tokens.push({
          type: "entity",
          entity: ApiMessageEntityTypes.Code,
          str: "`",
        });
      }
    } else if (curEnt) {
      if (lookAhead == cur) {
        dumpAccum();
        tokens.push({
          type: "entity",
          entity: curEnt,
          str: cur + lookAhead,
        });
        i++;
      } else {
        accum += cur;
      }
    } else {
      accum += cur;
    }
  }

  dumpAccum();
  return tokens;
}

function countTokens(tokens: Token[]): {
  map: Map<ApiMessageEntityTypes, number>;
  get(entity: ApiMessageEntityTypes): number;
  dec(entity: ApiMessageEntityTypes, count?: number): void;
  inc(entity: ApiMessageEntityTypes, count?: number): void;
} {
  let res: Map<ApiMessageEntityTypes, number> = new Map();
  for (let token of tokens) {
    if ("entity" in token) {
      res.set(token.entity, (res.get(token.entity) ?? 0) + 1);
    }
  }

  return {
    map: res,
    get(entity: ApiMessageEntityTypes) {
      return res.get(entity) ?? 0;
    },
    dec(entity: ApiMessageEntityTypes, count = 1) {
      res.set(entity, (res.get(entity) ?? 0) - count);
    },
    inc(entity: ApiMessageEntityTypes, count = 1) {
      res.set(entity, (res.get(entity) ?? 0) + count);
    },
  };
}

function getPreLanguage(
  preContents: string
): [string | undefined, string] | null {
  let fullTrim = preContents.trim();
  if (fullTrim.length == 0) {
    return null;
  }

  let breakPos = preContents.indexOf("\n");
  let lang: string | undefined;
  let rest = fullTrim;

  if (breakPos != -1) {
    lang = preContents.slice(0, breakPos).trim();
    rest = preContents.slice(breakPos + 1);
  }

  rest = rest.trim();
  if (rest.length == 0) {
    return [undefined, fullTrim];
  }

  if (lang?.length == 0) lang = undefined;

  return [lang, rest];
}

/// Code pass: Remove all entities inside codeblocks
function doCodePass(tokens: Token[]): Token[] {
  let res: Token[] = [];
  let tokenCount = countTokens(tokens);

  let currentCode:
    | ApiMessageEntityTypes.Code
    | ApiMessageEntityTypes.Pre
    | null = null;
  let accum = "";
  for (let token of tokens) {
    if (token.type == "entity") {
      let discard = false;
      if (currentCode == null) {
        if (
          token.entity == ApiMessageEntityTypes.Pre ||
          token.entity == ApiMessageEntityTypes.Code
        ) {
          if (tokenCount.get(token.entity) >= 2) {
            currentCode = token.entity;
            tokenCount.dec(token.entity);
            res.push(token);
          } else {
            discard = true;
          }
        } else {
          res.push(token);
        }
      } else if (currentCode == token.entity) {
        tokenCount.dec(token.entity);

        if (currentCode == ApiMessageEntityTypes.Pre) {
          let langAndRest = getPreLanguage(accum);
          if (langAndRest) {
            res.push({ type: "text", str: langAndRest[1] });
            res.push({
              ...token,
              entity: ApiMessageEntityTypes.Pre,
              lang: langAndRest[0],
            });
          } else {
            // invalid pre block
            res.pop();
            res.push({ type: "text", str: "```" + accum + "```" });
          }
        } else {
          res.push({ type: "text", str: accum });
          res.push(token);
        }

        currentCode = null;
        accum = "";
      } else {
        discard = true;
      }

      if (discard) {
        // Entity inside codeblock, discard it to just text
        tokenCount.dec(token.entity);
        accum += token.str;
      }
    } else {
      if (currentCode == null) {
        res.push(token);
      } else {
        accum += token.str;
      }
    }
  }

  return res;
}

type ConsumedInfo = {
  pos: number;
  consumed: number;
};

// Generate entities from tokens while removing unterminated ones
function tokensToEntities(tokens: Token[]): [ApiFormattedText, ConsumedInfo[]] {
  let tokenCount = countTokens(tokens);
  let tokenStarts: Map<ApiMessageEntityTypes, number> = new Map();

  let resStr = "";
  let resEnt: ApiMessageEntity[] = [];
  let resConsumed: ConsumedInfo[] = [];

  for (let token of tokens) {
    if (token.type == "entity") {
      if (tokenStarts.has(token.entity)) {
        const startPos = tokenStarts.get(token.entity)!;

        let newt: ApiMessageEntity = {
          type: token.entity,
          offset: startPos,
          length: resStr.length - startPos,
        };

        if (
          newt.type == ApiMessageEntityTypes.Pre &&
          token.entity == ApiMessageEntityTypes.Pre
        ) {
          newt.language = token.lang;
        }

        resEnt.push(newt);

        resConsumed.push({
          pos: resStr.length,
          consumed: token.str.length,
        });
        tokenCount.dec(token.entity);
        tokenStarts.delete(token.entity);
      } else if (tokenCount.get(token.entity) >= 2) {
        resConsumed.push({
          pos: resStr.length,
          consumed: token.str.length,
        });
        tokenCount.dec(token.entity);
        tokenStarts.set(token.entity, resStr.length);
      } else {
        resStr += token.str;
      }
    } else {
      resStr += token.str;
    }
  }

  return [
    {
      text: resStr,
      entities: resEnt,
    },
    resConsumed,
  ];
}

function trimMessage(text: ApiFormattedText): ApiFormattedText {
  let str = text.text;
  let entities = text.entities ?? [];
  let startSize = str.length;
  str = str.trimStart();
  let startShift = startSize - str.length;
  str = str.trimEnd();

  if (startSize != str.length) {
    for (let ent of entities) {
      if (ent.offset < startShift) {
        ent.length = ent.offset + ent.length - startShift;
        ent.offset = 0;
      } else {
        ent.offset -= startShift;
      }

      if (ent.length + ent.offset > str.length) {
        ent.length = str.length - ent.offset;
      }
    }
  }

  return {
    text: str,
    entities,
  };
}

function addExternalEntities(
  text: ApiFormattedText,
  consumed: ConsumedInfo[],
  extEnt: ApiMessageEntity[]
): ApiFormattedText {
  if (extEnt.length == 0) return text;

  consumed = consumed.sort((a, b) => a.pos - b.pos);
  extEnt = extEnt.sort((a, b) => a.offset - b.offset);

  for (let ent of extEnt) {
    let start = ent.offset;
    let end = ent.offset + ent.length;
    console.log(start, end)
    for (let i = 0; i < consumed.length; i++) {
      if (start >= consumed[i].pos) {
        start -= Math.min(consumed[i].consumed, start - consumed[i].pos);
      }

      if (end >= consumed[i].pos) {
        end -= Math.min(consumed[i].consumed, end - consumed[i].pos);
      }
    }
    text.entities?.push({
      ...ent,
      offset: start,
      length: end - start,
    });
  }

  return text;
}

export function parseMarkdown(
  text: string,
  extEnt: ApiMessageEntity[] = []
): ApiFormattedText {
  let tokens: Token[] = tokenize(text);
  tokens = doCodePass(tokens);

  let [fmtText, consumed] = tokensToEntities(tokens);

  fmtText = addExternalEntities(fmtText, consumed, extEnt);

  fmtText = trimMessage(fmtText);
  return fmtText;
}
