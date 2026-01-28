"use client";

import React, { useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface MarkdownRendererProps {
  content: string;
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

// Memoized components object
const markdownComponents = {
  h1: ({ node, ...props }: any) => (
    <h1 className="text-3xl font-bold mb-4 text-primary" {...props} />
  ),
  h2: ({ node, ...props }: any) => (
    <h2 className="text-2xl font-semibold mb-3 mt-6 text-primary" {...props} />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 className="text-xl font-semibold mb-2 mt-4 text-primary" {...props} />
  ),
  p: ({ node, ...props }: any) => (
    <p className="mb-4 text-foreground leading-relaxed" {...props} />
  ),
  ul: ({ node, ...props }: any) => (
    <ul className="list-disc list-inside mb-4 space-y-2" {...props} />
  ),
  ol: ({ node, ...props }: any) => (
    <ol className="list-decimal list-inside mb-4 space-y-2" {...props} />
  ),
  li: ({ node, ...props }: any) => (
    <li className="text-foreground" {...props} />
  ),
  a: ({ node, ...props }: any) => (
    <a
      className="text-[#6766FC] hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  code: ({ node, className, children, ...props }: any) => {
    const isCodeBlock = className?.includes("language-");
    if (!isCodeBlock) {
      return (
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-4" {...props}>
        {children}
      </code>
    );
  },
};

// Global registry of iframes - src never changes for a given id
const iframeRegistry = new Map<string, string>();

type ContentSegment =
  | { type: 'text'; content: string; key: string }
  | { type: 'iframe'; id: string; src: string; key: string };

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Split content into text segments and iframes as siblings
  // This keeps iframes OUTSIDE ReactMarkdown's component tree
  const segments = useMemo(() => {
    const embedPattern = /<!doctype html>[\s\S]*?<\/html>/gi;
    const parts: ContentSegment[] = [];

    let lastIndex = 0;
    let textSegmentIndex = 0;
    const regex = new RegExp(embedPattern.source, 'gi');
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Add text before this match
      if (match.index > lastIndex) {
        const textContent = content.slice(lastIndex, match.index);
        if (textContent.trim()) {
          parts.push({
            type: 'text',
            content: textContent,
            key: `text-${textSegmentIndex++}`
          });
        }
      }

      // Add iframe with stable ID based on src
      const src = extractIframeSrc(match[0]);
      if (src) {
        const id = generateEmbedId(src);
        // Register in global registry (immutable once set)
        if (!iframeRegistry.has(id)) {
          iframeRegistry.set(id, src);
        }
        parts.push({ type: 'iframe', id, src, key: id });
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      const textContent = content.slice(lastIndex);
      if (textContent.trim()) {
        parts.push({
          type: 'text',
          content: textContent,
          key: `text-${textSegmentIndex}`
        });
      }
    }

    return parts;
  }, [content]);

  return (
    <div className="prose prose-slate max-w-none bg-background px-6 py-8 border-0 shadow-none rounded-xl">
      {segments.map((segment) => {
        if (segment.type === 'text') {
          return (
            <ReactMarkdown
              key={segment.key}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={markdownComponents}
            >
              {segment.content}
            </ReactMarkdown>
          );
        } else {
          // Iframe rendered as sibling, not inside ReactMarkdown
          // Use stable ID as key so it persists across content changes
          const registeredSrc = iframeRegistry.get(segment.id);
          if (!registeredSrc) return null;
          return <StableIframe key={segment.key} id={segment.id} src={registeredSrc} />;
        }
      })}
    </div>
  );
}

// Stable iframe component - memoized to prevent re-renders
const StableIframe = React.memo(
  function StableIframe({ id, src }: { id: string; src: string }) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Handle resize messages from Tako embeds
    useEffect(() => {
      const handleResize = (event: MessageEvent) => {
        if (event.data?.type !== "tako::resize") return;

        if (iframeRef.current?.contentWindow === event.source) {
          iframeRef.current.style.height = `${event.data.height}px`;
        }
      };

      window.addEventListener("message", handleResize);
      return () => window.removeEventListener("message", handleResize);
    }, []);

    return (
      <iframe
        ref={iframeRef}
        src={src}
        className="w-full border-0 rounded-lg"
        style={{ height: "400px", display: "block" }}
        scrolling="no"
        frameBorder="0"
        allow="fullscreen"
        data-tako-embed="true"
      />
    );
  },
  // Only re-render if id or src changes
  (prevProps, nextProps) => prevProps.id === nextProps.id && prevProps.src === nextProps.src
);
