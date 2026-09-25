import { Fragment, type ReactNode } from 'react';

/**
 * Renders a translated template whose `{name}` placeholders are React nodes (links, bold text…),
 * so word order stays under the translator's control. Unknown placeholders are left as-is.
 */
export function RichText({ text, parts }: { text: string; parts: Record<string, ReactNode> }) {
  const chunks = text.split(/(\{\w+\})/g);
  return (
    <>
      {chunks.map((chunk, i) => {
        const m = /^\{(\w+)\}$/.exec(chunk);
        return <Fragment key={i}>{m && m[1] in parts ? parts[m[1]] : chunk}</Fragment>;
      })}
    </>
  );
}
