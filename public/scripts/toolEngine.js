export class ToolEngine {
  constructor(state, api) {
    this.state = state;
    this.api = api;
  }

  async loadRegistry() {
    const registry = await this.api.getTools();
    this.state.set({ registry }, 'registry-loaded');
    return registry;
  }

  async addTool(toolDefinition) {
    const registry = await this.api.addTool(toolDefinition);
    this.state.set({ registry }, 'tool-added', true);
    return registry;
  }

  applyTool(tool, selectedId, value, iframe) {
    if (!selectedId) return;
    if (tool.type === 'script') {
      const result = this.api.executeAction(iframe, selectedId, tool.action, value || tool.defaultValue);
      this.state.set({ lastAction: result }, 'structure-action', true);
      return;
    }
    const composedValue = `${value}${tool.unit || ''}`;
    this.api.applyStyle(iframe, selectedId, tool.property, composedValue);
    this.state.set({ lastStyleChange: { selectedId, property: tool.property, value: composedValue } }, 'style-change', true);
  }
}
