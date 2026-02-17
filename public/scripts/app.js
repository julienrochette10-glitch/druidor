import { EditorState } from './editorState.js';
import {
  parseInitialFiles,
  injectIntoIframe,
  updateElementStyle,
  executeStructureAction,
  serializeIframe
} from './domSync.js';
import { ToolEngine } from './toolEngine.js';
import { renderTools } from './toolRenderer.js';

const state = new EditorState();
const iframe = document.getElementById('sandboxFrame');
const overlay = document.getElementById('selectionOverlay');
const inspectorTree = document.getElementById('inspectorTree');
const toolPanel = document.getElementById('toolPanel');
const contextMenu = document.getElementById('contextMenu');

const api = {
  async loadFiles(paths) {
    const res = await fetch('/api/load-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paths)
    });
    return res.json();
  },
  async saveFiles(files) {
    const res = await fetch('/api/save-files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(files)
    });
    return res.json();
  },
  async getTools() {
    const res = await fetch('/api/tools');
    return res.json();
  },
  async addTool(tool) {
    const res = await fetch('/api/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tool)
    });
    return res.json();
  },
  applyStyle: updateElementStyle,
  executeAction: executeStructureAction
};

const toolEngine = new ToolEngine(state, api);

function treeFromLive(node) {
  const model = {
    id: node.getAttribute?.('data-scene-id') || null,
    tag: node.tagName?.toLowerCase(),
    children: []
  };
  Array.from(node.children || []).forEach((child) => model.children.push(treeFromLive(child)));
  return model;
}

function renderInspector(model, host = inspectorTree, depth = 0) {
  if (!model) return;
  const div = document.createElement('div');
  div.className = 'tree-node';
  if (model.id === state.getState().selectedNodeId) div.classList.add('active');
  div.style.marginLeft = `${depth * 12}px`;
  div.textContent = `<${model.tag || 'node'}>`;
  div.onclick = () => selectNode(model.id);
  host.appendChild(div);
  model.children.forEach((child) => renderInspector(child, host, depth + 1));
}

function refreshInspector() {
  inspectorTree.innerHTML = '';
  if (!iframe.contentDocument?.body) return;
  renderInspector(treeFromLive(iframe.contentDocument.body));
}

function positionOverlay() {
  const id = state.getState().selectedNodeId;
  if (!id || !iframe.contentDocument) {
    overlay.style.display = 'none';
    return;
  }
  const target = iframe.contentDocument.querySelector(`[data-scene-id="${id}"]`);
  if (!target) return;
  const r = target.getBoundingClientRect();
  const ir = iframe.getBoundingClientRect();
  overlay.style.left = `${ir.left + r.left}px`;
  overlay.style.top = `${ir.top + r.top}px`;
  overlay.style.width = `${r.width}px`;
  overlay.style.height = `${r.height}px`;
  overlay.style.display = 'block';
}

function selectNode(id) {
  state.set({ selectedNodeId: id }, 'select-node');
  refreshInspector();
  positionOverlay();
}

function bindIframeEvents() {
  iframe.contentDocument.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const node = event.target.closest('[data-scene-id]');
    if (node) selectNode(node.getAttribute('data-scene-id'));
  });

  iframe.contentDocument.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const node = event.target.closest('[data-scene-id]');
    if (node) selectNode(node.getAttribute('data-scene-id'));
    contextMenu.style.left = `${event.clientX + iframe.getBoundingClientRect().left}px`;
    contextMenu.style.top = `${event.clientY + iframe.getBoundingClientRect().top}px`;
    contextMenu.classList.remove('hidden');
  });
}

