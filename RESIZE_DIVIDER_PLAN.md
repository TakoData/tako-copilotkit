# Plan: Adding Resizable Divider

## Current State (Working)
- Fixed 30/70 split layout
- Chat on left (30%), Canvas on right (70%)
- No scrolling issues, viewport-constrained
- Structure:
  ```tsx
  <div height: 100vh, overflow: hidden>
    <h1 60px header />
    <div flex: 1>
      <div 30% with CopilotChat />
      <div 70% with ResearchCanvas />
    </div>
  </div>
  ```

## What We Learned from Failed Attempts

### Problem Symptoms
1. **Separator always showed wrong aria values**:
   - `aria-valuemin="3.553"` and `aria-valuemax="3.553"` (same value = can't resize)
   - Should show `aria-valuemin="30"` and `aria-valuemax="70"`

2. **Separator orientation mismatch**:
   - Group had `aria-orientation="horizontal"` (correct)
   - Separator had `aria-orientation="vertical"` (wrong)

3. **No console logs** when dragging (onLayoutChange never fired)

4. **Panels had identical flex values**: Both showed `flex: 3.553` instead of different values for 40/60 split

### What Worked
- **Minimal test page** (`/minimal-test`) with simple colored divs worked perfectly
- Same library version, same browser, same structure

### Key Difference
The minimal test had:
- Simple static content (just divs with text)
- No complex React components
- No context providers
- No hooks doing async operations

Our main page has:
- `CopilotChat` component (complex internal state/layout)
- `ResearchCanvas` component (complex internal state/layout)
- `useCoAgent` hook (async state management)
- `useModelSelectorContext` (context provider)

## Hypothesis: Why It Failed

**Theory 1: Measurement Timing**
- `react-resizable-panels` measures container dimensions on mount
- CopilotKit components might be doing layout calculations that haven't completed
- By the time Group measures, the container reports incorrect dimensions

**Theory 2: CSS Conflicts**
- CopilotKit applies custom CSS variables and classes
- These might interfere with flex layout calculations
- The library might not handle nested flex layouts well

**Theory 3: Children Constraining Parent**
- Panel children with `height: 100%` might create circular dependency
- CopilotChat might have internal height calculations that conflict
- ResearchCanvas has scrolling content that might affect measurement

## Proposed Solution Path

### Phase 1: Isolate the Problem (Diagnostic)
**Goal**: Determine exactly what's breaking the measurement

1. **Test 1: Add panels with dummy content**
   ```tsx
   <Group>
     <Panel 40%><div style={{height: "100%", background: "blue"}}>Chat Here</div></Panel>
     <Separator />
     <Panel 60%><div style={{height: "100%", background: "red"}}>Canvas Here</div></Panel>
   </Group>
   ```
   **Expected**: Should work perfectly (like minimal test)
   **If fails**: Something wrong with page-level layout
   **If succeeds**: Problem is with CopilotKit/ResearchCanvas components

2. **Test 2: Add CopilotChat only (without ResearchCanvas)**
   ```tsx
   <Group>
     <Panel 40%>
       <div style={{height: "100%"}}><CopilotChat /></div>
     </Panel>
     <Separator />
     <Panel 60%>
       <div style={{height: "100%", background: "red"}}>Dummy</div>
     </Panel>
   </Group>
   ```
   **Expected**: Will tell us if CopilotChat is the issue
   **Check**: aria values on Separator

3. **Test 3: Add ResearchCanvas only (without CopilotChat)**
   ```tsx
   <Group>
     <Panel 40%>
       <div style={{height: "100%", background: "blue"}}>Dummy</div>
     </Panel>
     <Separator />
     <Panel 60%>
       <div style={{height: "100%"}}><ResearchCanvas /></div>
     </Panel>
   </Group>
   ```
   **Expected**: Will tell us if ResearchCanvas is the issue

### Phase 2: Fix Based on Findings

#### Scenario A: Test 1 Fails (Page Layout Issue)
**Problem**: The page-level layout is preventing Group from measuring
**Solution**:
1. Try wrapping Group in a div with explicit pixel dimensions:
   ```tsx
   <div style={{ width: "100vw", height: "calc(100vh - 60px)" }}>
     <Group>...</Group>
   </div>
   ```
2. Use `window.innerHeight` instead of CSS calc
3. Add a resize observer to remeasure when window resizes

#### Scenario B: Test 2 Fails (CopilotChat Issue)
**Problem**: CopilotChat's internal layout interferes
**Solutions to try**:
1. **Isolation wrapper**:
   ```tsx
   <Panel>
     <div style={{
       position: "relative",
       width: "100%",
       height: "100%",
       isolation: "isolate"
     }}>
       <CopilotChat />
     </div>
   </Panel>
   ```

2. **Force height propagation**:
   ```tsx
   <Panel>
     <div style={{
       display: "flex",
       flexDirection: "column",
       height: "100%",
       minHeight: 0
     }}>
       <CopilotChat className="flex-1" />
     </div>
   </Panel>
   ```

3. **Delayed CopilotChat render**:
   ```tsx
   const [chatReady, setChatReady] = useState(false);
   useEffect(() => {
     setTimeout(() => setChatReady(true), 200);
   }, []);

   <Panel>
     {chatReady ? <CopilotChat /> : <div>Loading...</div>}
   </Panel>
   ```

#### Scenario C: Test 3 Fails (ResearchCanvas Issue)
**Problem**: ResearchCanvas's scrolling interferes
**Solution**:
1. Ensure ResearchCanvas is wrapped properly:
   ```tsx
   <Panel>
     <div style={{
       height: "100%",
       overflow: "auto",
       display: "flex",
       flexDirection: "column"
     }}>
       <ResearchCanvas />
     </div>
   </Panel>
   ```

2. Check if ResearchCanvas has any `position: absolute` or `position: fixed` that breaks out of flow

#### Scenario D: Tests 2 & 3 Succeed (Component Interaction)
**Problem**: Both components together create conflict
**Solution**:
1. **Render Group after both components mount**:
   ```tsx
   const [copilotReady, setCopilotReady] = useState(false);
   const [canvasReady, setCanvasReady] = useState(false);
   const bothReady = copilotReady && canvasReady;

   useEffect(() => {
     const timer1 = setTimeout(() => setCopilotReady(true), 100);
     const timer2 = setTimeout(() => setCanvasReady(true), 150);
     return () => { clearTimeout(timer1); clearTimeout(timer2); };
   }, []);

   {bothReady ? <Group>...</Group> : <FallbackLayout />}
   ```

2. **Use ResizeObserver to force remeasurement**:
   ```tsx
   useEffect(() => {
     const observer = new ResizeObserver(() => {
       // Force Group to recalculate
       window.dispatchEvent(new Event('resize'));
     });
     observer.observe(containerRef.current);
     return () => observer.disconnect();
   }, []);
   ```

### Phase 3: Production Implementation

Once we identify the fix:

1. **Clean implementation**:
   - Remove all diagnostic console.logs
   - Clean up any hacky workarounds
   - Add proper TypeScript types

2. **Polish**:
   - Add smooth transitions for resize
   - Style the separator nicely (hover effects, etc.)
   - Test keyboard accessibility (Tab to separator, arrow keys to resize)

3. **Edge cases**:
   - Test on different screen sizes
   - Test with browser zoom
   - Test rapid resizing
   - Test with dev tools open

## Evaluation Checklist

For each test, check:
- [ ] Separator `aria-valuemin` shows correct value (30 or similar)
- [ ] Separator `aria-valuemax` shows correct value (70 or similar)
- [ ] Separator `aria-orientation` shows "horizontal" (NOT "vertical")
- [ ] Panels have different flex values (not both 3.553)
- [ ] Console logs appear when dragging
- [ ] Visual resize actually happens
- [ ] No layout shift or flickering
- [ ] No whitespace/scrolling issues

## Success Criteria

✅ Divider can be dragged left/right
✅ Panels resize smoothly
✅ Console logs show layout changes
✅ aria attributes show correct min/max values
✅ No performance issues
✅ Works on page refresh
✅ Works after component updates
✅ No visual glitches

## Rollback Plan

If after Phase 1 & 2 we still can't fix it:
1. Keep the current fixed 30/70 layout
2. Document the issue for future investigation
3. Consider alternative libraries (react-split, allotment, etc.)
4. Or implement custom resize with pointer events

## Next Steps

1. Run Phase 1 diagnostic tests systematically
2. Document findings for each test
3. Apply appropriate fix from Phase 2
4. Verify with evaluation checklist
5. Polish if successful, rollback if not
