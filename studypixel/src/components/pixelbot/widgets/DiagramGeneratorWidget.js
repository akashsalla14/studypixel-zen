import React, { useState, useEffect, useRef } from "react";
import { normalizeBaseData, buildTelemetry } from "./widgetNormalizer";

/**
 * DiagramGeneratorWidget
 * Renders dynamic SVG diagrams from structured JSON data.
 * Supports: triangle, rectangle, flowchart
 * Upgraded to v2 architecture: Added telemetry and modern UI.
 */
export const DiagramGeneratorWidget = ({ data, onSubmit }) => {
  const baseData = normalizeBaseData(data, ["Visualization", "Architecture"]);
  const {
    width: defaultWidth = 960,
    height: defaultHeight = 520,
    labels = [],
    layout,
    sections = [],
  } = data;
  const height = defaultHeight;

  const DIAGRAM_THEMES = {
    learning: {
      name: "Learning",
      canvas: "#08111f",
      text: "#e5f3ff",
      muted: "#9db4d0",
      edge: "#38bdf8",
      accents: ["#38bdf8", "#22c55e", "#facc15", "#fb7185", "#a78bfa"],
    },
    science: {
      name: "Science",
      canvas: "#07191a",
      text: "#e6fffb",
      muted: "#9ad3d0",
      edge: "#2dd4bf",
      accents: ["#2dd4bf", "#84cc16", "#06b6d4", "#c084fc", "#f59e0b"],
    },
    warning: {
      name: "Warning",
      canvas: "#1f1110",
      text: "#fff4e6",
      muted: "#f2b8a2",
      edge: "#fb923c",
      accents: ["#ef4444", "#f97316", "#facc15", "#fb7185", "#a855f7"],
    },
    history: {
      name: "History",
      canvas: "#15140c",
      text: "#fff7d6",
      muted: "#d8c690",
      edge: "#d4a72c",
      accents: ["#d4a72c", "#14b8a6", "#e879f9", "#60a5fa", "#f97316"],
    },
    cyber: {
      name: "Cyber",
      canvas: "#06120d",
      text: "#e8fff2",
      muted: "#8de6b0",
      edge: "#4ade80",
      accents: ["#4ade80", "#22d3ee", "#f43f5e", "#a78bfa", "#facc15"],
    },
    neutral: {
      name: "Neutral",
      canvas: "#10151f",
      text: "#e2e8f0",
      muted: "#94a3b8",
      edge: "#60a5fa",
      accents: ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa"],
    },
  };

  const normalizeThemeName = (themeName) => {
    const key = String(themeName || "learning").toLowerCase();
    return DIAGRAM_THEMES[key] ? key : "learning";
  };

  const [selectedTheme, setSelectedTheme] = useState(() => normalizeThemeName(data?.theme));
  const theme = DIAGRAM_THEMES[selectedTheme] || DIAGRAM_THEMES.learning;

  // Normalize common LLM synonyms to a single labels array so generated
  // payloads using `layers`, `steps`, or `items` render correctly.
  const normalizedLabels = (
    (Array.isArray(data?.labels) && data.labels.length > 0 && data.labels) ||
    (Array.isArray(data?.layers) && data.layers.length > 0 && data.layers) ||
    (Array.isArray(data?.steps) && data.steps.length > 0 && data.steps) ||
    (Array.isArray(data?.items) && data.items.length > 0 && data.items) ||
    (Array.isArray(labels) && labels.length > 0 && labels) ||
    []
  );

  const [submitted, setSubmitted] = useState(baseData.isHistorical);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [hasPanned, setHasPanned] = useState(false);
  const [hasZoomed, setHasZoomed] = useState(false);
  const [exportCount, setExportCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState(() => String(layout || "auto").toLowerCase());
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState("");
  const [startTime] = useState(() => (typeof performance !== "undefined" ? performance.now() : 0));
  
  // Responsive Render Optimization
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const dragStateRef = useRef({ active: false, x: 0, y: 0 });
  const [containerWidth, setContainerWidth] = useState(defaultWidth || 960);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0) setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 1. Semantic Schema Recovery & Inference
  let resolvedType = data.type;
  if (!resolvedType) {
    if (normalizedLabels.length === 3 || baseData.tags?.some(t => t.toLowerCase().includes('triad'))) {
      resolvedType = 'triangle';
    } else if (data.nodes || data.edges || normalizedLabels.length > 0) {
      resolvedType = 'flowchart';
    } else {
      resolvedType = 'semantic-fallback'; // Adaptive AI pedagogical fallback
    }
  }

  // 2. Semantic to Visual Primitive Mapping
  const semanticToRenderMap = {
    'triad': 'triangle',
    'lifecycle': 'flowchart',
    'sequence': 'flowchart',
    'attack-chain': 'flowchart',
    'tree-map': 'tree',
    'conceptual-map': 'concept-map',
    'mindmap': 'mind-map',
    'memory-map': 'mind-map',
    'process-loop': 'cycle',
    'loop': 'cycle',
    'system-architecture': 'flowchart',
    'comparison-table': 'matrix',
    'before-after': 'comparison',
    'pros-cons': 'comparison',
    'compare': 'comparison',
    'semantic-fallback': 'semantic-fallback'
  };
  const renderType = semanticToRenderMap[resolvedType.toLowerCase()] || resolvedType.toLowerCase();

  const wrapTextLines = (value, maxChars = 18) => {
    const text = String(value || "").trim();
    if (!text) return [""];
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxChars) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
    if (lines.length > 3) {
      let lastLine = lines[2];
      if (lastLine.length > maxChars - 3) lastLine = lastLine.substring(0, maxChars - 3);
      lines[2] = lastLine + "...";
    }
    return lines.slice(0, 3);
  };

  const normalizeNodeType = (type) => {
    const t = String(type || "process").toLowerCase();
    if (t.includes("decision") || t.includes("diamond")) return "decision";
    if (t.includes("terminal") || t.includes("start") || t.includes("end")) return "terminal";
    if (t.includes("data") || t.includes("io") || t.includes("input") || t.includes("output")) return "data";
    if (t.includes("warning") || t.includes("risk") || t.includes("alert")) return "warning";
    return "process";
  };

  const normalizeGraph = React.useMemo(() => {
    const rawNodes = Array.isArray(data?.nodes) ? data.nodes : [];
    const fallbackNodes = normalizedLabels.map((label, i) => ({
      id: `auto-${i}`,
      text: String(label),
      type: i === 0 && (renderType === "tree" || renderType === "flowchart") ? "terminal" : "process",
    }));

    // 1. HARD CAP: Prevent AI Hallucinations from crashing the layout engine
    let nodesSource = rawNodes.length > 0 ? rawNodes : fallbackNodes;
    const MAX_NODES = 25;
    const isTruncated = nodesSource.length > MAX_NODES;
    if (isTruncated) {
      nodesSource = nodesSource.slice(0, MAX_NODES);
    }

    const nodes = nodesSource
      .filter((n) => n != null)
      .map((n, i) => {
        const id = String(n.id ?? `node-${i}`);
        return {
          id,
          text: String(n.text ?? n.label ?? id),
          type: normalizeNodeType(n.type),
          group: n.group ? String(n.group) : null,
          x: typeof n.x === "number" ? n.x : null,
          y: typeof n.y === "number" ? n.y : null,
        };
      });

    // 2. WARNING INJECTION: Let the user know the diagram was too large
    if (isTruncated) {
      nodes.push({
        id: "node-truncated-warning",
        text: "⚠️ Diagram truncated (Max items exceeded)",
        type: "warning",
        group: "security",
        x: null,
        y: null,
      });
    }

    const nodeIdSet = new Set(nodes.map((n) => n.id));
    const rawEdges = Array.isArray(data?.edges) ? data.edges : [];
    const edges = rawEdges
      .map((e, i) => {
        const from = String(Array.isArray(e) ? e[0] : e?.from ?? "");
        const to = String(Array.isArray(e) ? e[1] : e?.to ?? "");
        if (!from || !to || !nodeIdSet.has(from) || !nodeIdSet.has(to)) return null;
        return {
          id: String(e?.id ?? `edge-${i}`),
          from,
          to,
          label: e?.label ? String(e.label) : "",
          type: String(e?.type || "directed").toLowerCase(),
        };
      })
      .filter(Boolean);

    const generatedEdges = edges.length > 0
      ? edges
      : nodes.slice(0, -1).map((n, i) => ({
          id: `edge-auto-${i}`,
          from: n.id,
          to: nodes[i + 1].id,
          label: "",
          type: "directed",
        }));

    return { nodes, edges: generatedEdges };
  }, [data?.nodes, data?.edges, normalizedLabels, renderType]);

  const nodeWidth = compactMode ? 138 : 164;
  const nodeHeight = compactMode ? 54 : 64;
  const horizontalGap = compactMode ? 46 : 72;
  const verticalGap = compactMode ? 46 : 70;

  const effectiveLayout = React.useMemo(() => {
    const raw = String(selectedLayout || "auto").toLowerCase();
    if (raw !== "auto") return raw;
    if (renderType === "tree" || containerWidth < 720) return "vertical";
    if (renderType === "concept-map" || renderType === "mind-map" || renderType === "radial") return "radial";
    return "horizontal";
  }, [selectedLayout, renderType, containerWidth]);

  const graphLayout = React.useMemo(() => {
    const nodes = normalizeGraph.nodes;
    const edges = normalizeGraph.edges;
    if (nodes.length === 0) {
      return { nodes: [], edges: [], chartWidth: defaultWidth, chartHeight: defaultHeight };
    }

    const manualNodes = nodes.every((n) => n.x !== null && n.y !== null);
    if (effectiveLayout === "manual" && manualNodes) {
      const chartWidth = Math.max(defaultWidth, ...nodes.map((n) => n.x + nodeWidth + 30));
      const chartHeight = Math.max(defaultHeight, ...nodes.map((n) => n.y + nodeHeight + 40));
      return { nodes, edges, chartWidth, chartHeight };
    }

    if (effectiveLayout === "radial") {
      const chartWidth = Math.max(defaultWidth, 760);
      const chartHeight = Math.max(defaultHeight, 560);
      const cx = chartWidth / 2 - nodeWidth / 2;
      const cy = chartHeight / 2 - nodeHeight / 2;
      const radius = Math.min(chartWidth, chartHeight) * 0.34;
      const placed = nodes.map((node, index) => {
        if (index === 0) return { ...node, x: cx, y: cy, type: node.type === "process" ? "terminal" : node.type };
        const angle = ((index - 1) / Math.max(1, nodes.length - 1)) * Math.PI * 2 - Math.PI / 2;
        return {
          ...node,
          x: chartWidth / 2 + Math.cos(angle) * radius - nodeWidth / 2,
          y: chartHeight / 2 + Math.sin(angle) * radius - nodeHeight / 2,
        };
      });
      const radialEdges = edges.length > 0
        ? edges
        : placed.slice(1).map((n, i) => ({
            id: `edge-radial-${i}`,
            from: placed[0].id,
            to: n.id,
            label: "",
            type: "directed",
          }));
      return { nodes: placed, edges: radialEdges, chartWidth, chartHeight };
    }

    const indegree = new Map(nodes.map((n) => [n.id, 0]));
    const outgoing = new Map(nodes.map((n) => [n.id, []]));
    edges.forEach((e) => {
      indegree.set(e.to, (indegree.get(e.to) || 0) + 1);
      outgoing.get(e.from)?.push(e.to);
    });

    const roots = nodes.filter((n) => (indegree.get(n.id) || 0) === 0).map((n) => n.id);
    const queue = [...roots];
    const level = new Map(nodes.map((n) => [n.id, 0]));
    const visited = new Set();

    // Cycle prevention: If no root is found (pure cycle), pick the first node to break the loop
    if (queue.length === 0 && nodes.length > 0) queue.push(nodes[0].id);

    while (queue.length > 0) {
      const current = queue.shift();
      visited.add(current);
      const currentLevel = level.get(current) || 0;
      const children = outgoing.get(current) || [];
      
      children.forEach((child) => {
        if (!visited.has(child)) {
          level.set(child, Math.max(level.get(child) || 0, currentLevel + 1));
          indegree.set(child, (indegree.get(child) || 1) - 1);
          if ((indegree.get(child) || 0) <= 0 && !queue.includes(child)) queue.push(child);
        }
      });

      // Disconnected graph / multi-cycle recovery: find unvisited nodes
      if (queue.length === 0 && visited.size < nodes.length) {
        const unvisited = nodes.find(n => !visited.has(n.id));
        if (unvisited) queue.push(unvisited.id);
      }
    }

    const groups = new Map();
    nodes.forEach((n) => {
      const l = level.get(n.id) || 0;
      if (!groups.has(l)) groups.set(l, []);
      groups.get(l).push(n);
    });

    const levels = [...groups.keys()].sort((a, b) => a - b);
    const maxNodesInLevel = Math.max(...levels.map((l) => groups.get(l).length));
    const isVertical = effectiveLayout === "vertical";

    const chartWidth = isVertical
      ? Math.max(defaultWidth, maxNodesInLevel * (nodeWidth + horizontalGap) + 80)
      : Math.max(defaultWidth, levels.length * (nodeWidth + horizontalGap) + 80);
    const chartHeight = isVertical
      ? Math.max(defaultHeight, levels.length * (nodeHeight + verticalGap) + 80)
      : Math.max(defaultHeight, maxNodesInLevel * (nodeHeight + verticalGap) + 80);

    const placed = [];
    levels.forEach((l, levelIndex) => {
      const members = groups.get(l);
      members.forEach((node, i) => {
        if (isVertical) {
          const rowWidth = members.length * (nodeWidth + horizontalGap) - horizontalGap;
          const startX = (chartWidth - rowWidth) / 2;
          placed.push({
            ...node,
            x: startX + i * (nodeWidth + horizontalGap),
            y: 40 + levelIndex * (nodeHeight + verticalGap),
          });
        } else {
          const colHeight = members.length * (nodeHeight + verticalGap) - verticalGap;
          const startY = (chartHeight - colHeight) / 2;
          placed.push({
            ...node,
            x: 40 + levelIndex * (nodeWidth + horizontalGap),
            y: startY + i * (nodeHeight + verticalGap),
          });
        }
      });
    });

    return { nodes: placed, edges, chartWidth, chartHeight };
  }, [normalizeGraph, effectiveLayout, nodeWidth, nodeHeight, horizontalGap, verticalGap, defaultWidth, defaultHeight]);

  const inputNodeCount = normalizeGraph.nodes.length;
  const inputEdgeCount = normalizeGraph.edges.length;
  const requestedLayout = effectiveLayout;

  const handleAcknowledge = (event) => {
    if (submitted || baseData.isHistorical) return;
    setSubmitted(true);
    
    if (onSubmit) {
      onSubmit({
        action: "acknowledged",
        telemetry: buildTelemetry({
          widgetId: "diagram-generator-v1",
          version: "v2",
          isCorrect: true, // Non-evaluative
          usedHint: false,
          executionMode: baseData.executionMode,
          answerData: {
            diagramType: renderType,
            semanticIntent: resolvedType,
            layoutMode: requestedLayout,
            inputNodeCount,
            inputEdgeCount,
            usedAdvancedSchema: Array.isArray(data?.nodes) || Array.isArray(data?.edges),
            hasPanned,
            hasZoomed,
            exportCount,
            viewDurationMs: Math.max(0, Math.round((event?.timeStamp || startTime) - startTime))
          }
        })
      });
    }
  };

  const handleNodeClick = (nodeText) => {
    if (onSubmit && !baseData.isHistorical) {
      onSubmit({
        action: "ask_about_node",
        message: `Can you explain the "${nodeText}" part of this diagram in more detail?`
      });
    }
  };

  // 3. Fallback Layout Extraction
  // If the AI failed to provide explicit arrays but sent a text description, extract generic blocks.
  const normalizedSections = Array.isArray(sections)
    ? sections.map((section) => section?.title || section?.label || section?.name || section?.text || section).filter(Boolean)
    : [];

  const conceptualBlocks = normalizedLabels.length > 0 ? normalizedLabels :
                           (normalizedSections.length > 0 ? normalizedSections :
                           (baseData.tags?.length > 0 ? baseData.tags : 
                           ['Concept Analysis', 'Pattern Recognition']));

  const hasValidGeometry = graphLayout.nodes.length > 0;

  const zoomBy = (factor) => {
    setZoomScale((prev) => {
      const next = Math.min(2.25, Math.max(0.55, prev * factor));
      if (next !== prev) setHasZoomed(true);
      return next;
    });
  };

  const resetView = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const onWheelZoom = (event) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.08 : 0.92);
  };

  const onPanStart = (event) => {
    dragStateRef.current = {
      active: true,
      x: event.clientX - panOffset.x,
      y: event.clientY - panOffset.y,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const onMove = (event) => {
      if (!dragStateRef.current.active) return;
      setPanOffset({
        x: event.clientX - dragStateRef.current.x,
        y: event.clientY - dragStateRef.current.y,
      });
      setHasPanned(true);
    };

    const onUp = () => {
      dragStateRef.current.active = false;
      setIsDragging(false);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const exportAsSvg = () => {
    const svgNode = svgRef.current;
    if (!svgNode) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgNode);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const baseName = String(baseData.prompt || data?.title || "diagram").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
    link.href = url;
    link.download = `${baseName || "diagram"}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    setExportCount((prev) => prev + 1);
  };

  const exportAsPng = () => {
    const svgNode = svgRef.current;
    if (!svgNode) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgNode);
    const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    const image = new Image();

    image.onload = () => {
      const viewBox = svgNode.viewBox?.baseVal;
      const baseWidth = Math.max(1, Math.round(viewBox?.width || svgNode.clientWidth || defaultWidth));
      const baseHeight = Math.max(1, Math.round(viewBox?.height || svgNode.clientHeight || defaultHeight));
      const pixelRatio = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(baseWidth * pixelRatio);
      canvas.height = Math.round(baseHeight * pixelRatio);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.fillStyle = "#0F0F1A";
      ctx.fillRect(0, 0, baseWidth, baseHeight);
      ctx.drawImage(image, 0, 0, baseWidth, baseHeight);

      const link = document.createElement("a");
      const baseName = String(baseData.prompt || data?.title || "diagram")
        .replace(/[^a-z0-9-_]+/gi, "-")
        .toLowerCase();
      link.href = canvas.toDataURL("image/png");
      link.download = `${baseName || "diagram"}.png`;
      link.click();
      setExportCount((prev) => prev + 1);
    };

    image.src = encoded;
  };

  const copySvgToClipboard = async () => {
    const svgNode = svgRef.current;
    if (!svgNode || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    const serializer = new XMLSerializer();
    await navigator.clipboard.writeText(serializer.serializeToString(svgNode));
    setCopiedFormat("SVG");
    window.setTimeout(() => setCopiedFormat(""), 1400);
    setExportCount((prev) => prev + 1);
  };

  const copyPngToClipboard = async () => {
    const svgNode = svgRef.current;
    if (
      !svgNode ||
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !window.ClipboardItem ||
      !navigator.clipboard?.write
    ) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgNode);
    const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    const image = new Image();
    image.onload = async () => {
      const viewBox = svgNode.viewBox?.baseVal;
      const baseWidth = Math.max(1, Math.round(viewBox?.width || svgNode.clientWidth || defaultWidth));
      const baseHeight = Math.max(1, Math.round(viewBox?.height || svgNode.clientHeight || defaultHeight));
      const canvas = document.createElement("canvas");
      canvas.width = baseWidth;
      canvas.height = baseHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = theme.canvas;
      ctx.fillRect(0, 0, baseWidth, baseHeight);
      ctx.drawImage(image, 0, 0, baseWidth, baseHeight);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
        setCopiedFormat("PNG");
        window.setTimeout(() => setCopiedFormat(""), 1400);
        setExportCount((prev) => prev + 1);
      }, "image/png");
    };
    image.src = encoded;
  };

  const getAccent = (index = 0) => theme.accents[index % theme.accents.length];

  const getNodeStyle = (node, index = 0) => {
    const typeOffset = {
      terminal: 0,
      process: 1,
      decision: 2,
      data: 3,
      warning: 4,
    };
    let colorIndex = typeOffset[node.type] ?? index;
    if (node.group) {
      colorIndex = String(node.group).split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    }
    const stroke = getAccent(colorIndex + index);
    return {
      stroke,
      fill: `${stroke}22`,
      text: theme.text,
      glow: `${stroke}55`,
    };
  };

  const renderNodeShape = (node, index = 0) => {
    const x = node.x;
    const y = node.y;
    const nodeStyle = getNodeStyle(node, index);
    const stroke = nodeStyle.stroke;
    const fill = nodeStyle.fill;

    if (node.type === "decision") {
      const cx = x + nodeWidth / 2;
      const cy = y + nodeHeight / 2;
      return <polygon className="node-shape" points={`${cx},${y} ${x + nodeWidth},${cy} ${cx},${y + nodeHeight} ${x},${cy}`} fill={fill} stroke={stroke} strokeWidth="2" />;
    }
    if (node.type === "terminal") {
      return <rect className="node-shape" x={x} y={y} width={nodeWidth} height={nodeHeight} rx="24" fill={fill} stroke={stroke} strokeWidth="2" />;
    }
    if (node.type === "data") {
      return <polygon className="node-shape" points={`${x + 12},${y} ${x + nodeWidth},${y} ${x + nodeWidth - 12},${y + nodeHeight} ${x},${y + nodeHeight}`} fill={fill} stroke={stroke} strokeWidth="2" />;
    }
    if (node.type === "warning") {
      return <polygon className="node-shape" points={`${x + nodeWidth / 2},${y} ${x + nodeWidth},${y + nodeHeight * 0.3} ${x + nodeWidth * 0.8},${y + nodeHeight} ${x + nodeWidth * 0.2},${y + nodeHeight} ${x},${y + nodeHeight * 0.3}`} fill={fill} stroke={stroke} strokeWidth="2" />;
    }
    return <rect className="node-shape" x={x} y={y} width={nodeWidth} height={nodeHeight} rx="10" fill={fill} stroke={stroke} strokeWidth="2" />;
  };

  const renderNodeText = (node, index = 0) => {
    const lines = wrapTextLines(node.text, compactMode ? 17 : 20);
    const baseX = node.x + nodeWidth / 2;
    const baseY = node.y + nodeHeight / 2 - (lines.length - 1) * 8;
    const nodeStyle = getNodeStyle(node, index);

    return (
      <text x={baseX} y={baseY} textAnchor="middle" fontSize={compactMode ? "11" : "12"} fontWeight="700" fill={nodeStyle.text} pointerEvents="none">
        {lines.map((line, idx) => (
          <tspan key={`${node.id}-line-${idx}`} x={baseX} dy={idx === 0 ? 0 : 16}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };

  const renderEdgePath = (fromNode, toNode, edge, index) => {
    const sx = fromNode.x + nodeWidth / 2;
    const sy = fromNode.y + nodeHeight / 2;
    const tx = toNode.x + nodeWidth / 2;
    const ty = toNode.y + nodeHeight / 2;
    const horizontalBias = Math.abs(tx - sx) >= Math.abs(ty - sy);

    const c1x = horizontalBias ? sx + (tx - sx) * 0.45 : sx;
    const c1y = horizontalBias ? sy : sy + (ty - sy) * 0.45;
    const c2x = horizontalBias ? sx + (tx - sx) * 0.55 : tx;
    const c2y = horizontalBias ? ty : sy + (ty - sy) * 0.55;

    const path = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
    const labelX = (sx + tx) / 2;
    const labelY = (sy + ty) / 2 - 8;
    const directed = edge.type !== "undirected";
    const edgeColor = getAccent(index);

    return (
      <g key={edge.id || `edge-${index}`}>
        <path
          className="anim-edge"
          style={{ animationDelay: `${index * 0.18 + 0.1}s` }}
          d={path}
          stroke={edgeColor}
          strokeWidth="2.5"
          markerEnd={directed ? "url(#arrowhead)" : undefined}
        />
        {showEdgeLabels && edge.label ? (
          <text x={labelX} y={labelY} textAnchor="middle" fontSize="11" fontWeight="700" fill={edgeColor}>
            {edge.label}
          </text>
        ) : null}
      </g>
    );
  };

  const renderDiagramControls = () => (
    <div className="diagram-toolbar">
      <div className="diagram-tool-group">
          <button disabled={baseData.isHistorical} className="diagram-icon-btn" onClick={() => zoomBy(1.12)} type="button" title="Zoom in" aria-label="Zoom in">+</button>
          <button disabled={baseData.isHistorical} className="diagram-icon-btn" onClick={() => zoomBy(0.9)} type="button" title="Zoom out" aria-label="Zoom out">-</button>
        <button className="diagram-ctrl-btn" onClick={resetView} type="button">Fit</button>
        <button className="diagram-ctrl-btn" onClick={() => setIsFullscreen((prev) => !prev)} type="button">
          {isFullscreen ? "Exit" : "Full"}
        </button>
      </div>
      <div className="diagram-tool-group">
        <select className="diagram-select" value={selectedLayout} onChange={(event) => setSelectedLayout(event.target.value)} aria-label="Diagram layout">
          {["auto", "horizontal", "vertical", "radial", "compact", "manual"].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select className="diagram-select" value={selectedTheme} onChange={(event) => setSelectedTheme(event.target.value)} aria-label="Diagram theme">
          {Object.entries(DIAGRAM_THEMES).map(([key, item]) => (
            <option key={key} value={key}>{item.name}</option>
          ))}
        </select>
        <label className="diagram-toggle">
          <input type="checkbox" disabled={baseData.isHistorical} checked={showEdgeLabels} onChange={(event) => setShowEdgeLabels(event.target.checked)} />
          Labels
        </label>
        <label className="diagram-toggle">
          <input type="checkbox" disabled={baseData.isHistorical} checked={compactMode} onChange={(event) => setCompactMode(event.target.checked)} />
          Compact
        </label>
      </div>
      <div className="diagram-tool-group">
        <button className="diagram-ctrl-btn" onClick={copySvgToClipboard} type="button">Copy SVG</button>
        <button className="diagram-ctrl-btn" onClick={copyPngToClipboard} type="button">Copy PNG</button>
        <button className="diagram-ctrl-btn" onClick={exportAsSvg} type="button">SVG</button>
        <button className="diagram-ctrl-btn" onClick={exportAsPng} type="button">PNG</button>
      </div>
      <span className="diagram-meta">
        {copiedFormat ? `Copied ${copiedFormat}` : `Layout: ${effectiveLayout} | Nodes: ${inputNodeCount} | Edges: ${inputEdgeCount}`}
      </span>
    </div>
  );

  const renderLabel = (text, x, y, options = {}) => {
    const lines = wrapTextLines(text, options.maxChars || 16);
    return (
      <text x={x} y={y - (lines.length - 1) * 7} textAnchor={options.anchor || "middle"} fontSize={options.size || "13"} fontWeight="800" fill={options.fill || theme.text} pointerEvents="none">
        {lines.map((line, idx) => (
          <tspan key={`${text}-${idx}`} x={x} dy={idx === 0 ? 0 : 15}>{line}</tspan>
        ))}
      </text>
    );
  };

  const renderQuickDiagram = (quickType) => {
    const items = conceptualBlocks.slice(0, quickType === "venn" ? 3 : 10);
    // Dynamically scale width for timelines to prevent overlapping text
    const chartWidth = quickType === "timeline" ? Math.max(defaultWidth, items.length * 200) : Math.max(defaultWidth, 860);
    const chartHeight = Math.max(defaultHeight, 520);
    const cx = chartWidth / 2;
    const cy = chartHeight / 2;
    const safeItems = items.length > 0 ? items : ["Concept", "Example", "Practice"];

    return (
      <div style={{ overflowX: "auto", width: "100%", border: `1px solid ${theme.edge}55`, borderRadius: "0.75rem", backgroundColor: theme.canvas }}>
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ height: "auto", minWidth: "100%", maxHeight: "720px" }}>
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill={theme.edge} />
            </marker>
            <pattern id="diagram-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke={theme.edge} strokeWidth="0.4" opacity="0.16" />
            </pattern>
          </defs>
          <rect width={chartWidth} height={chartHeight} fill={theme.canvas} />
          <rect width={chartWidth} height={chartHeight} fill="url(#diagram-grid)" />

          {quickType === "cycle" && safeItems.map((item, i) => {
            const angle = (i / safeItems.length) * Math.PI * 2 - Math.PI / 2;
            const nextAngle = ((i + 1) / safeItems.length) * Math.PI * 2 - Math.PI / 2;
            const radius = 175;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            const nx = cx + Math.cos(nextAngle) * radius;
            const ny = cy + Math.sin(nextAngle) * radius;
            const color = getAccent(i);
            return (
              <g key={`cycle-${i}`} className="anim-node node-group" style={{ animationDelay: `${i * 0.12}s`, cursor: 'pointer' }} onClick={() => handleNodeClick(item)}>
                <path className="anim-edge" d={`M ${x} ${y} Q ${cx} ${cy} ${nx} ${ny}`} stroke={color} strokeWidth="2.4" markerEnd="url(#arrowhead)" />
                <circle cx={x} cy={y} r="58" fill={`${color}22`} stroke={color} strokeWidth="2.4" />
                {renderLabel(item, x, y + 4, { maxChars: 13 })}
              </g>
            );
          })}

          {(quickType === "mind-map" || quickType === "radial") && (
            <g>
              <circle cx={cx} cy={cy} r="74" fill={`${theme.edge}24`} stroke={theme.edge} strokeWidth="2.5" />
              {renderLabel(baseData.prompt || data?.title || "Main idea", cx, cy + 4, { maxChars: 14, size: "14" })}
              {safeItems.map((item, i) => {
                const angle = (i / safeItems.length) * Math.PI * 2 - Math.PI / 2;
                const x = cx + Math.cos(angle) * 205;
                const y = cy + Math.sin(angle) * 170;
                const color = getAccent(i);
                return (
                  <g key={`mind-${i}`} className="anim-node node-group" style={{ animationDelay: `${i * 0.1}s`, cursor: 'pointer' }} onClick={() => handleNodeClick(item)}>
                    <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth="2" opacity="0.85" />
                    <rect x={x - 82} y={y - 31} width="164" height="62" rx="12" fill={`${color}22`} stroke={color} strokeWidth="2" />
                    {renderLabel(item, x, y + 4, { maxChars: 17 })}
                  </g>
                );
              })}
            </g>
          )}

          {quickType === "timeline" && safeItems.map((item, i) => {
            const x = 90 + (i * (chartWidth - 180)) / Math.max(1, safeItems.length - 1);
            const y = cy;
            const color = getAccent(i);
            return (
              <g key={`timeline-${i}`} className="anim-node node-group" style={{ animationDelay: `${i * 0.1}s`, cursor: 'pointer' }} onClick={() => handleNodeClick(item)}>
                {i < safeItems.length - 1 && <line x1={x} y1={y} x2={90 + ((i + 1) * (chartWidth - 180)) / Math.max(1, safeItems.length - 1)} y2={y} stroke={theme.edge} strokeWidth="3" />}
                <circle cx={x} cy={y} r="22" fill={`${color}30`} stroke={color} strokeWidth="3" />
                <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight="900" fill={theme.text}>{i + 1}</text>
                {renderLabel(item, x, y + (i % 2 === 0 ? -58 : 72), { maxChars: 14 })}
              </g>
            );
          })}

          {(quickType === "matrix" || quickType === "comparison") && safeItems.map((item, i) => {
            const columns = safeItems.length <= 4 ? safeItems.length : 3;
            const cardW = (chartWidth - 120 - (columns - 1) * 22) / columns;
            const cardH = 112;
            const x = 60 + (i % columns) * (cardW + 22);
            const y = 70 + Math.floor(i / columns) * (cardH + 28);
            const color = getAccent(i);
            return (
              <g key={`matrix-${i}`} className="anim-node node-group" style={{ animationDelay: `${i * 0.08}s`, cursor: 'pointer' }} onClick={() => handleNodeClick(item)}>
                <rect x={x} y={y} width={cardW} height={cardH} rx="12" fill={`${color}22`} stroke={color} strokeWidth="2" />
                <circle cx={x + 24} cy={y + 24} r="10" fill={color} />
                {renderLabel(item, x + cardW / 2, y + 63, { maxChars: 22 })}
              </g>
            );
          })}

          {quickType === "venn" && safeItems.map((item, i) => {
            const color = getAccent(i);
            const positions = [
              { x: cx - 90, y: cy + 30 },
              { x: cx + 90, y: cy + 30 },
              { x: cx, y: cy - 90 },
              { x: cx - 90, y: cy - 90 }, // Extended fallback positions
              { x: cx + 90, y: cy - 90 }
            ];
            const pos = positions[i] || { x: cx + (Math.cos(i) * 120), y: cy + (Math.sin(i) * 120) };
            return (
              <g key={`venn-${i}`} className="anim-node node-group" style={{ animationDelay: `${i * 0.12}s`, cursor: 'pointer' }} onClick={() => handleNodeClick(item)}>
                <circle cx={pos.x} cy={pos.y} r="135" fill={`${color}35`} stroke={color} strokeWidth="2.5" />
                {renderLabel(item, pos.x, pos.y + (i === 2 ? -42 : 42), { maxChars: 16 })}
              </g>
            );
          })}

          {(quickType === "pyramid" || quickType === "stack") && safeItems.slice(0, 6).map((item, i, arr) => {
            const levelH = 58;
            const y = chartHeight - 80 - i * levelH;
            const width = quickType === "pyramid" ? 260 + i * 90 : 560;
            const x = cx - width / 2;
            const color = getAccent(i);
            return (
              <g key={`pyramid-${i}`} className="anim-node node-group" style={{ animationDelay: `${i * 0.1}s`, cursor: 'pointer' }} onClick={() => handleNodeClick(arr[arr.length - 1 - i])}>
                <rect x={x} y={y} width={width} height={levelH - 8} rx="10" fill={`${color}28`} stroke={color} strokeWidth="2" />
                {renderLabel(arr[arr.length - 1 - i], cx, y + 30, { maxChars: 24 })}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderGraphCanvas = () => {
    const { nodes, edges, chartWidth, chartHeight } = graphLayout;
    return (
      <div style={{ overflowX: "auto", width: "100%", border: `1px solid ${theme.edge}55`, borderRadius: "0.75rem", backgroundColor: theme.canvas }}>
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ height: "auto", minWidth: "100%", maxHeight: "720px", cursor: isDragging ? "grabbing" : "grab" }}
          onWheel={onWheelZoom}
          onMouseDown={onPanStart}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill={theme.edge} />
            </marker>
            <pattern id="diagram-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke={theme.edge} strokeWidth="0.4" opacity="0.16" />
            </pattern>
          </defs>
          <rect width={chartWidth} height={chartHeight} fill={theme.canvas} />
          <rect width={chartWidth} height={chartHeight} fill="url(#diagram-grid)" />
          <g transform={`translate(${panOffset.x} ${panOffset.y}) scale(${zoomScale})`}>
            {edges.map((edge, i) => {
              const from = nodes.find((n) => n.id === edge.from);
              const to = nodes.find((n) => n.id === edge.to);
              if (!from || !to) return null;
              return renderEdgePath(from, to, edge, i);
            })}
            {nodes.map((node, i) => (
            <g 
              key={node.id} 
              className="anim-node node-group" 
              style={{ animationDelay: `${i * 0.12}s` }} 
              onClick={() => handleNodeClick(node.text)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNodeClick(node.text);
                }
              }}
              aria-label={`Learn more about ${node.text}`}
            >
                {renderNodeShape(node, i)}
                {renderNodeText(node, i)}
              </g>
            ))}
          </g>
        </svg>
      </div>
    );
  };

  const renderHeader = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', width: '100%' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(129,140,248,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
        {baseData.tags.join(' • ')}
      </span>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(16,185,129,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
        {baseData.difficulty === 'Easy' ? '🟢' : baseData.difficulty === 'Hard' ? '🔴' : '🟡'} {baseData.difficulty}
      </span>
    </div>
  );

  const renderFooter = () => (
    <div style={{ marginTop: '1.5rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {baseData.explanation && (
        <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.5, textAlign: 'center', marginBottom: '1rem' }}>
          {baseData.explanation}
        </p>
      )}
      {!baseData.isHistorical && <button
        onClick={handleAcknowledge}
        disabled={submitted}
        style={{
          padding: '0.75rem 1.5rem',
          fontWeight: 700,
          fontSize: '1rem',
          borderRadius: '0.5rem',
          border: 'none',
          background: submitted ? '#475569' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          color: submitted ? '#94A3B8' : 'white',
          cursor: submitted ? 'default' : 'pointer',
          boxShadow: submitted ? 'none' : '0 4px 15px rgba(99, 102, 241, 0.3)',
          transition: 'all 0.2s ease',
          width: '100%'
        }}
      >
        {submitted ? '✓ Reviewed' : 'Mark as Reviewed'}
      </button>}
      {baseData.isHistorical && <div style={{ color: '#64748B', fontStyle: 'italic' }}>Historical diagram</div>}
    </div>
  );

  const containerStyle = { 
    backgroundColor: '#141827',
    padding: isFullscreen ? '1.25rem' : '2rem',
    borderRadius: isFullscreen ? 0 : '1rem',
    border: `1px solid ${theme.edge}44`,
    width: '100%',
    maxWidth: isFullscreen ? 'none' : '1200px',
    minHeight: isFullscreen ? '100vh' : undefined,
    position: isFullscreen ? 'fixed' : 'relative',
    inset: isFullscreen ? 0 : undefined,
    zIndex: isFullscreen ? 1000 : undefined,
    overflow: isFullscreen ? 'auto' : undefined,
    margin: isFullscreen ? 0 : '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  };

  // Temporal Cognition & Interactive CSS
  const globalStyles = (
    <style>{`
      @keyframes drawEdge {
        to { stroke-dashoffset: 0; }
      }
      @keyframes fadeInNode {
        from { opacity: 0; transform: translateY(15px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .anim-node {
        opacity: 0;
        animation: fadeInNode 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }
      .anim-edge {
        stroke-dasharray: 1000;
        stroke-dashoffset: 1000;
        animation: drawEdge 1.2s ease-in-out forwards;
        fill: none;
      }
      .node-shape {
        transition: all 0.3s ease;
        cursor: pointer;
      }
      .node-group:hover .node-shape {
        filter: drop-shadow(0 0 10px ${theme.edge}88);
      }
      .diagram-toolbar {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
        margin-bottom: 0.85rem;
      }
      .diagram-tool-group {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
      }
      .diagram-ctrl-btn {
        border: 1px solid ${theme.edge}77;
        background: ${theme.edge}20;
        color: ${theme.text};
        border-radius: 8px;
        padding: 0.45rem 0.7rem;
        font-weight: 600;
        font-size: 0.82rem;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .diagram-icon-btn {
        border: 1px solid ${theme.edge}77;
        background: ${theme.edge}20;
        color: ${theme.text};
        border-radius: 8px;
        width: 34px;
        height: 34px;
        font-weight: 900;
        font-size: 1rem;
        cursor: pointer;
      }
      .diagram-ctrl-btn:hover,
      .diagram-icon-btn:hover {
        background: ${theme.edge}33;
      }
      .diagram-select {
        border: 1px solid ${theme.edge}66;
        background: ${theme.canvas};
        color: ${theme.text};
        border-radius: 8px;
        padding: 0.42rem 0.55rem;
        font-size: 0.82rem;
        font-weight: 700;
      }
      .diagram-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: ${theme.muted};
        font-size: 0.8rem;
        font-weight: 700;
      }
      .diagram-meta {
        color: ${theme.muted};
        font-size: 0.82rem;
        margin-left: auto;
      }
      @keyframes pulse-indigo {
        0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
        100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
      }
      @media (max-width: 700px) {
        .diagram-ctrl-btn {
          font-size: 0.76rem;
          padding: 0.4rem 0.55rem;
        }
        .diagram-meta {
          margin-left: 0;
          width: 100%;
        }
      }
    `}</style>
  );

  if (renderType === "triangle") {
    return (
      <div className="diagram-widget card" style={containerStyle} ref={containerRef}>
        {renderHeader()}
        {baseData.prompt && <h3 style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem', width: '100%', textAlign: 'center' }}>{baseData.prompt}</h3>}
        {globalStyles}
        {renderDiagramControls()}
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${containerWidth} ${height}`} style={{ height: 'auto', maxHeight: '600px', overflow: 'visible', backgroundColor: theme.canvas, borderRadius: '0.75rem' }}>
          <polygon
            points={`${containerWidth / 2},10 10,${height - 10} ${containerWidth - 10},${height - 10}`}
            fill={`${theme.edge}22`}
            stroke={theme.edge}
            strokeWidth="3"
            style={{ transition: 'all 0.4s ease-out' }}
          />
          {normalizedLabels.map((label, i) => {
            const isTop = i === 0;
            const isLeft = i === 1;
            return (
              <text
                key={i}
                className="anim-node node-shape"
                style={{ animationDelay: `${i * 0.3}s`, textShadow: '0 2px 4px rgba(0,0,0,0.8)', transition: 'all 0.4s ease-out', cursor: 'pointer' }}
                onClick={() => handleNodeClick(label)}
                x={isTop ? containerWidth / 2 : isLeft ? 10 : containerWidth - 10}
                y={isTop ? 35 : height - 15}
                textAnchor={isTop ? "middle" : isLeft ? "start" : "end"}
                fontSize="17"
                fontWeight="700"
                fill={getAccent(i)}
              >
                {label}
              </text>
            );
          })}
        </svg>
        {renderFooter()}
      </div>
    );
  }

  if (renderType === "rectangle") {
    return (
      <div className="diagram-widget card" style={containerStyle} ref={containerRef}>
        {renderHeader()}
        {baseData.prompt && <h3 style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem', width: '100%', textAlign: 'center' }}>{baseData.prompt}</h3>}
        {globalStyles}
        {renderDiagramControls()}
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${containerWidth} ${height}`} style={{ height: 'auto', maxHeight: '600px', overflow: 'visible', backgroundColor: theme.canvas, borderRadius: '0.75rem' }}>
          <rect
            x="10"
            y="10"
            width={containerWidth - 20}
            height={height - 20}
            fill={`${theme.edge}22`}
            stroke={theme.edge}
            strokeWidth="3"
            rx="10"
            style={{ transition: 'all 0.4s ease-out' }}
          />
          {normalizedLabels.map((label, i) => (
            <text
              key={i}
              className="anim-node node-shape"
              style={{ animationDelay: `${i * 0.25}s`, transition: 'all 0.4s ease-out', cursor: 'pointer' }}
              onClick={() => handleNodeClick(label)}
              x={containerWidth / 2}
              y={(height / 2) - ((normalizedLabels.length - 1) * 16) + (i * 32)}
              textAnchor="middle"
              fontSize="17"
              fontWeight="700"
              fill={getAccent(i)}
            >
              {label}
            </text>
          ))}
        </svg>
        {renderFooter()}
      </div>
    );
  }

  if (["cycle", "mind-map", "timeline", "matrix", "venn", "pyramid", "stack", "radial", "comparison"].includes(renderType)) {
    return (
      <div className="diagram-widget card" style={containerStyle} ref={containerRef}>
        {renderHeader()}
        {baseData.prompt && <h3 style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem', width: '100%', textAlign: 'center' }}>{baseData.prompt}</h3>}
        {globalStyles}
        {renderDiagramControls()}
        {renderQuickDiagram(renderType)}
        {renderFooter()}
      </div>
    );
  }

  if ((renderType === "flowchart" || renderType === "tree" || renderType === "concept-map") && hasValidGeometry) {
    return (
      <div className="diagram-widget card" style={containerStyle} ref={containerRef}>
        {renderHeader()}
        {baseData.prompt && <h3 style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem', width: '100%', textAlign: 'center' }}>{baseData.prompt}</h3>}
        {globalStyles}
        {renderDiagramControls()}
        {renderGraphCanvas()}
        {renderFooter()}
      </div>
    );
  }

  // ✨ LAYER 4: SEMANTIC SYNTHESIS MODE (Graceful Fallback)
  // Transforms an empty UI failure into a generative pedagogical block.
  const title = data.diagram || data.title || baseData.prompt || "Concept Visualization";
  const desc = data.description || baseData.explanation || "A conceptual mapping of the topic.";

  return (
    <div className="diagram-widget card" style={containerStyle} ref={containerRef}>
      {renderHeader()}
      <h3 style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem', width: '100%', textAlign: 'center' }}>{title}</h3>
      
      <div style={{ padding: '2.5rem 1.5rem', backgroundColor: '#0F0F1A', border: '1px dashed #6366f1', borderRadius: '0.75rem', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'inline-block', borderRadius: '50%', padding: '1rem', backgroundColor: 'rgba(99,102,241,0.1)', animation: 'pulse-indigo 2s infinite' }}>🧠</div>
        <h4 style={{ color: '#A5B4FC', margin: '0 0 1rem 0', fontSize: '1.15rem' }}>Semantic Visualization</h4>
        <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '500px', margin: '0 auto' }}>
          {desc}
        </p>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
           {conceptualBlocks.slice(0, 12).map((concept, i) => (
             <div key={i} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleNodeClick(concept)}>
               <span style={{ padding: '0.65rem 1.25rem', backgroundColor: '#1e293b', border: '1px solid #6366f1', borderRadius: '0.5rem', color: '#e2e8f0', fontSize: '0.95rem', fontWeight: 600, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                 {concept}
               </span>
               {i < Math.min(conceptualBlocks.length, 12) - 1 && <span style={{ color: '#475569', margin: '0 0.5rem', fontWeight: 'bold' }}>→</span>}
             </div>
           ))}
           {conceptualBlocks.length > 12 && <span style={{ color: '#818CF8', alignSelf: 'center', fontWeight: 600 }}>+ {conceptualBlocks.length - 12} more concepts...</span>}
        </div>
      </div>
      {renderFooter()}
    </div>
  );
};
