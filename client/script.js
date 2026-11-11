// ==========================================
// MASTER CONFIGURATION (TWEAK EVERYTHING HERE)
// ==========================================
const CONFIG = {
    dag: {
        enabled: false,       // SWITCH: Set to true to use strict 3D Tree layout
        mode: 'radialout',    // Options: 'radialout' (spheres), 'td' (top-down), 'lr' (left-right)
        distance: 350         // Distance between layers of the tree
    },
    colors: {
        levels: {
            1: { hex: '#00f0ff', rgb: '0, 240, 255' },    // L1: Cyan
            2: { hex: '#a855f7', rgb: '168, 85, 247' },   // L2: Purple
            3: { hex: '#fbbf24', rgb: '251, 191, 36' },   // L3: Amber
            4: { hex: '#ec4899', rgb: '236, 72, 153' },   // L4: Pink
            5: { hex: '#22c55e', rgb: '34, 197, 94' },    // L5: Green
            6: { hex: '#f97316', rgb: '249, 115, 22' },   // L6: Orange
            7: { hex: '#3b82f6', rgb: '59, 130, 246' },   // L7: Blue
            8: { hex: '#ef4444', rgb: '239, 68, 68' },    // L8: Red
            9: { hex: '#14b8a6', rgb: '20, 184, 166' },   // L9: Teal
            10: { hex: '#6366f1', rgb: '99, 102, 241' }   // L10: Indigo
        },
        nodes: {
            module: { r: 0, g: 240, b: 255 },
            class: { r: 168, g: 85, b: 247 },
            function: { r: 0, g: 255, b: 170 },
            service: { r: 255, g: 170, b: 0 },
            interface: { r: 56, g: 189, b: 248 },
            default: { r: 100, g: 116, b: 139 }
        },
        links: {
            imports: { r: 168, g: 85, b: 247 },
            calls: { r: 0, g: 255, b: 170 },
            inherits: { r: 255, g: 170, b: 0 },
            default: { r: 0, g: 240, b: 255 }
        },
        opacities: {
            nodes: {
                focused: 1.0,
                directNeighbor: 1.0,
                sameCluster: 0.55,
                sameRoot: 0.20,
                unrelated: 0.08
            },
            links: {
                focused: 0.95,
                internalCluster: 0.45,
                siblingCluster: 0.15,
                unrelated: 0.05
            }
        }
    },
    physics: {
        orbits: {
            // Expanded to dynamically handle 10 depth levels cleanly
            base:  { 1: 180, 2: 120, 3: 70, 4: 50, 5: 35, 6: 25, 7: 20, 8: 15, 9: 10, 10: 5 },
            scale: { 1: 35,  2: 20,  3: 15, 4: 10, 5: 8,  6: 6,  7: 5,  8: 4,  9: 3,  10: 2 }
        },
        clusterGravity: {
            alpha: 0.08,
            stopRadiusBase: 150,
            stopRadiusScale: 20
        },
        links: {
            distance: { internal: 140, l2Sibling: 220, l1Sibling: 350, external: 550 },
            strength: { internal: 0.15, l1Sibling: 0.09, external: 0.01 }
        },
        charge: -800
    },
    camera: {
        badgeYOffset: { 1: 75, 2: 50, 3: 35, 4: 25, 5: 20, 6: 15, 7: 12, 8: 10, 9: 8, 10: 5 },
        baseDistance: { 1: 580, 2: 340, 3: 180, 4: 120, 5: 90, 6: 70, 7: 50, 8: 40, 9: 30, 10: 20 },
        distanceScale: 25
    },
    labels: {
        clusterMaxPills: 40,
        globalMaxPills: 40
    }
};

// ==========================================
// GLOBALS & STATE
// ==========================================
let Graph = null;
let graphDataGlobal = null;
let focusedNode = null;
let focusedClusterPrefix = null;
const highlightNodes = new Set();
const semiHighlightNodes = new Set();
const rootClusterNodes = new Set();
const highlightLinks = new Set();
const searchMatchingNodes = new Set();
let clusterGroups = {};

let selectionIntensity = 0.0;

function switchTab(tabId, el) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    if (el) el.classList.add('active');
    else document.querySelector('.tab-btn').classList.add('active');
    document.getElementById('tab-' + tabId).style.display = 'block';
}

function resetCamera() {
    if (Graph) Graph.cameraPosition({ x: 0, y: 0, z: 950 }, { x: 0, y: 0, z: 0 }, 1500);
}

function focusNodeById(id) {
    const targetNode = graphDataGlobal && graphDataGlobal.nodes.find(n => n.id === id);
    if (!targetNode) return;

    if (typeof window.handleNodeSelection === 'function') {
        window.handleNodeSelection(targetNode);
        return;
    }

    if (Graph && typeof Graph.onNodeClick === 'function') {
        const onNodeClick = Graph.onNodeClick();
        if (typeof onNodeClick === 'function') onNodeClick(targetNode);
    }
}

// ==========================================
// DYNAMIC UI HELPERS
// ==========================================
function getDefaultNodeDetailsHtml() {
    let html = '<p style="color: #64748b; font-style: italic; font-size: 13px;">Select a node in the graph to view technical specifications and memory context.</p>';
    
    html += `<div class="property" style="margin-top: 30px;">
                <span class="prop-title">LINK (PIPE) COLOR LEGEND</span>
                <div style="display:flex; flex-direction:column; gap:12px; margin-top: 12px;">`;
    
    const rels = [
        { label: 'IMPORTS', c: CONFIG.colors.links.imports },
        { label: 'CALLS / EXTENDS', c: CONFIG.colors.links.calls },
        { label: 'INHERITS / DEPENDS_ON', c: CONFIG.colors.links.inherits },
        { label: 'DEFAULT / OTHER', c: CONFIG.colors.links.default }
    ];

    rels.forEach(r => {
        html += `<div style="display:flex; align-items:center; gap:12px;">
            <div style="width: 28px; height: 4px; background: rgb(${r.c.r}, ${r.c.g}, ${r.c.b}); box-shadow: 0 0 10px rgba(${r.c.r}, ${r.c.g}, ${r.c.b}, 0.8); border-radius: 2px;"></div>
            <span style="font-size: 11px; color: #cbd5e1; font-weight: 600; letter-spacing: 0.5px;">${r.label}</span>
        </div>`;
    });
    
    html += `</div></div>`;
    return html;
}

