import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders the model's reply as Markdown, 1:1. Links open in the system browser (see the
 * window-open handler in electron/window.ts).
 *
 * Images are never loaded: a reply could embed an image URL that carries chat content to a
 * remote server the moment it renders (zero-click exfiltration). They become plain links,
 * and the Content-Security-Policy (img-src 'self' data:) blocks remote images as a second layer.
 */
export default function Markdown({ content }: { content: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <a href={src} target="_blank" rel="noreferrer noopener" title={src}>
              [{alt || src}]
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
