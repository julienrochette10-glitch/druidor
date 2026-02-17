function createInput(tool) {
  if (tool.type === 'slider') {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = tool.min ?? 0;
    input.max = tool.max ?? 100;
    input.value = tool.defaultValue;
    return input;
  }
  if (tool.type === 'toggle') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(tool.defaultValue);
    return input;
  }
  if (tool.type === 'color') {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = tool.defaultValue || '#ffffff';
    return input;
  }
  const input = document.createElement('input');
  input.type = 'text';
  input.value = tool.defaultValue || '';
  return input;
}

export function renderTools(container, registry, onApply) {
  container.innerHTML = '';
  registry.families.forEach((family) => {
    const section = document.createElement('section');
    section.className = 'family-section';

    const title = document.createElement('h3');
    title.textContent = family;
    section.appendChild(title);

    const tools = registry.tools.filter((tool) => tool.family === family);
    tools.forEach((tool) => {
      const row = document.createElement('label');
      row.className = 'tool-row';
      row.title = tool.tooltip || '';

      const name = document.createElement('span');
      name.textContent = tool.name;
      row.appendChild(name);

      const input = createInput(tool);
      input.addEventListener(tool.type === 'script' ? 'click' : 'input', () => {
        const value = tool.type === 'toggle' ? input.checked : input.value;
        onApply(tool, value);
      });
      row.appendChild(input);

      section.appendChild(row);
    });

    container.appendChild(section);
  });
}
