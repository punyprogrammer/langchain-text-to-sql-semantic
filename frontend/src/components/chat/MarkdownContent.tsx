import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
        ),
        h1: ({ children }) => (
          <h1 className="mb-3 text-lg font-semibold text-foreground">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-4 text-base font-semibold text-foreground">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-3 text-sm font-semibold text-foreground">
            {children}
          </h3>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="rounded bg-surface-100 px-1 py-0.5 font-mono text-xs text-brand">
            {children}
          </code>
        ),
        table: ({ children }) => (
          <div className="mb-3 overflow-x-auto last:mb-0">
            <table className="w-full border-collapse text-left text-xs">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-surface-500">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-2 py-1.5 font-medium text-foreground-muted">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-t border-surface-500 px-2 py-1.5">{children}</td>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-brand underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
