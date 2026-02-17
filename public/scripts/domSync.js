let nodeCounter = 0;

function nextId() {
  nodeCounter += 1;
  return `node_${nodeCounter}`;
}

function walkNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return { id: nextId(), type: 'text', text: node.textContent };
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const children = [];
  Array.from(node.childNodes).forEach((child) => {
    const mapped = walkNode(child);
    if (mapped) children.push(mapped);
  });
  return {
    id: nextId(),
    type: 'element',
    tag: node.tagName.toLowerCase(),
    attrs: Object.fromEntries(Array.from(node.attributes).map((a) => [a.name, a.value])),
    children
  };
}

function cssMapFromText(cssText) {
  const map = new Map();
  const blocks = cssText.split('}');
  blocks.forEach((block) => {
    const [selector, decls] = block.split('{');
    if (!selector || !decls) return;
    map.set(selector.trim(), decls.trim());
  });
  return map;
}

function applyIdsToLiveDom(docBody, model) {
  const queue = [{ live: docBody, m: model }];
  while (queue.length) {
    const { live, m } = queue.shift();
    if (!live || !m || m.type !== 'element') continue;
    live.setAttribute('data-scene-id', m.id);
    let liveIndex = 0;
    for (const childModel of m.children) {
      if (childModel.type === 'text') continue;
      const liveChild = live.children[liveIndex];
      queue.push({ live: liveChild, m: childModel });
      liveIndex += 1;
    }
  }
}

export function parseInitialFiles(html, css) {
  nodeCounter = 0;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const bodyModel = walkNode(doc.body);
  return {
    documentModel: bodyModel,
    cssRules: cssMapFromText(css)
  };
}

export function injectIntoIframe(iframe, html, css, js, model) {
  const src = `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}</body><script>${js}<\/script></html>`;
  iframe.srcdoc = src;
  return new Promise((resolve) => {
    iframe.onload = () => {
      applyIdsToLiveDom(iframe.contentDocument.body, model);
      resolve();
    };
  });
}

export function updateElementStyle(iframe, nodeId, prop, value) {
  const target = iframe.contentDocument.querySelector(`[data-scene-id="${nodeId}"]`);
  if (!target) return;
  target.style.setProperty(prop, value);
}

export function executeStructureAction(iframe, nodeId, action, payload = '') {
  const doc = iframe.contentDocument;
  const target = doc.querySelector(`[data-scene-id="${nodeId}"]`);
  if (!target) return null;

  if (action === 'add-child') {
    const el = doc.createElement(payload || 'div');
    el.textContent = 'New element';
    el.setAttribute('data-scene-id', nextId());
    target.appendChild(el);
    return { action, createdId: el.getAttribute('data-scene-id') };
  }
  if (action === 'delete-node') {
    if (target === doc.body) return null;
    const removed = target.getAttribute('data-scene-id');
    target.remove();
    return { action, removedId: removed };
  }
  if (action === 'duplicate-node') {
    const clone = target.cloneNode(true);
    clone.setAttribute('data-scene-id', nextId());
    target.after(clone);
    return { action, createdId: clone.getAttribute('data-scene-id') };
  }
  if (action === 'wrap-div') {
    const wrapper = doc.createElement('div');
    wrapper.setAttribute('data-scene-id', nextId());
    target.parentNode.insertBefore(wrapper, target);
    wrapper.appendChild(target);
    return { action, createdId: wrapper.getAttribute('data-scene-id') };
  }
  return null;
}

export function serializeIframe(iframe) {
  const doc = iframe.contentDocument;
  const html = doc.body.innerHTML;
  const styleTag = doc.querySelector('style');
  const css = styleTag ? styleTag.textContent : '';
  return { html, css };
}
