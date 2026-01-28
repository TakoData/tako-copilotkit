"use client";

import React, { useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface MarkdownRendererProps {
  content: string;
}

interface ExtractedEmbed {
  id: string;
  html: string;
  src: string;
}

// Extract the iframe src from an HTML block
function extractIframeSrc(html: string): string | null {
  const srcMatch = html.match(/src=["']([^"']+)["']/);
  return srcMatch ? srcMatch[1] : null;
}

// Generate a stable ID from the iframe src
function generateEmbedId(src: string): string {
  try {
    const url = new URL(src);
    return `embed-${url.pathname.replace(/[^a-zA-Z0-9]/g, "-")}`;
  } catch {
    return `embed-${src.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 50)}`;
  }
}

// Module-level cache for embeds to persist across re-renders
const embedCache = new Map<string, ExtractedEmbed>();

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Process content and extract embeds using useMemo (no state updates)
  const { processedContent, embeds } = useMemo(() => {
    const embedPattern = /<!doctype html>[\s\S]*?<\/html>/gi;
    let processed = content;
    const matches = content.match(embedPattern) || [];
    const currentEmbeds = new Map<string, ExtractedEmbed>();

    for (const match of matches) {
      const src = extractIframeSrc(match);
      if (src) {
        const id = generateEmbedId(src);

        // Use cached embed if available, otherwise create new
        if (embedCache.has(id)) {
          currentEmbeds.set(id, embedCache.get(id)!);
        } else {
          const embed = { id, html: match, src };
          embedCache.set(id, embed);
          currentEmbeds.set(id, embed);
        }

        // Replace with placeholder
        processed = processed.replace(match, `<div data-embed-placeholder="${id}"></div>`);
      }
    }

    return { processedContent: processed, embeds: currentEmbeds };
  }, [content]);

  // Listen for Tako chart resize messages
  useEffect(() => {
    const handleTakoResize = (event: MessageEvent) => {
      const data = event.data;
      if (data.type !== "tako::resize") return;

      const iframes = document.querySelectorAll<HTMLIFrameElement>("iframe[data-tako-embed]");
      for (const iframe of iframes) {
        if (iframe.contentWindow === event.source) {
          iframe.style.height = `${data.height}px`;
          break;
        }
      }
    };

    window.addEventListener("message", handleTakoResize);
    return () => window.removeEventListener("message", handleTakoResize);
  }, []);

  return (
    <div className="prose prose-slate max-w-none bg-background px-6 py-8 border-0 shadow-none rounded-xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
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
          code: ({ node, className, children, ...props }) => {
            const isCodeBlock = className?.includes("language-");
            if (!isCodeBlock) {
              return (
                <code
                  className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="block bg-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-4"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Render embed placeholders with stable iframe components
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          div: ({ node, ...props }) => {
            const embedId = (node?.properties?.["dataEmbedPlaceholder"] as string) ||
                           (props as Record<string, unknown>)["data-embed-placeholder"] as string | undefined;
            if (embedId) {
              const embed = embeds.get(embedId);
              if (embed) {
                return <StableEmbed key={embed.id} embed={embed} />;
              }
            }
            return <div {...props} />;
          },
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          iframe: ({ node, ...props }) => (
            <iframe
              {...props}
              className="w-full border-0 rounded-lg mb-4"
              data-tako-embed="true"
            />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

// Separate component for stable embed rendering
const StableEmbed = React.memo(function StableEmbed({ embed }: { embed: ExtractedEmbed }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle resize messages for this specific iframe
  useEffect(() => {
    const handleResize = (event: MessageEvent) => {
      const data = event.data;
      if (data.type !== "tako::resize") return;

      if (iframeRef.current && iframeRef.current.contentWindow === event.source) {
        iframeRef.current.style.height = `${data.height}px`;
      }
    };

    window.addEventListener("message", handleResize);
    return () => window.removeEventListener("message", handleResize);
  }, []);

  return (
    <div className="w-full mb-4">
      <iframe
        ref={iframeRef}
        src={embed.src}
        className="w-full border-0 rounded-lg"
        style={{ height: "400px" }}
        scrolling="no"
        frameBorder="0"
        allow="fullscreen"
        data-tako-embed="true"
      />
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.embed.src === nextProps.embed.src;
});
