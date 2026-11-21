const NS = "http://www.w3.org/2000/svg";
const TYPES = {
  claim: {label: "핵심 주장", color: "#1b5e95", fill: "#edf5fc"},
  reason: {label: "원문의 근거", color: "#147a68", fill: "#f0f8f5"},
  objection: {label: "원문의 반박", color: "#b3553f", fill: "#fff5f0"},
  review: {label: "AI 검토", color: "#7a55a1", fill: "#f8f3fc"},
};

function element(tag, attributes = {}, text = "") {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}

function wrapText(text, width, context) {
  const lines = [];
  let line = "";
  for (const character of text.replace(/\s+/g, " ").trim()) {
    if (line && context.measureText(line + character).width > width) {
      lines.push(line.trim());
      line = "";
    }
    line += character;
  }
  if (line) lines.push(line.trim());
  return lines;
}

function nodeLevels(nodes, edges) {
  const parents = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    if (!parents.has(edge.source) || !parents.has(edge.target)) {
      throw new Error("연결 대상이 없는 지도가 도착했어요. 다시 분석해 주세요.");
    }
    parents.get(edge.source).push(edge.target);
  }
  const levels = new Map();
  const visiting = new Set();
  function depth(id) {
    if (levels.has(id)) return levels.get(id);
    if (visiting.has(id)) throw new Error("지도의 연결 관계가 순환해요. 다시 분석해 주세요.");
    visiting.add(id);
    const targets = parents.get(id);
    const level = targets.length ? 1 + Math.max(...targets.map(depth)) : 0;
    visiting.delete(id);
    levels.set(id, level);
    return level;
  }
  for (const node of nodes) depth(node.id);
  return levels;
}

