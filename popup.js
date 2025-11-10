let allTabs = [];

async function loadTabs() {
  allTabs = await chrome.tabs.query({});
  updateStats();
  renderTabs(allTabs);
}

function updateStats() {
  document.getElementById('tabCount').textContent = allTabs.length;
  chrome.windows.getAll().then(windows => {
    document.getElementById('windowCount').textContent = windows.length;
  });
}

function renderTabs(tabs) {
  const container = document.getElementById('tabsContainer');
  
  if (tabs.length === 0) {
    container.innerHTML = '<div class="empty-state">No tabs found</div>';
    return;
  }
  
  container.innerHTML = '';
  
  tabs.forEach(tab => {
    const tabItem = document.createElement('div');
    tabItem.className = `tab-item ${tab.active ? 'active' : ''}`;
    tabItem.dataset.id = tab.id;
    
    // Favicon
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23666"/></svg>';
    favicon.alt = '';
    
    // Tab info
    const tabInfo = document.createElement('div');
    tabInfo.className = 'tab-info';
    
    const tabTitle = document.createElement('div');
    tabTitle.className = 'tab-title';
    tabTitle.textContent = tab.title;
    
    const tabUrl = document.createElement('div');
    tabUrl.className = 'tab-url';
    try {
      tabUrl.textContent = new URL(tab.url).hostname;
    } catch (e) {
      tabUrl.textContent = tab.url;
    }
    
    tabInfo.appendChild(tabTitle);
    tabInfo.appendChild(tabUrl);
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.dataset.id = tab.id;
    
    tabItem.appendChild(favicon);
    tabItem.appendChild(tabInfo);
    tabItem.appendChild(closeBtn);
    container.appendChild(tabItem);
    
    // Click handler for tab item
    tabItem.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) return;
      chrome.tabs.update(tab.id, { active: true });
      chrome.tabs.get(tab.id).then(t => {
        chrome.windows.update(t.windowId, { focused: true });
      });
    });
    
    // Click handler for close button
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.tabs.remove(tab.id);
      loadTabs();
    });
  });
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allTabs.filter(tab => 
    tab.title.toLowerCase().includes(query) || 
    tab.url.toLowerCase().includes(query)
  );
  renderTabs(filtered);
});

// Group by domain
document.getElementById('groupByDomain').addEventListener('click', async () => {
  const domains = {};
  
  allTabs.forEach(tab => {
    try {
      const domain = new URL(tab.url).hostname;
      if (!domains[domain]) domains[domain] = [];
      domains[domain].push(tab.id);
    } catch (e) {}
  });
  
  for (const [domain, tabIds] of Object.entries(domains)) {
    if (tabIds.length > 1) {
      const group = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(group, { 
        title: domain,
        collapsed: false
      });
    }
  }
  
  loadTabs();
});

// Close duplicates
document.getElementById('closeDuplicates').addEventListener('click', async () => {
  const urls = new Set();
  const toClose = [];
  
  allTabs.forEach(tab => {
    if (urls.has(tab.url)) {
      toClose.push(tab.id);
    } else {
      urls.add(tab.url);
    }
  });
  
  if (toClose.length > 0) {
    await chrome.tabs.remove(toClose);
    loadTabs();
  }
});

// Close other tabs
document.getElementById('closeOtherTabs').addEventListener('click', async () => {
  const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
  const toClose = allTabs
    .filter(tab => tab.id !== currentTab[0].id && tab.windowId === currentTab[0].windowId)
    .map(tab => tab.id);
  
  if (toClose.length > 0) {
    await chrome.tabs.remove(toClose);
    loadTabs();
  }
});

// Suspend inactive tabs
document.getElementById('suspendTabs').addEventListener('click', async () => {
  const inactiveTabs = allTabs.filter(tab => !tab.active && !tab.audible);
  
  for (const tab of inactiveTabs.slice(0, 10)) {
    await chrome.tabs.discard(tab.id);
  }
  
  loadTabs();
});

// Initial load
loadTabs();

// Listen for tab changes
chrome.tabs.onCreated.addListener(loadTabs);
chrome.tabs.onRemoved.addListener(loadTabs);
chrome.tabs.onUpdated.addListener(loadTabs);