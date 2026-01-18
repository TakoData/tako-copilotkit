"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Listen for Tako chart resize messages
  useEffect(() => {
    const handleTakoResize = (event: MessageEvent) => {
      const data = event.data;

      // Early return if not a Tako resize message
      if (data.type !== "tako::resize") return;

      // Find and resize the iframe that sent this message
      const iframes = document.querySelectorAll("iframe");
      for (const iframe of iframes) {
        if (iframe.contentWindow === event.source) {
          iframe.style.height = `${data.height}px`;
          break;
        }
      }
    };

    window.addEventListener("message", handleTakoResize);
    return () => window.removeEventListener("message", handleTakoResize);
  }, [content]);

  return (
    <div className="prose prose-slate max-w-none bg-background px-6 py-8 border-0 shadow-none rounded-xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom renderer for HTML elements to allow iframes
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          h1: ({ node, ...props }) => (
            <h1 className="text-3xl font-bold mb-4 text-primary" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          h2: ({ node, ...props }) => (
            <h2 className="text-2xl font-semibold mb-3 mt-6 text-primary" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          h3: ({ node, ...props }) => (
            <h3 className="text-xl font-semibold mb-2 mt-4 text-primary" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          p: ({ node, ...props }) => (
            <p className="mb-4 text-foreground leading-relaxed" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside mb-4 space-y-2" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside mb-4 space-y-2" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          li: ({ node, ...props }) => (
            <li className="text-foreground" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          a: ({ node, ...props }) => (
            <a
              className="text-[#6766FC] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          code: ({ node, inline, ...props }) => {
            if (inline) {
              return (
                <code
                  className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                />
              );
            }
            return (
              <code
                className="block bg-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-4"
                {...props}
              />
            );
          },
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          iframe: ({ node, ...props }) => (
            <iframe
              {...props}
              className="w-full border-0 rounded-lg mb-6"
              style={{ minHeight: "400px" }}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