// ==========================================
// CAMERA & CLUSTER FOCUS LOGIC
// ==========================================
function focusCluster(clusterName) {
    const grp = clusterGroups[clusterName];
    if (!grp || grp.length === 0) return;

    highlightNodes.clear();
    semiHighlightNodes.clear();
    rootClusterNodes.clear();
    highlightLinks.clear();
    searchMatchingNodes.clear();
    focusedNode = null;
    focusedClusterPrefix = clusterName;

    const container = document.getElementById('hud-labels-layer');
    container.querySelectorAll('.hud-floating-pill').forEach(el => el.remove());

    const rootName = clusterName.split(' / ')[0];
    const rootGrp = clusterGroups[rootName] || [];

    grp.forEach(n => searchMatchingNodes.add(n.id));
    rootGrp.forEach(n => {
        if (!searchMatchingNodes.has(n.id)) semiHighlightNodes.add(n.id);
    });

    const lvl = grp.level || 1;
    const nodeCount = grp.length;

    let sumX = 0, sumY = 0, sumZ = 0;
    grp.forEach(n => { sumX += n.x || 0; sumY += n.y || 0; sumZ += n.z || 0; });
    const avgX = sumX / nodeCount;
    const avgY = sumY / nodeCount;
    const avgZ = sumZ / nodeCount;

    const targetY = avgY + (CONFIG.camera.badgeYOffset[lvl] || 10);
    const distance = (CONFIG.camera.baseDistance[lvl] || 20) + (Math.sqrt(nodeCount) * CONFIG.camera.distanceScale);

    Graph.cameraPosition(
        { x: avgX, y: targetY, z: avgZ + distance }, 
        { x: avgX, y: targetY, z: avgZ }, 
        1100
    );

    animateToSelection(0.9);

    const nextLevel = lvl + 1;
    const childClusters = Object.keys(clusterGroups).filter(k =>
        k.startsWith(clusterName + ' / ') && clusterGroups[k].level === nextLevel
    );

    let parentBtnHtml = '';
    if (grp.parentKey) {
        parentBtnHtml = `
            <div style="margin-bottom: 12px;">
                <div class="pill-item" onclick="focusCluster('${grp.parentKey}')" style="border-color: var(--hud-cyan); cursor: pointer;">
                    <span style="color: var(--hud-cyan); font-weight: 600;">↑ BACK TO ${grp.parentKey.split(' / ').pop()}</span>
                    <span class="pill-relation">LEVEL ${lvl - 1}</span>
                </div>
            </div>
        `;
    }

    let subClustersHtml = '';
    if (childClusters.length > 0) {
        subClustersHtml = `<div class="property"><span class="prop-title">CHILD SUB-CLUSTERS (${childClusters.length})</span><div class="pill-list">`;
        childClusters.forEach(cKey => {
            const shortLabel = clusterGroups[cKey].shortName || cKey;
            const count = clusterGroups[cKey].length;
            subClustersHtml += `
                <div class="pill-item" onclick="focusCluster('${cKey}')">
                    <span style="color: #00f0ff; font-weight: 600;">↳ ${shortLabel}</span>
                    <span class="pill-relation">${count} nodes</span>
                </div>
            `;
        });
        subClustersHtml += `</div></div>`;
    } else {
        subClustersHtml = `<div class="property"><span class="prop-title">NODES IN CLUSTER (${grp.length})</span><div class="pill-list">`;
        grp.forEach(n => {
            const label = n.name || n.id.split('/').pop();
            subClustersHtml += `
                <div class="pill-item" onclick="focusNodeById('${n.id}')">
                    <span style="color: #e2e8f0;">• ${label}</span>
                    <span class="pill-relation">${n.group || 'node'}</span>
                </div>
            `;
        });
        subClustersHtml += `</div></div>`;
    }

    document.getElementById('panel-title').innerText = `CLUSTER / LEVEL ${lvl}`;
    document.getElementById('node-details').innerHTML = `
        ${parentBtnHtml}
        <div class="property"><span class="prop-title">SUBSYSTEM DOMAIN</span><strong style="color: var(--hud-cyan); font-size: 15px;">${clusterName}</strong></div>
        <div class="property"><span class="prop-title">COMPONENTS DETECTED</span><span style="color: #fff; font-weight: 600; font-size: 14px;">${grp.length}</span></div>
        ${subClustersHtml}
    `;
    document.getElementById('doc-details').innerHTML = `<p style="color: #64748b; font-style: italic; font-size: 13px;">No architectural documentation available for entire cluster.</p>`;
    document.getElementById('raw-details').innerHTML = `<p style="color: #64748b; font-style: italic; font-size: 13px;">N/A</p>`;
    switchTab('specs', document.querySelectorAll('.tab-btn')[0]);
}

// ==========================================
// COLOR HELPERS
// ==========================================
function getNodeBaseColor(node) {
    const grp = (node.group || '').toLowerCase();
    if (grp === 'module' || grp === 'script') return CONFIG.colors.nodes.module;
    if (grp === 'class' || grp === 'controller') return CONFIG.colors.nodes.class;
    if (grp === 'function' || grp === 'utility' || grp === 'directive') return CONFIG.colors.nodes.function;
    if (grp === 'service') return CONFIG.colors.nodes.service;
    if (grp === 'interface' || grp === 'model') return CONFIG.colors.nodes.interface;
    return CONFIG.colors.nodes.default;
}

function getLinkBaseColor(link) {
    const rel = (link.relation || '').toLowerCase();
    if (rel === 'imports') return CONFIG.colors.links.imports;
    if (rel === 'calls' || rel === 'extends') return CONFIG.colors.links.calls;
    if (rel === 'inherits' || rel === 'depends_on') return CONFIG.colors.links.inherits;
    return CONFIG.colors.links.default;
}

function getLevelColor(node) {
    const lvl = (node._levels || []).length;
    return CONFIG.colors.levels[lvl] || CONFIG.colors.levels[10];
}

