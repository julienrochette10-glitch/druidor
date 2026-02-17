export class EditorState {
  constructor() {
    this.state = {
      documentModel: null,
      selectedNodeId: null,
      files: null,
      cssRules: new Map(),
      jsAnalysis: [],
      registry: { families: [], tools: [] },
      viewport: { zoom: 1, panX: 0, panY: 0, grid: false, wireframe: false }
    };
    this.undoStack = [];
    this.redoStack = [];
    this.subscribers = new Set();
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify(change) {
    this.subscribers.forEach((listener) => listener(this.state, change));
  }

  set(partial, changeType = 'update', track = false) {
    if (track) this.pushHistory(changeType);
    this.state = { ...this.state, ...partial };
    this.notify(changeType);
  }

  pushHistory(label) {
    this.undoStack.push({ snapshot: structuredClone(this.state), label, ts: Date.now() });
    this.redoStack = [];
    if (this.undoStack.length > 120) this.undoStack.shift();
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push({ snapshot: structuredClone(this.state), label: 'redo', ts: Date.now() });
    const prev = this.undoStack.pop();
    this.state = prev.snapshot;
    this.notify('undo');
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push({ snapshot: structuredClone(this.state), label: 'undo', ts: Date.now() });
    const next = this.redoStack.pop();
    this.state = next.snapshot;
    this.notify('redo');
  }
}
