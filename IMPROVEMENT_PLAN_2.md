# Tako Research Canvas - Improvements Plan 2

## Issues to Fix

1. **Resources UI** - Separate collapsible sections for charts vs web resources
2. **Iframe Rendering** - Agent outputting placeholder text instead of actual iframe HTML
3. **Chart Descriptions** - Ensure chart content/descriptions inform research draft

---

## Issue 1: Reorganize Resources UI with Collapsible Sections

### Problem
Currently all resources (charts + web) are displayed in a single flat list. This makes it hard to distinguish between resource types.

### Solution
Create separate collapsible sections for Tako Charts and Web Resources.

### Implementation

**File**: `src/components/ResearchCanvas.tsx`

**Changes**:
1. Add state for collapse toggles:
   ```typescript
   const [chartsExpanded, setChartsExpanded] = useState(true);
   const [webExpanded, setWebExpanded] = useState(true);
   ```

2. Split resources by type:
   ```typescript
   const takoCharts = resources.filter(r => r.resource_type === 'tako_chart');
   const webResources = resources.filter(r => r.resource_type === 'web');
   ```

3. Replace single Resources component with two collapsible sections:
   ```tsx
   {/* Tako Charts Section */}
   <div className="mb-4">
     <button
       onClick={() => setChartsExpanded(!chartsExpanded)}
       className="flex items-center gap-2 text-lg font-medium text-primary mb-3"
     >
       <ChevronDown className={chartsExpanded ? "" : "-rotate-90"} />
       Tako Charts ({takoCharts.length})
     </button>
     {chartsExpanded && takoCharts.length > 0 && (
       <Resources
         resources={takoCharts}
         handleCardClick={handleCardClick}
         removeResource={removeResource}
       />
     )}
   </div>

   {/* Web Resources Section */}
   <div>
     <button
       onClick={() => setWebExpanded(!webExpanded)}
       className="flex items-center gap-2 text-lg font-medium text-primary mb-3"
     >
       <ChevronDown className={webExpanded ? "" : "-rotate-90"} />
       Web Resources ({webResources.length})
     </button>
     {webExpanded && webResources.length > 0 && (
       <Resources
         resources={webResources}
         handleCardClick={handleCardClick}
         removeResource={removeResource}
       />
     )}
   </div>
   ```

4. Import ChevronDown icon from lucide-react

---

## Issue 2: Fix Iframe Rendering (Agent Outputting Placeholder)

### Problem
Agent is literally outputting `{resource['iframe_html']}` instead of the actual iframe HTML.

### Root Cause Analysis
The system prompt shows an EXAMPLE of how to embed iframes, but the agent is:
1. Not understanding it needs to access actual resources
2. Not iterating through available Tako chart resources
3. Copying the example text literally instead of substituting real values

### Solution
Improve system prompt to be more explicit and provide actual resource data in a clearer format.

**File**: `agents/python/src/lib/chat.py`

**Changes**:

1. **Extract Tako chart resources explicitly** (lines 69-79):
   ```python
   # Get Tako charts with iframe HTML
   tako_charts = []
   for resource in resources:
       if resource.get('resource_type') == 'tako_chart' and resource.get('iframe_html'):
           tako_charts.append({
               'title': resource.get('title', ''),
               'description': resource.get('description', ''),
               'url': resource.get('url', ''),
               'iframe_html': resource.get('iframe_html', '')
           })
   ```

2. **Update system prompt** to be more explicit (lines 98-147):

   Replace the current "CRITICAL - EMBEDDING TAKO CHARTS" section with:

   ```python
   CRITICAL - EMBEDDING TAKO CHARTS IN REPORT:
   You have access to Tako chart visualizations that MUST be embedded in your report.

   TAKO CHARTS AVAILABLE FOR THIS REPORT:
   {tako_charts}

   HOW TO EMBED TAKO CHARTS:
   1. When writing your report, identify relevant sections that would benefit from data visualization
   2. For each relevant Tako chart, copy its ENTIRE iframe_html value (including <iframe> tag and <script>)
   3. Paste the iframe_html directly into your markdown report at the appropriate location
   4. Add explanatory text before/after the chart

   EXAMPLE - If you have a chart about "China GDP Growth":

   ## Economic Analysis

   China's economy has shown significant growth over the past two decades...

   [PASTE THE FULL iframe_html HERE - the actual HTML from the Tako chart resource]

   As the visualization above demonstrates, GDP growth has been substantial...

   IMPORTANT RULES:
   - DO NOT write {{resource['iframe_html']}} - that's just a placeholder
   - DO NOT write descriptions of charts - embed the actual HTML
   - COPY the full iframe_html string from the Tako chart resources listed above
   - Each iframe_html contains both the <iframe> tag AND a <script> tag - include both
   - Embed 2-3 charts if available to make the report engaging and data-driven
   - Position charts where they support your narrative
   ```