// ==========================================
// PARSING & HIERARCHY
// ==========================================
function parseNodeLevels(node) {
    if (!node) return ['CORE'];
    const rawId = String(node.id || '').trim();
    if (!rawId) return ['EXTERNAL'];

    if (rawId.startsWith('@external/')) {
       return ['EXTERNAL'];
    }

    const parts = rawId.split(/[\/#]/).filter(Boolean);
    while (parts.length > 1 && ['SRC'].includes(parts[0].toUpperCase())) {
        parts.shift();
    }

    if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        if (/\.[a-z0-9]+$/i.test(lastPart) || lastPart.toLowerCase() === 'ts') parts.pop();
    }

    const cleanParts = parts
        .map(p => p.toUpperCase().replace(/\.(SPEC|COMPONENT|SERVICE|DIRECTIVE|MODEL|MODELS|INTERFACE|ENUM|HELPER|BEHAVIOUR)?\.?(TS|JS|HTML|SCSS|MD|FRAG|VERT|D)$/i, ''))
        .filter(Boolean);

    if (cleanParts.length === 0) return ['CORE'];
    
    // Support up to 10 levels dynamically
    return cleanParts.slice(0, 10);
}

// Recursive function to handle N-levels deep orbit calculation
function calculateClusterCenters(hierarchyObj, parentCenter = {x: 0, y: 0, z: 0}, currentLevel = 1, currentPath = '', parentAngle = 0) {
    if (CONFIG.dag.enabled) return;

    const keys = Object.keys(hierarchyObj).filter(Boolean);
    keys.forEach((key, i) => {
        const fullPath = currentPath ? `${currentPath} / ${key}` : key;
        const nodeCount = clusterGroups[fullPath] ? clusterGroups[fullPath].length : 1;

        const baseR = CONFIG.physics.orbits.base[currentLevel] || 10;
        const scaleR = CONFIG.physics.orbits.scale[currentLevel] || 2;
        const r = baseR + (Math.sqrt(nodeCount) * scaleR);

        const a = parentAngle + (2 * Math.PI * i) / keys.length;
        
        let yOffset = currentLevel === 1 ? (80 + Math.sqrt(nodeCount) * 10) : (50 / (currentLevel - 1));

        const c = {
            x: parentCenter.x + r * Math.cos(a),
            y: parentCenter.y + ((i % 2 === 0 ? 1 : -1) * yOffset),
            z: parentCenter.z + r * Math.sin(a)
        };

        if (clusterGroups[fullPath]) clusterGroups[fullPath].targetCenter = c;

        if (typeof hierarchyObj[key] === 'object' && Object.keys(hierarchyObj[key]).length > 0) {
            calculateClusterCenters(hierarchyObj[key], c, currentLevel + 1, fullPath, a);
        }
    });
}

function buildClusterGroups(nodes) {
    clusterGroups = {};
    const hierarchy = {};

    const container = document.getElementById('hud-labels-layer');
    if (container) container.innerHTML = '';

    nodes.forEach(node => {
        node._tempLevels = parseNodeLevels(node);
    });

    let collapsing = true;
    while (collapsing) {
        collapsing = false;
        const pathCounts = {};
        
        nodes.forEach(n => {
            const path = n._tempLevels.join(' / ');
            pathCounts[path] = (pathCounts[path] || 0) + 1;
        });

        nodes.forEach(n => {
            const path = n._tempLevels.join(' / ');
            if (pathCounts[path] === 1) {
                if (n._tempLevels.length === 1 && n._tempLevels[0] === 'CORE') return;
                n._tempLevels.pop();
                if (n._tempLevels.length === 0) n._tempLevels = ['CORE'];
                collapsing = true;
            }
        });
    }

    nodes.forEach(node => {
        const levels = node._tempLevels;
        node._levels = levels;
        
        const leafKey = levels.join(' / ');
        node.subsystem = leafKey;
        node.connectionCount = 0;

        for (let i = 1; i <= levels.length; i++) {
            const key = levels.slice(0, i).join(' / ');
            if (!clusterGroups[key]) {
                clusterGroups[key] = [];
                clusterGroups[key].level = i;
                clusterGroups[key].shortName = levels[i - 1];
                clusterGroups[key].parentKey = i > 1 ? levels.slice(0, i - 1).join(' / ') : null;
            }
            clusterGroups[key].push(node);
        }

        // Dynamically build the object tree for N levels (replaces the old l1,l2,l3 hardcodes)
        let currentObj = hierarchy;
        levels.forEach((lvl, idx) => {
            if (!currentObj[lvl]) {
                currentObj[lvl] = {};
            }
            currentObj = currentObj[lvl];
        });
    });

    calculateClusterCenters(hierarchy);
}

// ==========================================
// PHYSICS ENGINE LOOP (STATIC / UNIFIED)
// ==========================================
function applyGraphPhysicsState() {
    if (!Graph || !graphDataGlobal) return;

    if (CONFIG.dag.enabled) {
        Graph.dagMode(CONFIG.dag.mode).dagLevelDistance(CONFIG.dag.distance);
        Graph.d3Force('cluster', null); 
        Graph.d3Force('link').strength(0); 
        Graph.d3Force('charge').strength(-5000);
        return;
    }

    const clusterAlpha = CONFIG.physics.clusterGravity.alpha; 

    Graph.d3Force('cluster', () => {
        graphDataGlobal.nodes.forEach(node => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') return;

            const grp = clusterGroups[node.subsystem];
            if (grp && grp.targetCenter) {
                const dx = grp.targetCenter.x - node.x;
                const dy = grp.targetCenter.y - node.y;
                const dz = grp.targetCenter.z - node.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist === 0) return;

                const nodeCount = grp.length;
                const stopRadius = CONFIG.physics.clusterGravity.stopRadiusBase + (Math.sqrt(nodeCount) * CONFIG.physics.clusterGravity.stopRadiusScale);

                if (dist > stopRadius) {
                    const factor = ((dist - stopRadius) / dist) * clusterAlpha;
                    node.vx = (node.vx || 0) + dx * factor;
                    node.vy = (node.vy || 0) + dy * factor;
                    node.vz = (node.vz || 0) + dz * factor;
                }
            }
        });
    });

    Graph.d3Force('link')
        .distance(link => {
            const sSub = link.source.subsystem;
            const tSub = link.target.subsystem;
            const sL1 = link.source._levels ? link.source._levels[0] : null;
            const tL1 = link.target._levels ? link.target._levels[0] : null;
            const sL2 = link.source._levels && link.source._levels.length > 1 ? link.source._levels.slice(0,2).join(' / ') : null;
            const tL2 = link.target._levels && link.target._levels.length > 1 ? link.target._levels.slice(0,2).join(' / ') : null;

            if (sSub === tSub) return CONFIG.physics.links.distance.internal; 
            if (sL2 && sL2 === tL2) return CONFIG.physics.links.distance.l2Sibling;
            if (sL1 === tL1) return CONFIG.physics.links.distance.l1Sibling;
            return CONFIG.physics.links.distance.external;
        })
        .strength(link => {
            const sSub = link.source.subsystem;
            const tSub = link.target.subsystem;
            const sL1 = link.source._levels ? link.source._levels[0] : null;
            const tL1 = link.target._levels ? link.target._levels[0] : null;

            if (sSub === tSub) return CONFIG.physics.links.strength.internal; 
            if (sL1 === tL1) return CONFIG.physics.links.strength.l1Sibling;
            return CONFIG.physics.links.strength.external;
        });

    Graph.d3Force('charge').strength(CONFIG.physics.charge);
}

