(function () {
  const menu = document.querySelector('.mobile-menu');
  const sidebar = document.querySelector('.sidebar');
  if (!menu || !sidebar) return;

  menu.addEventListener('click', function () {
    const open = sidebar.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });

  sidebar.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      sidebar.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
    });
  });

  const contentGrid = document.querySelector('.content-grid');
  const viewNames = ['home', 'wallet', 'channels', 'peers', 'node', 'backup', 'settings'];
  const navLinks = Array.from(document.querySelectorAll('.nav-item, .mobile-nav a'));

  function showView(name) {
    const view = viewNames.indexOf(name) >= 0 ? name : 'home';
    document.querySelectorAll('[data-view]').forEach(function (element) {
      element.hidden = element.getAttribute('data-view') !== view;
    });
    if (contentGrid) {
      contentGrid.hidden = view !== 'channels' && view !== 'node';
    }
    navLinks.forEach(function (link) {
      const active = link.getAttribute('href') === '#' + view;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (window.location.hash !== '#' + view) {
      window.history.replaceState(null, '', '#' + view);
    }
    if (view === 'settings') loadSettings();
    if (view === 'peers') loadPeers();
  }

  function routeFromHash() {
    showView((window.location.hash || '#home').slice(1));
  }

  window.addEventListener('hashchange', routeFromHash);
  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      const target = (link.getAttribute('href') || '#home').slice(1);
      showView(target);
      sidebar.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
    });
  });
  document.querySelectorAll('[data-target]').forEach(function (button) {
    button.addEventListener('click', function () {
      showView(button.getAttribute('data-target'));
    });
  });

  const address = document.querySelector('#deposit-address');
  const generate = document.querySelector('#generate-address');
  const copy = document.querySelector('#copy-address');
  const walletState = document.querySelector('#wallet-state');

  function setAddress(value) {
    if (!address || !copy) return;
    address.textContent = value || 'No address generated yet';
    copy.disabled = !value;
  }

  if (copy) copy.addEventListener('click', function () {
    navigator.clipboard.writeText(address.textContent).then(function () {
      copy.textContent = 'Copied';
      setTimeout(function () { copy.textContent = 'Copy'; }, 1400);
    });
  });

  if (generate) generate.addEventListener('click', function () {
    generate.disabled = true;
    if (walletState) walletState.textContent = 'Generating…';
    fetch('api/v1/wallet/address', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || 'Request failed'); return data; }); })
      .then(function (data) {
        setAddress(data.bech32 || data.address);
        if (walletState) walletState.textContent = 'Address ready';
      })
      .catch(function (error) {
        setAddress('Unable to generate address: ' + error.message);
        if (walletState) walletState.textContent = 'Unavailable';
      })
      .finally(function () { generate.disabled = false; });
  });

  const confirmRecovery = document.querySelector('#confirm-recovery');
  const revealRecovery = document.querySelector('#reveal-recovery');
  const copyRecovery = document.querySelector('#copy-recovery');
  const recoverySecret = document.querySelector('#recovery-secret');
  const recoveryPhrase = document.querySelector('#recovery-phrase');
  const recoveryMessage = document.querySelector('#recovery-message');

  if (revealRecovery) revealRecovery.addEventListener('click', function () {
    if (!confirmRecovery || !confirmRecovery.checked) {
      if (recoveryMessage) recoveryMessage.textContent = 'Confirm that you understand the risk before revealing the phrase.';
      return;
    }
    revealRecovery.disabled = true;
    if (recoveryMessage) recoveryMessage.textContent = 'Loading recovery phrase…';
    fetch('api/v1/recovery/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) })
      .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || 'Request failed'); return data; }); })
      .then(function (data) {
        if (recoveryPhrase) recoveryPhrase.textContent = data.recovery_phrase || '';
        if (recoverySecret) recoverySecret.hidden = false;
        if (copyRecovery) copyRecovery.disabled = !data.recovery_phrase;
        if (recoveryMessage) recoveryMessage.textContent = 'Write it down and store it offline.';
      })
      .catch(function (error) { if (recoveryMessage) recoveryMessage.textContent = error.message; })
      .finally(function () { revealRecovery.disabled = false; });
  });

  if (copyRecovery) copyRecovery.addEventListener('click', function () {
    if (!recoveryPhrase || !recoveryPhrase.textContent) return;
    navigator.clipboard.writeText(recoveryPhrase.textContent).then(function () {
      copyRecovery.textContent = 'Copied';
      setTimeout(function () { copyRecovery.textContent = 'Copy phrase'; }, 1400);
    });
  });

  fetch('api/v1/status')
    .then(function (response) { if (!response.ok) throw new Error('offline'); return response.json(); })
    .then(function (data) {
      const node = data.node || {};
      const network = document.querySelector('#node-network');
      const peers = document.querySelector('#peer-count');
      const channels = document.querySelector('#channel-count');
      const nodeHealth = document.querySelector('#node-health');
      const topHealth = document.querySelector('#top-health');
      const sync = document.querySelector('#bitcoin-sync');
      if (network) network.textContent = node.network || 'Bitcoin';
      if (peers) peers.textContent = data.peers || '0';
      if (channels) channels.textContent = data.channels || '0';
      if (nodeHealth) {
        const bitcoin = data.bitcoin || {};
        nodeHealth.classList.remove('online');
        if (!data.online) {
          nodeHealth.textContent = 'Offline';
        } else if (!bitcoin.available) {
          nodeHealth.textContent = 'Degraded';
        } else if (bitcoin.synced) {
          nodeHealth.classList.add('online');
          nodeHealth.textContent = 'Healthy';
        } else {
          nodeHealth.textContent = 'Syncing';
        }
        const dot = document.createElement('i');
        nodeHealth.prepend(dot);
      }
      if (topHealth) {
        topHealth.classList.toggle('online', Boolean(data.online));
        topHealth.textContent = data.online ? 'Online' : 'Offline';
        const dot = document.createElement('i');
        topHealth.prepend(dot);
      }
      if (sync) {
        const bitcoin = data.bitcoin || {};
        if (!bitcoin.available) {
          sync.innerHTML = '<span class="status-dot danger"></span>Unavailable';
        } else if (bitcoin.synced) {
          sync.innerHTML = '<span class="status-dot good"></span>Synced · block ' + Number(bitcoin.blocks || 0).toLocaleString() + '';
        } else {
          const progress = Number(bitcoin.verification_progress);
          const label = Number.isFinite(progress) && progress > 0 ? 'Syncing · ' + (progress * 100).toFixed(1) + '%' : 'Syncing';
          sync.innerHTML = '<span class="status-dot warning"></span>' + label;
        }
      }
    })
    .catch(function () {
      if (walletState) walletState.textContent = 'CLN offline';
    });

  function msatValue(value) {
    if (value && typeof value === 'object') value = value.msat;
    if (typeof value === 'string') value = value.replace(/msat$/, '');
    return Number(value) || 0;
  }

  fetch('api/v1/wallet')
    .then(function (response) { if (!response.ok) throw new Error('offline'); return response.json(); })
    .then(function (data) {
      const outputs = data.outputs || [];
      const channels = data.channels || [];
      const onchain = Number(data.onchain_confirmed_msat || 0) / 1000;
      const capacity = channels.reduce(function (sum, channel) { return sum + msatValue(channel.amount_msat); }, 0) / 1000;
      const local = channels.reduce(function (sum, channel) { return sum + msatValue(channel.our_amount_msat); }, 0) / 1000;
      const total = Math.floor(onchain + local);
      const onchainElement = document.querySelector('#onchain-balance');
      const capacityElement = document.querySelector('#channel-capacity');
      const totalElement = document.querySelector('#total-balance');
      if (onchainElement) onchainElement.textContent = Math.floor(onchain).toLocaleString();
      if (capacityElement) capacityElement.textContent = Math.floor(capacity).toLocaleString();
      if (totalElement) totalElement.textContent = total.toLocaleString();
      if (walletState && outputs.length) walletState.textContent = 'Wallet ready';
    })
    .catch(function () { /* Status already communicates that CLN is offline. */ });

  const peerSelect = document.querySelector('#peer-select');
  const manualPeer = document.querySelector('#manual-peer-id');
  const connectPeer = document.querySelector('#connect-peer');
  const openChannel = document.querySelector('#open-channel');
  const channelMessage = document.querySelector('#channel-message');
  const peerList = document.querySelector('#peer-list');
  const peerMessage = document.querySelector('#peer-message');

  function selectedPeer() {
    return (manualPeer && manualPeer.value.trim()) || (peerSelect && peerSelect.value) || '';
  }

  function channelPayload(requireConfirmation) {
    const amountElement = document.querySelector('#channel-amount');
    const publicElement = document.querySelector('#public-channel');
    const confirmElement = document.querySelector('#confirm-channel');
    const payload = {
      peer_id: selectedPeer(),
      amount_sat: Number((amountElement && amountElement.value) || 0),
      public: Boolean(publicElement && publicElement.checked),
      confirm: Boolean(confirmElement && confirmElement.checked)
    };
    if (!payload.peer_id) throw new Error('Choose a discovered peer or enter a manual peer ID.');
    if (requireConfirmation && !payload.confirm) throw new Error('Tick the funding confirmation before opening a channel.');
    return payload;
  }

  function post(path, payload) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || 'Request failed'); return data; }); });
  }

  if (connectPeer) connectPeer.addEventListener('click', function () {
    try {
      const payload = channelPayload(false);
      connectPeer.disabled = true;
      if (channelMessage) channelMessage.textContent = 'Connecting to peer…';
      post('api/v1/peers/connect', { peer_id: payload.peer_id })
        .then(function () { if (channelMessage) channelMessage.textContent = 'Peer connection requested.'; })
        .catch(function (error) { if (channelMessage) channelMessage.textContent = error.message; })
        .finally(function () { connectPeer.disabled = false; });
    } catch (error) { if (channelMessage) channelMessage.textContent = error.message; }
  });

  if (openChannel) openChannel.addEventListener('click', function () {
    try {
      const payload = channelPayload(true);
      if (!payload.amount_sat) throw new Error('Enter a channel amount in satoshis.');
      openChannel.disabled = true;
      if (channelMessage) channelMessage.textContent = 'Submitting channel funding request…';
      post('api/v1/channels/open', payload)
        .then(function (data) { if (channelMessage) channelMessage.textContent = 'Channel request accepted: ' + (data.channel_id || 'pending confirmation.'); })
        .catch(function (error) { if (channelMessage) channelMessage.textContent = error.message; })
        .finally(function () { openChannel.disabled = false; });
    } catch (error) { if (channelMessage) channelMessage.textContent = error.message; }
  });

  function renderPeers(peers) {
    if (peerSelect) {
      if (!peerSelect) return;
      peerSelect.innerHTML = '<option value="">Select a discovered peer</option>';
      peers.forEach(function (peer) {
        const option = document.createElement('option');
        option.value = peer.id;
        option.textContent = (peer.alias || 'Unnamed peer') + ' · ' + peer.id.slice(0, 12) + '…';
        peerSelect.appendChild(option);
      });
    }
    if (!peerList) return;
    peerList.innerHTML = '';
    if (!peers.length) {
      peerList.innerHTML = '<p class="muted">No gossip peers discovered yet. Use a manual node ID on the Channels page.</p>';
      return;
    }
    peers.forEach(function (peer) {
      const row = document.createElement('div');
      row.className = 'peer-row';
      row.innerHTML = '<div><strong></strong><small></small></div><button class="button button-light" type="button">Connect</button>';
      row.querySelector('strong').textContent = peer.alias || 'Unnamed peer';
      row.querySelector('small').textContent = peer.id;
      row.querySelector('button').addEventListener('click', function () {
        row.querySelector('button').disabled = true;
        if (peerMessage) peerMessage.textContent = 'Connecting to ' + (peer.alias || peer.id.slice(0, 12)) + '…';
        post('api/v1/peers/connect', { peer_id: peer.id })
          .then(function () { if (peerMessage) peerMessage.textContent = 'Peer connection requested.'; })
          .catch(function (error) { if (peerMessage) peerMessage.textContent = error.message; })
          .finally(function () { row.querySelector('button').disabled = false; });
      });
      peerList.appendChild(row);
    });
  }

  function loadPeers(silent) {
    if (peerMessage && !silent) peerMessage.textContent = 'Loading discovered peers…';
    fetch('api/v1/peers/discovered')
      .then(function (response) { if (!response.ok) throw new Error('Peer discovery unavailable'); return response.json(); })
      .then(function (data) { renderPeers(data.peers || []); if (peerMessage && !silent) peerMessage.textContent = ''; })
      .catch(function (error) {
        if (peerSelect) peerSelect.innerHTML = '<option value="">No discovered peers — use manual ID</option>';
        if (peerList) peerList.innerHTML = '<p class="muted">' + error.message + '</p>';
        if (peerMessage && !silent) peerMessage.textContent = '';
      });
  }

  const refreshPeers = document.querySelector('#refresh-peers');
  if (refreshPeers) refreshPeers.addEventListener('click', loadPeers);
  const bootstrapPeers = document.querySelector('#bootstrap-peers');
  if (bootstrapPeers) bootstrapPeers.addEventListener('click', function () {
    bootstrapPeers.disabled = true;
    if (peerMessage) peerMessage.textContent = 'Finding public bootstrap peers…';
    post('api/v1/peers/bootstrap', {})
      .then(function (data) {
        const connected = (data.connected || []).length;
        const attempted = (data.attempted || []).length;
        if (peerMessage) peerMessage.textContent = connected ? 'Connected to ' + connected + ' bootstrap peer' + (connected === 1 ? '' : 's') + '. Gossip will continue in the background.' : 'Tried ' + attempted + ' bootstrap peer' + (attempted === 1 ? '' : 's') + '; none accepted the connection. Try again shortly.';
        setTimeout(function () { loadPeers(true); }, 1000);
      })
      .catch(function (error) { if (peerMessage) peerMessage.textContent = error.message; })
      .finally(function () { bootstrapPeers.disabled = false; });
  });
  loadPeers();

  const settingsState = document.querySelector('#settings-state');
  const settingsMessage = document.querySelector('#settings-message');
  const settingFields = {
    alias: document.querySelector('#setting-alias'),
    min_capacity_sat: document.querySelector('#setting-min-capacity'),
    fee_base: document.querySelector('#setting-fee-base'),
    fee_per_sat: document.querySelector('#setting-fee-per-sat'),
    rgb: document.querySelector('#setting-rgb'),
    log_level: document.querySelector('#setting-log-level')
  };

  function loadSettings() {
    if (settingsState) settingsState.textContent = 'Loading…';
    fetch('api/v1/node/settings')
      .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || 'Unable to read node settings'); return data; }); })
      .then(function (data) {
        const values = Object.assign({
          alias: 'My YunoHost Lightning Node',
          min_capacity_sat: 10000,
          fee_base: 1000,
          fee_per_sat: 10,
          rgb: '',
          log_level: 'info'
        }, data.settings || {});
        Object.keys(settingFields).forEach(function (key) {
          if (settingFields[key] && values[key] !== undefined) settingFields[key].value = values[key];
        });
        if (settingsState) settingsState.textContent = 'Runtime values';
        if (settingsMessage) settingsMessage.textContent = '';
      })
      .catch(function (error) { if (settingsState) settingsState.textContent = 'Unavailable'; if (settingsMessage) settingsMessage.textContent = error.message; });
  }

  function saveSettings() {
    const settings = {};
    Object.keys(settingFields).forEach(function (key) {
      const field = settingFields[key];
      if (field && field.value !== '') settings[key] = field.value;
    });
    const save = document.querySelector('#save-settings');
    if (save) save.disabled = true;
    if (settingsMessage) settingsMessage.textContent = 'Applying settings…';
    post('api/v1/node/settings', { settings: settings })
      .then(function () { if (settingsMessage) settingsMessage.textContent = 'Settings applied to the running node.'; if (settingsState) settingsState.textContent = 'Saved'; })
      .catch(function (error) { if (settingsMessage) settingsMessage.textContent = error.message; })
      .finally(function () { if (save) save.disabled = false; });
  }

  const saveSettingsButton = document.querySelector('#save-settings');
  const reloadSettingsButton = document.querySelector('#reload-settings');
  if (saveSettingsButton) saveSettingsButton.addEventListener('click', saveSettings);
  if (reloadSettingsButton) reloadSettingsButton.addEventListener('click', loadSettings);
  // Apply the initial hash only after all view-specific loaders and controls
  // have been initialized. This matters when a user opens /#settings or
  // /#peers directly rather than arriving from Home.
  routeFromHash();
})();