async function initialLoad() {
  const htmlPath = prompt('Chemin fichier HTML (ex: examples/page.html)');
  const cssPath = prompt('Chemin fichier CSS');
  const jsPath = prompt('Chemin fichier JS');
  if (!htmlPath || !cssPath || !jsPath) return;

  const payload = await api.loadFiles({ htmlPath, cssPath, jsPath });
  const parsed = parseInitialFiles(payload.files.html.content, payload.files.css.content);
  state.set(
    {
      files: payload.files,
      documentModel: parsed.documentModel,
      cssRules: parsed.cssRules,
      jsAnalysis: payload.jsAnalysis
    },
    'initial-load'
  );

  await injectIntoIframe(
    iframe,
    payload.files.html.content,
    payload.files.css.content,
    payload.files.js.content,
    parsed.documentModel
  );
  bindIframeEvents();
  refreshInspector();
}

function setupUi() {
  document.getElementById('loadBtn').onclick = initialLoad;
  document.getElementById('saveBtn').onclick = async () => {
    const current = state.getState();
    const serialized = serializeIframe(iframe);
    await api.saveFiles({
      html: { path: current.files.html.path, content: serialized.html },
      css: { path: current.files.css.path, content: serialized.css },
      js: { path: current.files.js.path, content: current.files.js.content }
    });
    alert('Fichiers sauvegardés');
  };

  document.getElementById('undoBtn').onclick = () => state.undo();
  document.getElementById('redoBtn').onclick = () => state.redo();

  document.getElementById('gridToggle').onchange = (e) => {
    document.getElementById('sandboxViewport').classList.toggle('grid-enabled', e.target.checked);
  };
  document.getElementById('wireToggle').onchange = (e) => {
    document.querySelector('.sandbox-wrap').classList.toggle('wireframe', e.target.checked);
  };

  document.getElementById('zoomIn').onclick = () => {
    const vp = state.getState().viewport;
    vp.zoom = Math.min(2.5, vp.zoom + 0.1);
    iframe.style.transform = `scale(${vp.zoom}) translate(${vp.panX}px, ${vp.panY}px)`;
    document.getElementById('zoomValue').textContent = `${Math.round(vp.zoom * 100)}%`;
  };
  document.getElementById('zoomOut').onclick = () => {
    const vp = state.getState().viewport;
    vp.zoom = Math.max(0.3, vp.zoom - 0.1);
    iframe.style.transform = `scale(${vp.zoom}) translate(${vp.panX}px, ${vp.panY}px)`;
    document.getElementById('zoomValue').textContent = `${Math.round(vp.zoom * 100)}%`;
  };

  contextMenu.querySelectorAll('button').forEach((btn) => {
    btn.onclick = () => {
      const action = btn.dataset.action;
      const selected = state.getState().selectedNodeId;
      if (!selected) return;
      if (action === 'inject-script') {
        const code = prompt('JS à injecter sur click (ex: alert("hello"))');
        const node = iframe.contentDocument.querySelector(`[data-scene-id="${selected}"]`);
        node?.setAttribute('onclick', code || '');
      } else if (action === 'lock-node') {
        const node = iframe.contentDocument.querySelector(`[data-scene-id="${selected}"]`);
        node?.setAttribute('data-locked', 'true');
      } else {
        executeStructureAction(iframe, selected, action, 'div');
      }
      refreshInspector();
      positionOverlay();
      contextMenu.classList.add('hidden');
    };
  });

  window.addEventListener('click', () => contextMenu.classList.add('hidden'));

  const dialog = document.getElementById('toolDialog');
  document.getElementById('addToolBtn').onclick = () => dialog.showModal();
  document.getElementById('toolForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const tool = Object.fromEntries(fd.entries());
    if (tool.type === 'script') {
      tool.action = tool.property;
      delete tool.property;
    }
    await toolEngine.addTool(tool);
    renderToolPanel();
    dialog.close();
    e.target.reset();
  };
}

function renderToolPanel() {
  renderTools(toolPanel, state.getState().registry, (tool, value) => {
    toolEngine.applyTool(tool, state.getState().selectedNodeId, value, iframe);
    refreshInspector();
    positionOverlay();
  });
}

state.subscribe((_, change) => {
  if (['undo', 'redo'].includes(change)) {
    refreshInspector();
    positionOverlay();
  }
});

setupUi();
await toolEngine.loadRegistry();
renderToolPanel();