// ==========================================
// VISUAL ANIMATION (DECOUPLED FROM PHYSICS)
// ==========================================
function animateToSelection(targetValue) {
    selectionIntensity = targetValue;
    
    if (Graph) {
        Graph.nodeColor(Graph.nodeColor())
             .nodeVal(Graph.nodeVal())
             .linkColor(Graph.linkColor())
             .linkWidth(Graph.linkWidth());
    }
}

function clearSelection() {
    if (highlightNodes.size === 0 && selectionIntensity === 0.0 && searchMatchingNodes.size === 0 && !focusedClusterPrefix) return;

    focusedNode = null;
    focusedClusterPrefix = null;
    highlightNodes.clear();
    semiHighlightNodes.clear();
    rootClusterNodes.clear();
    highlightLinks.clear();
    searchMatchingNodes.clear();
    
    animateToSelection(0.0);

    const container = document.getElementById('hud-labels-layer');
    container.querySelectorAll('.hud-floating-pill').forEach(el => el.remove());

    document.getElementById('panel-title').innerText = 'COMPONENT INSPECTOR';
    document.getElementById('node-details').innerHTML = getDefaultNodeDetailsHtml();
    document.getElementById('doc-details').innerHTML = '<p style="color: #64748b; font-style: italic; font-size: 13px;">No architectural documentation found for this node.</p>';
    document.getElementById('raw-details').innerHTML = '<p style="color: #64748b; font-style: italic; font-size: 13px;">Documentation stream unavailable.</p>';
}

// ==========================================
// FLOATING HTML LABELS (HUD)
// ==========================================
function syncFloatingLabels() {
    const container = document.getElementById('hud-labels-layer');
    if (!Graph || !graphDataGlobal) {
        requestAnimationFrame(syncFloatingLabels);
        return;
    }

    const activeClusterLvl = focusedClusterPrefix && clusterGroups[focusedClusterPrefix]
        ? clusterGroups[focusedClusterPrefix].level
        : 0;

    Object.entries(clusterGroups).forEach(([name, grp]) => {
        const lvl = grp.level || 1;
        const validCount = grp.length;
        if (validCount === 0) return;

        let sumX = 0, sumY = 0, sumZ = 0;
        let count = 0;
        grp.forEach(n => {
            if (typeof n.x === 'number') {
                sumX += n.x; sumY += n.y; sumZ += n.z;
                count++;
            }
        });
        if (count === 0) return;

        const avgX = sumX / count;
        const avgY = (sumY / count) + (CONFIG.camera.badgeYOffset[lvl] || 10);
        const avgZ = sumZ / count;

        const screenPos = Graph.graph2ScreenCoords(avgX, avgY, avgZ);
        const safeKey = 'cluster-' + btoa(encodeURIComponent(name)).replace(/=/g, '');
        let badge = document.getElementById(safeKey);

        if (!badge) {
            badge = document.createElement('div');
            badge.id = safeKey;
            badge.className = 'hud-cluster-badge';

            const colors = CONFIG.colors.levels[lvl] || CONFIG.colors.levels[10];
            badge.style.borderColor = `rgba(${colors.rgb}, 0.75)`;
            badge.style.color = colors.hex;
            badge.style.textShadow = `0 0 8px rgba(${colors.rgb}, 0.4)`;

            if (lvl === 1) {
                badge.style.fontSize = '12px';
                badge.innerHTML = `${grp.shortName} <span>[${validCount}]</span>`;
            } else if (lvl === 2) {
                badge.style.fontSize = '10px';
                badge.innerHTML = `${grp.shortName} <span>[${validCount}]</span>`;
            } else {
                badge.style.fontSize = Math.max(6, 11 - lvl) + 'px'; // Shrinks slowly for deeper levels
                badge.innerHTML = `↳ ${grp.shortName} <span>[${validCount}]</span>`;
            }

            badge.onclick = (e) => {
                e.stopPropagation();
                focusCluster(name);
            };
            container.appendChild(badge);
        }

        let isVisible = false;
        let badgeOpacity = 0;

        if (focusedNode) {
            const nLevels = focusedNode._levels || [];
            const parentKey = nLevels.length > 1 ? nLevels.slice(0, -1).join(' / ') : null;
            const rootKey = nLevels[0];

            if (name === focusedNode.subsystem) {
                isVisible = true; badgeOpacity = 1.0;
            } else if (name === parentKey && focusedNode.subsystem !== parentKey) {
                isVisible = true; badgeOpacity = 0.8;
            } else if (name === rootKey && focusedNode.subsystem !== rootKey) {
                isVisible = true; badgeOpacity = 0.5;
            }
        } else if (focusedClusterPrefix) {
            const focusedGrp = clusterGroups[focusedClusterPrefix];
            const parentKey = focusedGrp ? focusedGrp.parentKey : null;
            const grandParentKey = (focusedGrp && parentKey && clusterGroups[parentKey]) ? clusterGroups[parentKey].parentKey : null;

            if (name === focusedClusterPrefix) {
                isVisible = true; badgeOpacity = 1.0;
            } else if (name.startsWith(focusedClusterPrefix + ' / ') && lvl === activeClusterLvl + 1) {
                isVisible = true; badgeOpacity = 0.92;
            } else if (name === parentKey) {
                isVisible = true; badgeOpacity = 0.8;
            } else if (name === grandParentKey) {
                isVisible = true; badgeOpacity = 0.5;
            }
        } else if (searchMatchingNodes.size === 0) {
            if (lvl === 1) {
                isVisible = true;
                badgeOpacity = 1.0;
            }
        }

        badge.style.left = `${screenPos.x}px`;
        badge.style.top = `${screenPos.y}px`;
        badge.style.opacity = isVisible ? badgeOpacity.toFixed(2) : '0';
        badge.style.pointerEvents = isVisible ? 'auto' : 'none';
    });

    let nodesToLabel = new Set();
    const activeNodeSet = highlightNodes.size > 0 ? highlightNodes : (searchMatchingNodes.size > 0 ? searchMatchingNodes : null);
    
    if (activeNodeSet) {
        if (activeNodeSet.size <= CONFIG.labels.clusterMaxPills) {
            nodesToLabel = new Set(activeNodeSet);
        }
        if (focusedNode) nodesToLabel.add(focusedNode.id);
    }

    const existingPills = container.querySelectorAll('.hud-floating-pill');
    existingPills.forEach(pill => {
        const nodeId = pill.dataset.nodeId;
        if (!nodesToLabel.has(nodeId)) {
            pill.remove();
        }
    });

    nodesToLabel.forEach(nodeId => {
        const node = graphDataGlobal.nodes.find(n => n.id === nodeId);
        if (!node || typeof node.x !== 'number') return;

        const screenPos = Graph.graph2ScreenCoords(node.x, node.y, node.z);
        const pillId = 'pill-' + btoa(encodeURIComponent(node.id)).replace(/=/g, '');
        let pill = document.getElementById(pillId);

        if (!pill) {
            pill = document.createElement('div');
            pill.id = pillId;
            pill.dataset.nodeId = node.id;
            pill.className = 'hud-floating-pill' + (focusedNode && focusedNode.id === node.id ? ' is-target' : '');
            pill.innerText = node.name || node.id.split('/').pop().split('#').pop();
            container.appendChild(pill);
        } else {
            const isTarget = (focusedNode && focusedNode.id === node.id);
            pill.classList.toggle('is-target', isTarget);
        }

        pill.style.left = `${screenPos.x}px`;
        pill.style.top = `${screenPos.y - 14}px`;
        pill.style.opacity = (0.2 + 0.8 * selectionIntensity).toFixed(2);
    });

    requestAnimationFrame(syncFloatingLabels);
}

