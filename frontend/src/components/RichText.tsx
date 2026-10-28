import type { ReactNode } from "react";

/** Renders a safe subset of markdown: bold, paragraphs and bullet/numbered lines. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, index) => {
    if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) {
      return <strong key={`${keyPrefix}-b-${index}`}>{chunk.slice(2, -2)}</strong>;
    }
    return <span key={`${keyPrefix}-t-${index}`}>{chunk}</span>;
  });
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim().length > 0);

  return (
    <div className={`rich ${className ?? ""}`}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").filter((line) => line.trim().length > 0);
        const isBullet = lines.every((line) => /^[-*•]\s+/.test(line));
        const isNumbered = lines.every((line) => /^\d+[.)]\s+/.test(line));

        if (isBullet || isNumbered) {
          const Tag = isNumbered ? "ol" : "ul";
          return (
            <Tag key={`block-${blockIndex}`}>
              {lines.map((line, lineIndex) => (
                <li key={`block-${blockIndex}-${lineIndex}`}>
                  {inline(line.replace(/^([-*•]|\d+[.)])\s+/, ""), `li-${blockIndex}-${lineIndex}`)}
                </li>
              ))}
            </Tag>
          );
        }

        return (
          <p key={`block-${blockIndex}`}>
            {lines.map((line, lineIndex) => (
              <span key={`p-${blockIndex}-${lineIndex}`}>
                {inline(line, `p-${blockIndex}-${lineIndex}`)}
                {lineIndex < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