3. **Pass tako_charts to system message** (update line 146):
   ```python
   Here are the Tako charts with iframe HTML available for embedding:
   {tako_charts}

   Here are all the resources (for reference and citation):
   {resources}
   ```

### Why This Works
- Explicitly lists available Tako charts with their iframe_html at the top
- Shows the iframe_html is a string to be copied, not a variable reference
- Clarifies that `{resource['iframe_html']}` was just a placeholder example
- Provides the actual data needed to embed charts

---

## Issue 3: Ensure Chart Descriptions Inform Research Draft

### Problem
Need to verify chart descriptions/content are being used when writing the report.

### Current Status
Looking at `chat.py` lines 69-79, the code does extract chart content:
```python
for resource in state["resources"]:
    content = get_resource(resource["url"])
    if content == "ERROR":
        continue
    resources.append({**resource, "content": content})
```

However, for Tako charts, `get_resource()` might not be appropriate since they're not web pages.

### Solution
Ensure Tako chart descriptions are included in the resources passed to the agent.

**File**: `agents/python/src/lib/chat.py`

**Changes**:

1. **Skip get_resource for Tako charts** (lines 73-79):
   ```python
   resources = []
   for resource in state["resources"]:
       # Tako charts already have descriptions, don't fetch content
       if resource.get("resource_type") == "tako_chart":
           resources.append({
               **resource,
               "content": resource.get("description", "")
           })
       else:
           # Web resources: fetch content
           content = get_resource(resource["url"])
           if content == "ERROR":
               continue
           resources.append({**resource, "content": content})
   ```

2. **Update system prompt** to emphasize using chart content (line 136-137):
   ```python
   You should use the search tool to get resources before answering the user's question.
   Use the content and descriptions from both Tako charts and web resources to inform your report.
   If you finished writing the report, ask the user proactively for next steps, changes etc, make it engaging.
   ```

---

## Implementation Order

1. **Fix Issue 2 first** (iframe rendering) - This is critical for functionality
   - Update chat.py to extract Tako charts explicitly
   - Improve system prompt with actual chart data
   - Test to ensure iframes actually render in reports

2. **Fix Issue 3** (chart descriptions) - Ensure data quality
   - Skip get_resource for Tako charts
   - Use chart descriptions as content
   - Test that chart insights appear in reports

3. **Fix Issue 1 last** (UI improvements) - Polish
   - Add collapsible sections to ResearchCanvas.tsx
   - Test expand/collapse functionality
   - Verify visual organization is clear

---

## Testing Plan

After each fix:

1. **Test Iframe Rendering**:
   - Query: "Compare Intel vs Nvidia performance"
   - Verify: Report contains actual `<iframe>` HTML (not placeholder text)
   - Verify: Preview mode renders interactive charts

2. **Test Chart Descriptions**:
   - Query: Same as above
   - Verify: Report text references insights from chart descriptions
   - Verify: Report isn't just generic text

3. **Test Collapsible Sections**:
   - Verify: Charts and web resources in separate sections
   - Verify: Click chevron to collapse/expand each section
   - Verify: Counts show correct numbers
   - Verify: Empty sections show appropriate message

---

## Files to Modify

1. `agents/python/src/lib/chat.py` - Fix iframe embedding and chart content (Issues 2 & 3)
2. `src/components/ResearchCanvas.tsx` - Add collapsible sections (Issue 1)

---

## Success Criteria

✅ Agent embeds actual Tako iframe HTML in reports (not placeholder text)
✅ Preview mode shows interactive Tako charts
✅ Report text incorporates insights from chart descriptions
✅ Resources section has separate collapsible sections for charts vs web
✅ Chevron icons rotate when toggling sections
✅ Section headers show accurate counts