export function createArgumentSvg(analysis, onSelect, availableWidth = 976) {
  const width = Math.max(280, Math.min(976, availableWidth));
  const columns = width < 620 ? 1 : (width < 900 ? 2 : 3);
  const context = document.createElement("canvas").getContext("2d");
  context.font = '23px "Malgun Gothic", sans-serif';
  const titleLines = wrapText(analysis.title || "논증지도", width - 68, context);
  context.font = '17px "Malgun Gothic", sans-serif';
  const levels = nodeLevels(analysis.nodes, analysis.edges);
  const rows = new Map();
  for (const node of analysis.nodes) {
    const rank = levels.get(node.id);
    if (!rows.has(rank)) rows.set(rank, []);
    rows.get(rank).push(node);
  }
  const boxes = new Map();
  const legendColumns = Math.min(4, Math.max(1, Math.floor((width - 48) / 130)));
  const legendRows = Math.ceil(Object.keys(TYPES).length / legendColumns);
  const contentTop = 119 + titleLines.length * 29 + (legendRows - 1) * 24;
  let y = contentTop;
  for (const [, nodes] of [...rows].sort((a, b) => a[0] - b[0])) {
    for (let start = 0; start < nodes.length; start += columns) {
      const row = nodes.slice(start, start + columns);
      const boxWidth = row.length === 1 ? Math.min(420, width - 48) : 280;
      const gap = 28;
      const rowWidth = row.length * boxWidth + (row.length - 1) * gap;
      const xStart = (width - rowWidth) / 2;
      let rowHeight = 0;
      row.forEach((node, index) => {
        const lines = wrapText(node.text, boxWidth - 40, context);
        const height = 63 + lines.length * 25;
        boxes.set(node.id, {x: xStart + index * (boxWidth + gap), y, width: boxWidth, height, lines});
        rowHeight = Math.max(rowHeight, height);
      });
      y += rowHeight + 88;
    }
  }
  const height = y - 30;
  const svg = element("svg", {
    xmlns: NS, width, height, viewBox: "0 0 " + width + " " + height,
    role: "group", "aria-label": analysis.title || "논증지도",
    "font-family": '"Malgun Gothic","Noto Sans KR",sans-serif',
  });
  svg.append(element("rect", {width, height, fill: "#fbfcfe"}));
  const title = element("text", {x: 34, y: 40, fill: "#172b3c", "font-size": 23, "font-weight": 700});
  titleLines.forEach((line, index) => title.append(element("tspan", {x: 34, dy: index ? 29 : 0}, line)));
  svg.append(title);
  Object.values(TYPES).forEach((style, index) => {
    const legendX = 24 + (index % legendColumns) * 130;
    const legendY = contentTop - 49 - (legendRows - 1) * 24 + Math.floor(index / legendColumns) * 24;
    svg.append(element("rect", {x: legendX, y: legendY, width: 10, height: 10, rx: 2, fill: style.color}));
    svg.append(element("text", {x: legendX + 17, y: legendY + 10, fill: "#5d7182", "font-size": 12}, style.label));
  });
  const definitions = element("defs");
  for (const [relation, color] of [["supports", "#147a68"], ["challenges", "#b3553f"], ["review", "#7a55a1"]]) {
    const marker = element("marker", {
      id: "arrow-" + relation, viewBox: "0 0 10 10", refX: 9, refY: 5,
      markerWidth: 7, markerHeight: 7, orient: "auto",
    });
    marker.append(element("path", {d: "M 0 0 L 10 5 L 0 10 Z", fill: color}));
    definitions.append(marker);
  }
  svg.append(definitions);

  const nodeById = new Map(analysis.nodes.map(node => [node.id, node]));
  const incoming = new Map(analysis.nodes.map(node => [node.id, []]));
  for (const edge of analysis.edges) incoming.get(edge.target).push(edge);
  for (const edge of analysis.edges) {
    const source = boxes.get(edge.source);
    const target = boxes.get(edge.target);
    const sx = source.x + source.width / 2;
    const sy = source.y - 3;
    const targetEdges = incoming.get(edge.target);
    const port = targetEdges.indexOf(edge) + 1;
    const tx = target.x + target.width * port / (targetEdges.length + 1);
    const ty = target.y + target.height + 5;
    const middle = (sy + ty) / 2;
    const isReview = nodeById.get(edge.source).type === "review";
    const relation = isReview ? "review" : edge.relation;
    const color = relation === "supports" ? "#147a68" : (isReview ? "#7a55a1" : "#b3553f");
    const path = element("path", {
      d: ["M", sx, sy, "C", sx, middle, tx, middle, tx, ty].join(" "),
      stroke: color, "stroke-width": 1.9, fill: "none",
      "marker-end": "url(#arrow-" + relation + ")",
    });
    if (edge.relation === "challenges") path.setAttribute("stroke-dasharray", "6 4");
    svg.append(path);
    const label = relation === "supports" ? "지지" : (isReview ? "검토" : "반박");
    const lx = (sx + tx) / 2;
    const ly = middle + 5;
    svg.append(element("rect", {x: lx - 19, y: ly - 15, width: 38, height: 21, rx: 4, fill: "#fbfcfe"}));
    svg.append(element("text", {x: lx, y: ly, "text-anchor": "middle", fill: color, "font-size": 12}, label));
  }

  for (const node of analysis.nodes) {
    const box = boxes.get(node.id);
    const style = TYPES[node.type];
    const group = element("g", {
      role: "button", tabindex: 0, "aria-label": style.label + " " + node.text,
      "data-node-id": node.id, style: "cursor:pointer",
    });
    const rectangle = element("rect", {
      x: box.x, y: box.y, width: box.width, height: box.height, rx: 10,
      fill: style.fill, stroke: style.color, "stroke-width": 1.4,
    });
    if (node.origin === "ai") rectangle.setAttribute("stroke-dasharray", "6 4");
    group.append(rectangle);
    group.append(element("text", {
      x: box.x + 20, y: box.y + 26, fill: style.color, "font-size": 12, "font-weight": 700,
    }, style.label));
    const text = element("text", {x: box.x + 20, y: box.y + 55, fill: "#203848", "font-size": 17});
    box.lines.forEach((line, index) => text.append(element("tspan", {x: box.x + 20, dy: index ? 25 : 0}, line)));
    group.append(text);
    group.addEventListener("click", () => onSelect(node, style.label));
    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(node, style.label);
      }
    });
    svg.append(group);
  }
  return svg;
}
