# Tako Research Canvas - Improvements Plan 3

## Issues to Fix

1. **Resources disappear when writing draft** - Page refreshes and hides resources during report generation
2. **Chart sizing issues** - Charts take full width but aren't tall enough (resize script not working)
3. **Resizable divider** - Add draggable divider between chat and canvas to adjust widths

---

## Issue 1: Resources Disappearing During Draft Generation

### Problem
When the agent writes the draft, the page appears to refresh and resources disappear. This is likely a state management issue where resources are being cleared or the component is unmounting.

### Root Cause Analysis
Possible causes:
1. State being reset when report updates
2. CopilotKit re-rendering causing state loss
3. Resources array being cleared in state update

### Solution
Ensure resources persist across state updates.

**File**: Check if `src/components/ResearchCanvas.tsx` is losing state

**Investigation needed**:
1. Check if resources are in the agent state or local component state
2. Verify resources aren't being cleared when report updates
3. Ensure useCoAgent hook preserves all state fields

**Fix**:
- Resources should be in agent state (not local state) - verify lines 92-95
- When setState is called, ensure resources are preserved
- Add defensive check to prevent resources from being undefined

```typescript
// In ResearchCanvas.tsx - when setting state
const updateReport = (newReport: string) => {
  setState({
    ...state,
    report: newReport,
    resources: state.resources || [] // Preserve resources
  });
};
```

**Test**: After fix, resources should remain visible while agent writes draft

---

## Issue 2: Chart Sizing Issues - Resize Script Not Running

### Problem
Tako charts are rendering but:
- Taking full width (correct)
- Not tall enough (incorrect)
- This indicates the resize postMessage script isn't working

### Root Cause Analysis

Tako iframes use a resize mechanism:
1. Iframe loads content
2. Content sends `postMessage` with type `"tako::resize"` and height value
3. Parent page listens for message and updates iframe height

**Why it's not working**:
- The `<script>` tag with the event listener might not be executing
- `rehype-raw` might be parsing the script but not executing it
- Script might be executing before iframes load
- Each iframe needs its own height, but script might be setting all to same height

### Solution Options

#### Option A: Move Script to Component (RECOMMENDED)

Instead of embedding script in markdown, add it to the MarkdownRenderer component as a React effect.

**File**: `src/components/MarkdownRenderer.tsx`

**Changes**:

```typescript
"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  useEffect(() => {
    // Listen for Tako chart resize messages
    const handleResize = (event: MessageEvent) => {
      const data = event.data;
      if (data.type !== "tako::resize") return;

      // Find the iframe that sent this message
      const iframes = document.querySelectorAll("iframe");
      for (let iframe of iframes) {
        if (iframe.contentWindow === event.source) {
          iframe.style.height = data.height + "px";
          console.log(`Resized iframe to ${data.height}px`);
          break;
        }
      }
    };

    window.addEventListener("message", handleResize);

    return () => {
      window.removeEventListener("message", handleResize);
    };
  }, [content]); // Re-run when content changes

  return (
    <div className="prose prose-slate max-w-none bg-background px-6 py-8 border-0 shadow-none rounded-xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // ... existing components ...
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          iframe: ({ node, ...props }) => (
            <iframe
              {...props}
              className="w-full border-0 mb-4"
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
```

#### Option B: Don't Include Script in Markdown

**File**: `agents/python/src/lib/chat.py` - Line 193 in post-processing

Currently returns:
```python
return "\n\n" + tako_charts_map[chart_title] + "\n\n"
```

This includes both `<iframe>` AND `<script>` tags.

**Change to**:
```python
# Extract just the iframe, not the script
iframe_html = tako_charts_map[chart_title]
# Remove script tags from iframe_html
import re
iframe_only = re.sub(r'<script.*?</script>', '', iframe_html, flags=re.DOTALL)
return "\n\n" + iframe_only + "\n\n"
```

Then rely on Option A's component-level listener.

**Why This Works**:
- React useEffect runs after DOM is ready
- Event listener is persistent for the component lifecycle
- Handles multiple iframes correctly
- Each iframe can send its own height
- More reliable than inline scripts

---

## Issue 3: Resizable Divider Between Chat and Canvas

### Problem
Need ability to adjust width of chat vs canvas panels with draggable divider.

### Solution
Add a draggable divider using React state and mouse events.

**File**: `src/components/ResearchCanvas.tsx` or create new wrapper component

### Implementation

#### Option A: Modify Main Layout (app/page.tsx or Main.tsx)

Currently the layout is likely:
```tsx
<div className="flex">
  <div className="flex-1">{/* Canvas */}</div>
  <div className="w-[500px]">{/* Chat */}</div>
</div>
```

**Replace with resizable layout**:

