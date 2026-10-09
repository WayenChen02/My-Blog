/* 使用原生 details/summary 折叠 RAG 模块，支持鼠标和键盘操作。 */
(function () {
  const openModules = new Map();

  function titleOf(group, list) {
    return Array.from(group.childNodes)
      .filter(node => node !== list)
      .map(node => node.textContent)
      .join('')
      .trim();
  }

  function enhanceRagSidebar() {
    const sidebar = document.querySelector('.sidebar-nav');
    if (!sidebar) return;

    const root = Array.from(sidebar.querySelectorAll(':scope > ul > li.group'))
      .find(group => titleOf(group, group.querySelector(':scope > ul')) === 'RAG全学习链路');
    if (!root) return;
    root.classList.add('rag-sidebar-root');

    const modules = root.querySelectorAll(':scope > ul > li.group');
    modules.forEach(group => {
      const list = group.querySelector(':scope > ul');
      if (!list) return;
      const title = titleOf(group, list);
      if (!/^\d{2}-/.test(title)) return;

      const details = document.createElement('details');
      details.className = 'rag-module';
      const summary = document.createElement('summary');
      summary.textContent = title;
      details.append(summary, list);
      group.replaceChildren(details);
      group.classList.add('rag-module-group');

      // 深链接与切换文章后，确保当前文章所在目录可见。
      details.open = Boolean(list.querySelector('li[aria-current="page"]')) ||
        Boolean(openModules.get(title));
      details.addEventListener('toggle', () => {
        openModules.set(title, details.open);
      });
    });
  }

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(function (hook) {
    hook.doneEach(enhanceRagSidebar);
  });
})();