// ==========================================
// SEARCH INTERFACE
// ==========================================
const searchInput = document.getElementById('hud-search-input');
const searchResults = document.getElementById('hud-search-results');

function setupSearchSystem() {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        focusedClusterPrefix = null;
        semiHighlightNodes.clear();
        rootClusterNodes.clear();

        if (!query) {
            searchResults.style.display = 'none';
            searchMatchingNodes.clear();
            if (highlightNodes.size === 0) animateToSelection(0.0);
            return;
        }

        const matches = graphDataGlobal.nodes.filter(n => {
            const idMatch = (n.id || '').toLowerCase().includes(query);
            const nameMatch = (n.name || '').toLowerCase().includes(query);
            const groupMatch = (n.group || '').toLowerCase().includes(query);
            const subMatch = (n.subsystem || '').toLowerCase().includes(query);
            const summaryMatch = (n.semantic_summary || '').toLowerCase().includes(query);
            const keywordMatch = (n.keywords || []).some(k => k.toLowerCase().includes(query));
            return idMatch || nameMatch || groupMatch || subMatch || summaryMatch || keywordMatch;
        });

        searchMatchingNodes.clear();
        matches.forEach(m => searchMatchingNodes.add(m.id));
        if (highlightNodes.size === 0) animateToSelection(0.85);

        renderSearchResults(matches.slice(0, 15), query);
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        } else if (e.key === 'Escape') {
            if (searchResults.style.display === 'flex') {
                searchResults.style.display = 'none';
                searchInput.blur();
            } else {
                clearSelection();
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

function renderSearchResults(items, query) {
    if (items.length === 0) {
        searchResults.innerHTML = `<div style="padding: 10px; color: #64748b; font-size: 11px; font-style: italic;">No components or keywords matching "${query}"</div>`;
        searchResults.style.display = 'flex';
        return;
    }

    searchResults.innerHTML = '';
    items.forEach(node => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <div class="search-item-header">
                <span class="search-item-title">${node.name || node.id.split('/').pop()}</span>
                <span class="search-item-type">${node.group}</span>
            </div>
            <div class="search-item-path">${node.id}</div>
            ${node.semantic_summary ? `<div class="search-item-summary">${node.semantic_summary}</div>` : ''}
        `;
        item.addEventListener('click', () => {
            searchResults.style.display = 'none';
            searchInput.value = node.name || node.id.split('/').pop();
            searchMatchingNodes.clear();
            focusNodeById(node.id);
        });
        searchResults.appendChild(item);
    });
    searchResults.style.display = 'flex';
}

// ==========================================
// CONFIG PANEL GENERATOR
// ==========================================
function buildConfigUI() {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'cfg-toggle-btn';
    toggleBtn.innerHTML = '⚙️ CONFIG';
    toggleBtn.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 9998;
        background: rgba(3, 10, 19, 0.92); border: 1px solid #00f0ff;
        color: #00f0ff; padding: 8px 12px; border-radius: 8px;
        font-family: 'Inter', sans-serif; font-size: 11px; font-weight: bold;
        cursor: pointer; box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
        display: none;
    `;

    const panel = document.createElement('div');
    panel.id = 'cfg-main-panel';
    panel.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 9999;
        background: rgba(3, 10, 19, 0.92); border: 1px solid #00f0ff;
        padding: 15px; border-radius: 8px; font-family: 'Inter', sans-serif;
        color: #fff; width: 300px; box-shadow: 0 0 20px rgba(0, 240, 255, 0.2);
        max-height: 80vh; overflow-y: auto;
    `;
    panel.innerHTML = `
        <div style="font-weight: bold; color: #00f0ff; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <span>CONFIG TUNER</span>
            <button id="cfg-close-btn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;">&times;</button>
        </div>
        <div style="font-size: 11px; display: flex; flex-direction: column; gap: 8px;">
            
            <label style="display:flex; justify-content:space-between; align-items:center;">
                DAG Mode (Tree Layout): <input type="checkbox" id="cfg-dag" ${CONFIG.dag.enabled ? 'checked' : ''}>
            </label>
            <label style="display:flex; justify-content:space-between;">
                DAG Level Distance: <input type="number" id="cfg-dag-dist" value="${CONFIG.dag.distance}" style="width:60px;background:#021020;border:1px solid #00f0ff;color:#fff;">
            </label>
            <hr style="border-color:#00f0ff; opacity:0.3; margin: 4px 0;">

            <label style="display:flex; justify-content:space-between;" title="Show node labels if cluster size is below this">
                Max Labels (Pills): <input type="number" id="cfg-label-limit" value="${CONFIG.labels.clusterMaxPills}" style="width:60px;background:#021020;border:1px solid #fbbf24;color:#fff;">
            </label>
            <label style="display:flex; justify-content:space-between;" title="Limits how far nodes can fly from cluster center">
                Cluster Limit (Stop Radius): <input type="number" id="cfg-stop-rad" value="${CONFIG.physics.clusterGravity.stopRadiusBase}" style="width:60px;background:#021020;border:1px solid #a855f7;color:#fff;">
            </label>
            <hr style="border-color:#00f0ff; opacity:0.3; margin: 4px 0;">

            <label style="display:flex; justify-content:space-between;">
                Orbit Distance (R1 Base): <input type="number" id="cfg-r1" value="${CONFIG.physics.orbits.base[1]}" style="width:60px;background:#021020;border:1px solid #00f0ff;color:#fff;">
            </label>
            <label style="display:flex; justify-content:space-between;">
                Repulsion (Charge): <input type="number" id="cfg-charge" value="${CONFIG.physics.charge}" style="width:60px;background:#021020;border:1px solid #00f0ff;color:#fff;">
            </label>
            <label style="display:flex; justify-content:space-between;">
                Node Spacing (Link Dist): <input type="number" id="cfg-link-int" value="${CONFIG.physics.links.distance.internal}" style="width:60px;background:#021020;border:1px solid #00f0ff;color:#fff;">
            </label>

            <button id="cfg-apply" style="margin-top:10px; background: #00f0ff; color: #030a13; border: none; padding: 6px; font-weight: bold; cursor: pointer; border-radius: 4px;">APPLY CHANGES</button>
        </div>
    `;
    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);

    document.getElementById('cfg-close-btn').addEventListener('click', () => {
        panel.style.display = 'none';
        toggleBtn.style.display = 'block';
    });

    toggleBtn.addEventListener('click', () => {
        toggleBtn.style.display = 'none';
        panel.style.display = 'block';
    });

    document.getElementById('cfg-apply').addEventListener('click', () => {
        CONFIG.dag.enabled = document.getElementById('cfg-dag').checked;
        CONFIG.dag.distance = parseFloat(document.getElementById('cfg-dag-dist').value);
        CONFIG.labels.clusterMaxPills = parseInt(document.getElementById('cfg-label-limit').value, 10);
        CONFIG.labels.globalMaxPills = CONFIG.labels.clusterMaxPills;
        CONFIG.physics.clusterGravity.stopRadiusBase = parseFloat(document.getElementById('cfg-stop-rad').value);
        CONFIG.physics.orbits.base[1] = parseFloat(document.getElementById('cfg-r1').value);
        CONFIG.physics.charge = parseFloat(document.getElementById('cfg-charge').value);
        CONFIG.physics.links.distance.internal = parseFloat(document.getElementById('cfg-link-int').value);

        buildClusterGroups(graphDataGlobal.nodes);
        if (CONFIG.dag.enabled) {
            Graph.dagMode(CONFIG.dag.mode).dagLevelDistance(CONFIG.dag.distance);
        } else {
            Graph.dagMode(null);
        }
        
        applyGraphPhysicsState();
        Graph.d3ReheatSimulation();
    });
}

// ==========================================
// INITIALIZATION
// ==========================================
const isStaticHost = window.location.pathname.endsWith('.html') || window.location.protocol === 'file:';
const primaryUrl = isStaticHost ? './data.json' : 'data.json';

fetch(primaryUrl)
    .then(res => {
        if (!res.ok) throw new Error('data.json not found, falling back to /api/data');
        return res.json();
    })
    .catch(() => fetch('/api/data').then(res => res.json()))
    .then(data => {
        graphDataGlobal = data;

        document.getElementById('stat-nodes').innerText = data.nodes.length;
        document.getElementById('stat-edges').innerText = data.links.length;

        data.nodes.forEach(n => n.connectionCount = 0);
        data.links.forEach(l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            const sNode = data.nodes.find(n => n.id === sId);
            const tNode = data.nodes.find(n => n.id === tId);
            if(sNode) sNode.connectionCount++;
            if(tNode) tNode.connectionCount++;
        });

        buildClusterGroups(data.nodes);
        setupSearchSystem();
        buildConfigUI();

        const elem = document.getElementById('3d-graph');
        Graph = ForceGraph3D()(elem).graphData(data);

        if (CONFIG.dag.enabled) {
            Graph.dagMode(CONFIG.dag.mode).dagLevelDistance(CONFIG.dag.distance);
        }

        Graph
            .backgroundColor('#030a13')
            .warmupTicks(0)
            .cooldownTime(18000)
            .d3VelocityDecay(0.85)
            .d3AlphaDecay(0.005)
            .enableNodeDrag(false)
            .nodeLabel(node => `
                <div style="background: rgba(2, 16, 32, 0.95); border: 1px solid #00f0ff; border-left: 3px solid #00f0ff; padding: 8px 12px; font-family: 'Inter', sans-serif; box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);">
                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: #00f0ff; letter-spacing: 0.5px;">${node.name || node.id}</div>
                    <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; margin-top: 3px;">SUBSYSTEM: <span style="color: #fff; font-weight: 600;">${node.subsystem}</span> // TYPE: <span style="color: var(--hud-cyan); font-weight: 600;">${node.group}</span></div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 3px;">LINKS: <span style="color: #fff; font-weight: 600;">${node.connectionCount}</span></div>
                </div>
            `)
            .nodeColor(node => {
                const base = getNodeBaseColor(node);
                if (selectionIntensity === 0.0) return `rgb(${base.r}, ${base.g}, ${base.b})`;

                if (searchMatchingNodes.size > 0) {
                    if (searchMatchingNodes.has(node.id)) return CONFIG.colors.levels[1].hex;
                    if (semiHighlightNodes.has(node.id)) {
                        const lvlColor = getLevelColor(node);
                        return `rgba(${lvlColor.rgb}, ${CONFIG.colors.opacities.nodes.sameCluster})`;
                    }
                    const dimAlpha = 1.0 - (1.0 - CONFIG.colors.opacities.nodes.unrelated) * selectionIntensity;
                    return `rgba(${base.r}, ${base.g}, ${base.b}, ${dimAlpha.toFixed(3)})`;
                }

                if (highlightNodes.has(node.id)) {
                    if (focusedNode && focusedNode.id === node.id) return '#ffffff';
                    return `rgb(${base.r}, ${base.g}, ${base.b})`;
                }

                if (semiHighlightNodes.has(node.id)) {
                    const lvlColor = getLevelColor(node);
                    const semiAlpha = 1.0 - (1.0 - CONFIG.colors.opacities.nodes.sameCluster) * selectionIntensity;
                    return `rgba(${lvlColor.rgb}, ${semiAlpha.toFixed(3)})`;
                }

                if (rootClusterNodes.has(node.id)) {
                    const lvlColor = getLevelColor(node);
                    const rootAlpha = 1.0 - (1.0 - CONFIG.colors.opacities.nodes.sameRoot) * selectionIntensity;
                    return `rgba(${lvlColor.rgb}, ${rootAlpha.toFixed(3)})`;
                }

                const dimAlpha = 1.0 - (1.0 - CONFIG.colors.opacities.nodes.unrelated) * selectionIntensity;
                return `rgba(${base.r}, ${base.g}, ${base.b}, ${dimAlpha.toFixed(3)})`;
            })
            .nodeVal(node => {
                if (focusedNode && focusedNode.id === node.id) return 14;
                if (highlightNodes.has(node.id)) return 7;
                if (semiHighlightNodes.has(node.id)) return 5.2;
                if (searchMatchingNodes.size > 0 && searchMatchingNodes.has(node.id)) return 10;
                return node.group === 'module' ? 7 : 3.8;
            })
            .nodeResolution(18)
            .linkColor(link => {
                const base = getLinkBaseColor(link);
                const sId = typeof link.source === 'object' ? link.source.id : link.source;
                const tId = typeof link.target === 'object' ? link.target.id : link.target;

                if (selectionIntensity === 0.0) return `rgba(${base.r}, ${base.g}, ${base.b}, 0.25)`;
                
                if (highlightLinks.has(link)) {
                    const alpha = 0.25 + (CONFIG.colors.opacities.links.focused - 0.25) * selectionIntensity;
                    return `rgba(${base.r}, ${base.g}, ${base.b}, ${alpha.toFixed(3)})`;
                }

                if (searchMatchingNodes.size > 0 && searchMatchingNodes.has(sId) && searchMatchingNodes.has(tId)) {
                    const alpha = 0.25 + (CONFIG.colors.opacities.links.internalCluster - 0.25) * selectionIntensity;
                    return `rgba(${base.r}, ${base.g}, ${base.b}, ${alpha.toFixed(3)})`;
                }

                if (semiHighlightNodes.has(sId) && semiHighlightNodes.has(tId)) {
                    return `rgba(${base.r}, ${base.g}, ${base.b}, ${CONFIG.colors.opacities.links.siblingCluster})`;
                }

                const alpha = 0.25 - (0.25 - CONFIG.colors.opacities.links.unrelated) * selectionIntensity;
                return `rgba(30, 41, 59, ${alpha.toFixed(3)})`;
            })
            .linkWidth(link => {
                const sId = typeof link.source === 'object' ? link.source.id : link.source;
                const tId = typeof link.target === 'object' ? link.target.id : link.target;
                if (selectionIntensity > 0) {
                    if (highlightLinks.has(link)) return 0.8 + (2.2 - 0.8) * selectionIntensity;
                    if (searchMatchingNodes.size > 0 && searchMatchingNodes.has(sId) && searchMatchingNodes.has(tId)) return 0.8 + (1.2 - 0.8) * selectionIntensity;
                }
                return 0.8;
            })
            .linkDirectionalParticles(link => {
                if (selectionIntensity === 0.0) return 2;
                if (highlightLinks.has(link)) return 4;
                const sId = typeof link.source === 'object' ? link.source.id : link.source;
                const tId = typeof link.target === 'object' ? link.target.id : link.target;
                if (searchMatchingNodes.size > 0 && searchMatchingNodes.has(sId) && searchMatchingNodes.has(tId)) return 2;
                return 0;
            })
            .linkDirectionalParticleColor(link => {
                const base = getLinkBaseColor(link);
                return `rgb(${base.r}, ${base.g}, ${base.b})`;
            })
            .linkDirectionalParticleWidth(link => highlightLinks.has(link) ? 2.5 : 1.5)
            .linkDirectionalParticleSpeed(link => {
                const baseSpeed = highlightLinks.has(link) ? 0.012 : 0.005;
                const rel = (link.relation || '').toLowerCase();
                return (rel === 'imports') ? -baseSpeed : baseSpeed;
            })
            .onNodeClick(node => {
                highlightNodes.clear();
                semiHighlightNodes.clear();
                rootClusterNodes.clear();
                highlightLinks.clear();
                searchMatchingNodes.clear();
                focusedClusterPrefix = null;

                const container = document.getElementById('hud-labels-layer');
                container.querySelectorAll('.hud-floating-pill').forEach(el => el.remove());

                const neighborPills = [];

                if (node) {
                    focusedNode = node;
                    highlightNodes.add(node.id);

                    graphDataGlobal.links.forEach(link => {
                        const sId = typeof link.source === 'object' ? link.source.id : link.source;
                        const tId = typeof link.target === 'object' ? link.target.id : link.target;
                        if (sId === node.id || tId === node.id) {
                            highlightLinks.add(link);
                            highlightNodes.add(sId);
                            highlightNodes.add(tId);

                            const isOut = (sId === node.id);
                            const otherId = isOut ? tId : sId;
                            const otherName = otherId.split('#').pop().split('/').pop();
                            const rel = link.relation || (isOut ? 'targets' : 'source');
                            neighborPills.push({ id: otherId, name: otherName, relation: rel, dir: isOut ? '→' : '←' });
                        }
                    });

                    // Highlight parent cluster siblings
                    const levels = node._levels || [node.subsystem];
                    const parentClusterKey = levels.length > 1 ? levels.slice(0, -1).join(' / ') : levels[0];
                    const parentCluster = clusterGroups[parentClusterKey] || [];
                    parentCluster.forEach(sibling => {
                        if (!highlightNodes.has(sibling.id)) semiHighlightNodes.add(sibling.id);
                    });

                    // Highlight root cluster items
                    const rootClusterKey = levels[0];
                    const rootCluster = clusterGroups[rootClusterKey] || [];
                    rootCluster.forEach(rNode => {
                        if (!highlightNodes.has(rNode.id) && !semiHighlightNodes.has(rNode.id)) {
                            rootClusterNodes.add(rNode.id);
                        }
                    });

                    const distance = 320;
                    const distRatio = 1 + distance / (Math.hypot(node.x, node.y, node.z) || 1);
                    Graph.cameraPosition(
                        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                        node,
                        1200
                    );

                    animateToSelection(1.0);
                }

                document.getElementById('panel-title').innerText = node.name || 'COMPONENT';

                const levels = node._levels || [node.subsystem];
                const breadcrumbHtml = levels.map((lvlName, idx) => {
                    const key = levels.slice(0, idx + 1).join(' / ');
                    return `<span style="color: var(--hud-cyan); font-weight: 600; cursor: pointer; text-decoration: underline;" onclick="focusCluster('${key}')">${lvlName}</span>`;
                }).join(' <span style="color: #64748b;">/</span> ');

                let specsHtml = `<div class="property"><span class="prop-title">IDENTIFIER / PATH</span><strong style="color: #fff; word-break: break-all; font-family: 'JetBrains Mono', monospace; font-size: 11px;">${node.id}</strong></div>`;
                specsHtml += `<div class="property"><span class="prop-title">CLUSTER HIERARCHY (CLICK TO FOCUS)</span><div>${breadcrumbHtml}</div></div>`;
                
                const parentClusterName = levels.length > 1 ? levels.slice(0, -1).join(' / ') : levels[0];
                specsHtml += `<div class="property"><span class="prop-title">PARENT CLUSTER SIBLINGS</span><span style="color: #cbd5e1; font-size: 12px;">${semiHighlightNodes.size} semi-highlighted in <strong>${parentClusterName}</strong></span></div>`;
                specsHtml += `<div class="property"><span class="prop-title">COMPONENT TYPE</span><span style="color: #93c5fd; font-weight: 600;">${node.group}</span></div>`;
                specsHtml += `<div class="property"><span class="prop-title">CONNECTIONS (CENTRALITY)</span><span style="color: #fff; font-weight: 600;">${node.connectionCount} Links</span></div>`;

                if (node.signature) {
                    specsHtml += `<div class="property"><span class="prop-title">SIGNATURE</span><div class="signature-box">${node.signature}</div></div>`;
                }

                if (node.semantic_summary) {
                    specsHtml += `<div class="property"><span class="prop-title">SEMANTIC SUMMARY</span><div class="value-box">${node.semantic_summary}</div></div>`;
                }

                if (neighborPills.length > 0) {
                    specsHtml += `<div class="property"><span class="prop-title">CONNECTED GRAPH RELATIONS (${neighborPills.length})</span>`;
                    specsHtml += `<div class="pill-list">`;
                    
                    neighborPills.forEach(p => {
                        const baseColor = getLinkBaseColor({ relation: p.relation });
                        const rgbStr = `${baseColor.r}, ${baseColor.g}, ${baseColor.b}`;
                        
                        specsHtml += `
                            <div class="pill-item" onclick="focusNodeById('${p.id}')" style="border-left: 3px solid rgb(${rgbStr});">
                                <span style="color: #e2e8f0;">${p.dir} ${p.name}</span>
                                <span class="pill-relation" style="color: rgb(${rgbStr}); font-weight: bold; text-shadow: 0 0 5px rgba(${rgbStr}, 0.5);">${p.relation}</span>
                            </div>
                        `;
                    });
                    
                    specsHtml += `</div></div>`;
                }

                if (node.keywords && node.keywords.length > 0) {
                    specsHtml += `<div class="property"><span class="prop-title">KEYWORDS</span><div class="tag-container">${node.keywords.map(kw => `<span class="tag">${kw}</span>`).join('')}</div></div>`;
                }

                document.getElementById('node-details').innerHTML = specsHtml;

                let docHtml = '';
                if (node.human_overview) {
                    docHtml += `<div class="property"><span class="prop-title">OVERVIEW & PURPOSE</span><div class="value-box" style="border-left: 2px solid var(--hud-cyan);">${node.human_overview}</div></div>`;
                }
                if (node.side_effects) {
                    docHtml += `<div class="property"><span class="prop-title">SIDE EFFECTS & BEHAVIOR</span><div class="value-box" style="border-left: 2px solid var(--hud-red); color: #fca5a5;">${node.side_effects}</div></div>`;
                }
                if (!node.human_overview && !node.side_effects) {
                    docHtml = `<p style="color: #64748b; font-style: italic; font-size: 13px;">No architectural documentation found for this component.</p>`;
                }
                document.getElementById('doc-details').innerHTML = docHtml;

                if (node.raw_markdown && typeof marked !== 'undefined') {
                    document.getElementById('raw-details').innerHTML = `<div class="markdown-rendered">${marked.parse(node.raw_markdown)}</div>`;
                } else if (node.raw_markdown) {
                    document.getElementById('raw-details').innerText = node.raw_markdown;
                } else {
                    document.getElementById('raw-details').innerHTML = `<p style="color: #64748b; font-style: italic; font-size: 13px;">No documentation file linked to this component.</p>`;
                }
            })
            .onBackgroundClick(() => {
                clearSelection();
            });

        applyGraphPhysicsState();

        resetCamera();
        syncFloatingLabels();
        
        document.getElementById('node-details').innerHTML = getDefaultNodeDetailsHtml();
    });