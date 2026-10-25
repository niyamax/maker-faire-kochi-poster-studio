const LAYERS = ['letters', 'text', 'logo', 'poster'];
const LAYER_LABELS = {letters: 'Lettering', text: 'Supporting text', logo: 'Logo', poster: 'Poster'};
const SAVE_LABELS = {
  idle: 'Local project',
  saving: 'Saving…',
  saved: 'Saved on this device',
  error: 'Changes could not be saved on this device',
};

/**
 * The shell reflects the editor's selection and persistence status. Poster state,
 * undo, file actions and exports remain owned by app.js.
 */
export function mountEditorShell({root = document, initialLayer = 'letters', onSelectLayer = () => {}} = {}) {
  const doc = root.ownerDocument || root;
  const body = doc.body;
  const find = selector => root.querySelector(selector);
  const all = selector => [...root.querySelectorAll(selector)];
  const disposers = [];
  let selectedLayer = LAYERS.includes(initialLayer) ? initialLayer : 'letters';
  let inspector = body.dataset.inspector === 'properties' ? 'properties' : 'content';

  function listen(element, name, callback) {
    if (!element) return;
    element.addEventListener(name, callback);
    disposers.push(() => element.removeEventListener(name, callback));
  }

  function setInspector(value) {
    if (!['content', 'properties'].includes(value)) return;
    inspector = value;
    body.dataset.inspector = value;
    for (const button of all('[data-workspace-tab]')) {
      button.setAttribute('aria-pressed', String(button.dataset.workspaceTab === value));
    }
  }

  function syncSelection(layer = 'poster', label, {showProperties = true} = {}) {
    selectedLayer = LAYERS.includes(layer) ? layer : 'poster';
    body.dataset.selectedLayer = selectedLayer;
    for (const button of all('[data-editor-layer]')) {
      button.setAttribute('aria-pressed', String(button.dataset.editorLayer === selectedLayer));
    }
    for (const section of all('[data-properties-for]')) {
      const contexts = section.dataset.propertiesFor.trim().split(/\s+/);
      section.hidden = !contexts.includes('all') && !contexts.includes(selectedLayer);
    }
    const title = find('#selection-title');
    if (title) title.textContent = label || LAYER_LABELS[selectedLayer];
    if (showProperties) setInspector('properties');
  }

  function setSaveStatus(value, message) {
    const status = Object.hasOwn(SAVE_LABELS, value) ? value : 'idle';
    const output = find('#save-state');
    if (!output) return;
    output.dataset.saveStatus = status;
    output.setAttribute('role', 'status');
    output.setAttribute('aria-live', 'polite');
    output.textContent = message || SAVE_LABELS[status];
  }

  function chooseLayer(button) {
    const layer = button.dataset.editorLayer;
    if (!LAYERS.includes(layer)) return;
    syncSelection(layer);
    onSelectLayer(layer);
    if(!button.getClientRects().length)find('[data-workspace-tab="properties"]')?.focus({preventScroll:true});
  }

  for (const button of all('[data-editor-layer]')) {
    listen(button, 'click', () => chooseLayer(button));
    listen(button, 'keydown', event => {
      const group=button.closest('.layer-list')||root;
      const buttons = [...group.querySelectorAll('[data-editor-layer]')].filter(item => !item.disabled && item.getClientRects().length);
      const index = buttons.indexOf(button);
      let next;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      buttons[next].focus({preventScroll: true});
      chooseLayer(buttons[next]);
    });
  }

  for (const button of all('[data-workspace-tab]')) {
    listen(button, 'click', () => setInspector(button.dataset.workspaceTab));
    listen(button, 'keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = all('[data-workspace-tab]').filter(item => !item.disabled && !item.hidden);
      const index = buttons.indexOf(button);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[next].focus({preventScroll: true});
      setInspector(buttons[next].dataset.workspaceTab);
    });
  }

  const menus = ['project', 'export'].map(id => ({
    button: find(`#${id}-menu-toggle`),
    panel: find(`#${id}-menu`),
  })).filter(menu => menu.button && menu.panel);

  function menuItems(menu) {
    return [...new Set(menu.panel.querySelectorAll('button, a[href], [role="menuitem"]'))]
      .filter(item => !item.disabled && !item.hidden && item.getAttribute('aria-disabled') !== 'true');
  }

  function closeMenu(menu, restoreFocus = false) {
    menu.panel.hidden = true;
    menu.button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) menu.button.focus({preventScroll: true});
  }

  function openMenu(menu, last = false) {
    for (const other of menus) if (other !== menu) closeMenu(other);
    menu.panel.hidden = false;
    menu.button.setAttribute('aria-expanded', 'true');
    const items = menuItems(menu);
    (last ? items.at(-1) : items[0])?.focus({preventScroll: true});
  }

  for (const menu of menus) {
    menu.button.setAttribute('aria-controls', menu.panel.id);
    menu.button.setAttribute('aria-haspopup', 'menu');
    menu.panel.setAttribute('role', 'menu');
    for (const item of menuItems(menu)) {
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
    }
    closeMenu(menu);
    listen(menu.button, 'click', () => menu.panel.hidden ? openMenu(menu) : closeMenu(menu));
    listen(menu.button, 'keydown', event => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      openMenu(menu, event.key === 'ArrowUp');
    });
    listen(menu.panel, 'click', event => {
      if (menuItems(menu).some(item => item === event.target || item.contains(event.target))) closeMenu(menu, true);
    });
    listen(menu.panel, 'keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeMenu(menu, true);
        return;
      }
      if (event.key === 'Tab') {
        // Return to the trigger before the browser performs its normal Tab step.
        closeMenu(menu, true);
        return;
      }
      const items = menuItems(menu), index = items.indexOf(doc.activeElement);
      let next;
      if (event.key === 'ArrowDown') next = (index + 1) % items.length;
      if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = items.length - 1;
      if (next === undefined || !items.length) return;
      event.preventDefault();
      items[next].focus({preventScroll: true});
    });
    listen(menu.panel, 'focusout', event => {
      if (!menu.panel.contains(event.relatedTarget) && event.relatedTarget !== menu.button) closeMenu(menu);
    });
  }
  listen(doc, 'pointerdown', event => {
    for (const menu of menus) if (!menu.panel.contains(event.target) && !menu.button.contains(event.target)) closeMenu(menu);
  });

  setInspector(inspector);
  syncSelection(selectedLayer, undefined, {showProperties: false});

  return {
    syncSelection,
    setInspector,
    setSaveStatus,
    destroy() { for (const dispose of disposers.splice(0)) dispose(); },
  };
}