```tsx
"use client";

import { useState, useRef } from "react";

export function ResizableLayout() {
  const [canvasWidth, setCanvasWidth] = useState(60); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    // Constrain between 30% and 70%
    if (newWidth >= 30 && newWidth <= 70) {
      setCanvasWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div ref={containerRef} className="flex h-full" style={{ height: "calc(100vh - 60px)" }}>
      {/* Canvas */}
      <div style={{ width: `${canvasWidth}%` }} className="overflow-hidden">
        <ResearchCanvas />
      </div>

      {/* Draggable Divider */}
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 bg-gray-300 hover:bg-[#6766FC] cursor-col-resize transition-colors ${
          isDragging ? "bg-[#6766FC]" : ""
        }`}
      />

      {/* Chat */}
      <div style={{ width: `${100 - canvasWidth}%` }} className="overflow-hidden">
        <CopilotSidebar />
      </div>
    </div>
  );
}
```

#### Option B: Use a Library

Install `react-resizable-panels`:
```bash
npm install react-resizable-panels
```

**Usage**:
```tsx
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

<PanelGroup direction="horizontal">
  <Panel defaultSize={60} minSize={30}>
    <ResearchCanvas />
  </Panel>
  <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-[#6766FC] cursor-col-resize" />
  <Panel defaultSize={40} minSize={30}>
    <CopilotSidebar />
  </Panel>
</PanelGroup>
```

**Benefits of Library**:
- Handles all mouse logic
- Persists sizes to localStorage
- Better edge case handling
- Less code to maintain

### Visual Design

The divider should:
- Be 1-4px wide
- Gray by default (#d1d5db)
- Purple (#6766FC) on hover
- Purple while dragging
- Show `cursor: col-resize` cursor
- Have smooth transitions

---

## Implementation Order

### Phase 1: Fix Resources Disappearing (Critical)
1. Investigate state management in ResearchCanvas.tsx
2. Ensure resources persist in agent state
3. Add defensive checks
4. Test that resources stay visible during draft generation

### Phase 2: Fix Chart Sizing (Critical)
1. Add useEffect resize listener to MarkdownRenderer.tsx
2. Remove script tags from injected iframe HTML
3. Set min-height on iframes (400px as fallback)
4. Test charts resize properly
5. Add console logging to debug resize messages

### Phase 3: Add Resizable Divider (Enhancement)
1. Decide: custom implementation vs react-resizable-panels
2. Install library if using Option B
3. Modify layout in Main.tsx or page.tsx
4. Add divider styling
5. Test drag functionality
6. Test edge cases (min/max widths)

---

## Files to Modify

### Phase 1:
- `src/components/ResearchCanvas.tsx` - Fix state management

### Phase 2:
- `src/components/MarkdownRenderer.tsx` - Add resize listener
- `agents/python/src/lib/chat.py` - Remove script tags from injected HTML

### Phase 3:
- `src/app/page.tsx` or `src/app/Main.tsx` - Add resizable layout
- `package.json` - Add react-resizable-panels (if using library)

---

## Testing Checklist

### Phase 1:
- [ ] Start query
- [ ] Verify resources appear
- [ ] Wait for draft to start writing
- [ ] Verify resources remain visible
- [ ] Verify resource counts still show

### Phase 2:
- [ ] Generate report with Tako charts
- [ ] Switch to Preview mode
- [ ] Verify iframes render
- [ ] Open browser console
- [ ] Verify resize messages being received
- [ ] Verify iframe heights update
- [ ] Charts should be fully visible (not cut off)

### Phase 3:
- [ ] Hover over divider (shows purple + cursor change)
- [ ] Click and drag divider left
- [ ] Verify canvas shrinks, chat expands
- [ ] Drag divider right
- [ ] Verify canvas expands, chat shrinks
- [ ] Try to drag beyond min/max limits
- [ ] Verify constraints work
- [ ] Refresh page
- [ ] Verify width persists (if using localStorage)

---

## Success Criteria

✅ Resources remain visible throughout entire agent workflow
✅ Tako charts render with correct heights (not cut off)
✅ Resize event listener works reliably
✅ User can drag divider to adjust panel widths
✅ Divider has good visual feedback (hover, active states)
✅ Panel widths are constrained to reasonable limits
✅ Layout works on different screen sizes

---

## Recommended Approach

1. **Phase 1 first** - Resources disappearing is most disruptive to UX
2. **Phase 2 second** - Charts need proper sizing for usefulness
3. **Phase 3 last** - Resizable divider is enhancement, not critical

For Phase 3, I recommend using `react-resizable-panels` library because:
- Well-tested implementation
- Handles edge cases
- Less code to maintain
- Persistent state via localStorage
- Better accessibility
