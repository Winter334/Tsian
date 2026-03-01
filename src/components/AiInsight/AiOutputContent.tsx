import { Fragment, useMemo, type CSSProperties } from "react";

import { borders, color, colorAlpha } from "@/styles/tokens";

interface AiOutputContentProps {
  content: string;
}

type HighlightKind = "plain" | "tag" | "key" | "string" | "number";

interface HighlightToken {
  text: string;
  kind: HighlightKind;
}

const XML_TAG_PATTERN = /^<\/?[A-Za-z_][\w:-]*(?:\s[^<>]*?)?>/;
const JSON_KEY_PATTERN = /^"(?:\\.|[^"\\])*"\s*:/;
const JSON_STRING_PATTERN = /^"(?:\\.|[^"\\])*"/;
const JSON_NUMBER_PATTERN = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const BOUNDARY_PATTERN = /[\s,:[\]{}()]/;

const HIGHLIGHT_STYLES: Record<
  Exclude<HighlightKind, "plain">,
  CSSProperties
> = {
  tag: { color: color("primary") },
  key: { color: color("secondary") },
  string: { color: color("success") },
  number: { color: colorAlpha("warning", 0.9) },
};

function isBoundaryCharacter(char: string | undefined): boolean {
  if (!char) {
    return true;
  }

  return BOUNDARY_PATTERN.test(char);
}

function tokenizeLine(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let plainBuffer = "";
  let cursor = 0;

  const flushPlain = () => {
    if (!plainBuffer) {
      return;
    }
    tokens.push({ text: plainBuffer, kind: "plain" });
    plainBuffer = "";
  };

  while (cursor < line.length) {
    const rest = line.slice(cursor);

    const tagMatch = rest.match(XML_TAG_PATTERN)?.[0];
    if (tagMatch) {
      flushPlain();
      tokens.push({ text: tagMatch, kind: "tag" });
      cursor += tagMatch.length;
      continue;
    }

    const keyMatch = rest.match(JSON_KEY_PATTERN)?.[0];
    if (keyMatch) {
      flushPlain();
      tokens.push({ text: keyMatch, kind: "key" });
      cursor += keyMatch.length;
      continue;
    }

    const stringMatch = rest.match(JSON_STRING_PATTERN)?.[0];
    if (stringMatch) {
      flushPlain();
      tokens.push({ text: stringMatch, kind: "string" });
      cursor += stringMatch.length;
      continue;
    }

    const numberMatch = rest.match(JSON_NUMBER_PATTERN)?.[0];
    if (numberMatch) {
      const previousChar = line[cursor - 1];
      const nextChar = line[cursor + numberMatch.length];
      const shouldHighlightNumber =
        isBoundaryCharacter(previousChar) && isBoundaryCharacter(nextChar);

      if (shouldHighlightNumber) {
        flushPlain();
        tokens.push({ text: numberMatch, kind: "number" });
        cursor += numberMatch.length;
        continue;
      }
    }

    plainBuffer += line[cursor];
    cursor += 1;
  }

  flushPlain();
  return tokens;
}

export function AiOutputContent({ content }: AiOutputContentProps) {
  const tokenLines = useMemo(() => {
    return content.split(/\r?\n/).map((line) => tokenizeLine(line));
  }, [content]);

  return (
    <div
      className="overflow-x-auto p-3 text-xs leading-relaxed whitespace-pre-wrap break-all"
      style={{
        background: colorAlpha("bgBase", 0.6),
        border: `1px solid ${colorAlpha("border", 0.25)}`,
        borderRadius: borders.radius.DEFAULT,
        color: color("textSecondary"),
        fontFamily: "monospace",
      }}
    >
      {tokenLines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {line.map((token, tokenIndex) => (
            <span
              key={`${lineIndex}-${tokenIndex}`}
              style={
                token.kind === "plain"
                  ? undefined
                  : HIGHLIGHT_STYLES[token.kind]
              }
            >
              {token.text}
            </span>
          ))}
          {lineIndex < tokenLines.length - 1 ? "\n" : null}
        </Fragment>
      ))}
    </div>
  );
}
