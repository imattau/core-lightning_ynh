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
  const viewNames = ['home', 'wallet', 'payments', 'channels', 'peers', 'node', 'backup', 'settings'];
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
    if (view === 'payments') { loadInvoices(); loadPayments(); }
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

  function renderQr(container, text) {
    if (!container) return;
    if (!text || typeof qrcode !== 'function') {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    try {
      const qr = qrcode(0, 'L');
      qr.addData(text);
      qr.make();
      container.innerHTML = qr.createSvgTag({ scalable: true, margin: 2 });
      container.hidden = false;
    } catch (error) {
      container.hidden = true;
      container.innerHTML = '';
    }
  }

  const address = document.querySelector('#deposit-address');
  const generate = document.querySelector('#generate-address');
  const copy = document.querySelector('#copy-address');
  const walletState = document.querySelector('#wallet-state');
  const addressQr = document.querySelector('#address-qr');

  function setAddress(value) {
    if (!address || !copy) return;
    address.textContent = value || 'No address generated yet';
    copy.disabled = !value;
    renderQr(addressQr, value);
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
  const restorePhrase = document.querySelector('#restore-phrase');
  const confirmRestore = document.querySelector('#confirm-restore');
  const restoreWallet = document.querySelector('#restore-wallet');
  const restoreMessage = document.querySelector('#restore-message');

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

  if (restoreWallet) restoreWallet.addEventListener('click', function () {
    const phrase = restorePhrase && restorePhrase.value.trim();
    if (!phrase || !confirmRestore || !confirmRestore.checked) {
      if (restoreMessage) restoreMessage.textContent = 'Enter the phrase and confirm that this will replace the unused wallet.';
      return;
    }
    restoreWallet.disabled = true;
    if (restoreMessage) restoreMessage.textContent = 'Checking that the node is unused…';
    post('api/v1/recovery/restore', { recovery_phrase: phrase, confirm: true })
      .then(function (data) {
        if (restoreMessage) restoreMessage.textContent = data.message || 'Recovery accepted. Core Lightning is restarting.';
        if (restorePhrase) restorePhrase.value = '';
        if (confirmRestore) confirmRestore.checked = false;
      })
      .catch(function (error) { if (restoreMessage) restoreMessage.textContent = error.message; })
      .finally(function () { restoreWallet.disabled = false; });
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

  function renderChannels(channels) {
    const list = document.querySelector('#channel-list');
    const summary = document.querySelector('#channel-summary');
    const summaryTitle = summary && summary.querySelector('h3');
    const summaryText = summary && summary.querySelector('p');
    if (summaryTitle && summaryText) {
      if (!channels.length) {
        summaryTitle.textContent = 'No channels yet';
        summaryText.textContent = 'Connect a peer from the Peers page, then return here to open a channel.';
      } else {
        const capacity = channels.reduce(function (sum, channel) { return sum + msatValue(channel.amount_msat); }, 0) / 1000;
        const local = channels.reduce(function (sum, channel) { return sum + msatValue(channel.our_amount_msat); }, 0) / 1000;
        summaryTitle.textContent = channels.length + ' channel' + (channels.length === 1 ? '' : 's');
        summaryText.textContent = Math.floor(capacity).toLocaleString() + ' sats capacity · ' + Math.floor(local).toLocaleString() + ' sats local balance';
      }
    }
    if (!list) return;
    list.innerHTML = '';
    if (!channels.length) {
      list.innerHTML = '<p class="muted">No channels yet. Open one above to see it here.</p>';
      return;
    }
    channels.forEach(function (channel) {
      const capacity = msatValue(channel.amount_msat) / 1000;
      const local = msatValue(channel.our_amount_msat) / 1000;
      const row = document.createElement('div');
      row.className = 'channel-row';
      const details = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = channel.peer_id || 'Unknown peer';
      const meta = document.createElement('small');
      meta.textContent = (channel.state || 'Unknown state') + (channel.short_channel_id ? ' · ' + channel.short_channel_id : '');
      details.appendChild(title);
      details.appendChild(meta);
      const amounts = document.createElement('div');
      amounts.className = 'channel-amounts';
      const capacityText = document.createElement('strong');
      capacityText.textContent = Math.floor(capacity).toLocaleString() + ' sats';
      const localText = document.createElement('small');
      localText.textContent = 'local ' + Math.floor(local).toLocaleString() + ' sats';
      amounts.appendChild(capacityText);
      amounts.appendChild(localText);
      row.appendChild(details);
      row.appendChild(amounts);
      list.appendChild(row);
    });
  }

  function loadWallet() {
    return fetch('api/v1/wallet')
      .then(function (response) { if (!response.ok) throw new Error('offline'); return response.json(); })
      .then(function (data) {
      const outputs = data.outputs || [];
      const channels = data.channels || [];
      const onchain = Number(data.onchain_confirmed_msat || 0) / 1000;
      const capacity = channels.reduce(function (sum, channel) { return sum + msatValue(channel.amount_msat); }, 0) / 1000;
      const local = channels.reduce(function (sum, channel) { return sum + msatValue(channel.our_amount_msat); }, 0) / 1000;
      const total = Math.floor(onchain + local);
      renderChannels(channels);
      const onchainElement = document.querySelector('#onchain-balance');
      const capacityElement = document.querySelector('#channel-capacity');
      const totalElement = document.querySelector('#total-balance');
      if (onchainElement) onchainElement.textContent = Math.floor(onchain).toLocaleString();
      if (capacityElement) capacityElement.textContent = Math.floor(capacity).toLocaleString();
      if (totalElement) totalElement.textContent = total.toLocaleString();
      if (walletState && outputs.length) walletState.textContent = 'Wallet ready';
      return data;
      });
  }

  loadWallet().catch(function () { /* Status already communicates that CLN is offline. */ });

  const peerSelect = document.querySelector('#peer-select');
  const channelPeer = document.querySelector('#channel-peer-id');
  const manualPeer = document.querySelector('#manual-peer-id');
  const manualPeerHost = document.querySelector('#manual-peer-host');
  const manualPeerPort = document.querySelector('#manual-peer-port');
  const manualConnectPeer = document.querySelector('#manual-connect-peer');
  const openChannel = document.querySelector('#open-channel');
  const channelMessage = document.querySelector('#channel-message');
  const manualPeerMessage = document.querySelector('#manual-peer-message');
  const peerList = document.querySelector('#peer-list');
  const peerMessage = document.querySelector('#peer-message');

  function selectedPeer() {
    return (channelPeer && channelPeer.value.trim()) || (peerSelect && peerSelect.value) || '';
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

  function connectionMessage(data) {
    if (data.connected) return 'Peer connected' + (data.state ? ' · ' + data.state : '') + '.';
    return data.state ? 'Connection not active yet · ' + data.state + '. Refresh peers to check again.' : 'Connection request completed; refresh peers to check the current state.';
  }

  function connectPeerRequest(peerId, host, port, messageElement, button) {
    const payload = { peer_id: peerId };
    if (host) payload.host = host;
    if (port) payload.port = port;
    if (button) button.disabled = true;
    if (messageElement) messageElement.textContent = 'Connecting to peer…';
    return post('api/v1/peers/connect', payload)
      .then(function (data) { if (messageElement) messageElement.textContent = connectionMessage(data); return data; })
      .catch(function (error) { if (messageElement) messageElement.textContent = error.message; return null; })
      .finally(function () { if (button) button.disabled = false; });
  }

  function peerAddress(peer) {
    const addresses = peer.addresses || [];
    const address = addresses.find(function (item) { return item && item.type === 'ipv4'; }) || addresses.find(function (item) { return item && item.type === 'dns'; }) || addresses.find(function (item) { return item && item.type === 'ipv6'; }) || addresses[0];
    if (!address) return { host: null, port: null };
    if (typeof address === 'object') return { host: address.address || address.host || null, port: address.port || null };
    const match = String(address).match(/^(.+):(\d+)$/);
    return match ? { host: match[1].replace(/^\[|\]$/g, ''), port: match[2] } : { host: String(address), port: null };
  }

  if (manualConnectPeer) manualConnectPeer.addEventListener('click', function () {
    try {
      const peerId = manualPeer && manualPeer.value.trim();
      if (!peerId) throw new Error('Enter a peer node ID or endpoint.');
      const host = manualPeerHost && manualPeerHost.value.trim();
      const port = manualPeerPort && manualPeerPort.value.trim();
      connectPeerRequest(peerId, host, port, manualPeerMessage, manualConnectPeer).then(function () { loadPeers(true); });
    } catch (error) { if (manualPeerMessage) manualPeerMessage.textContent = error.message; }
  });

  if (openChannel) openChannel.addEventListener('click', function () {
    try {
      const payload = channelPayload(true);
      if (!payload.amount_sat) throw new Error('Enter a channel amount in satoshis.');
      openChannel.disabled = true;
      if (channelMessage) channelMessage.textContent = 'Submitting channel funding request…';
      post('api/v1/channels/open', payload)
        .then(function (data) {
          if (channelMessage) channelMessage.textContent = 'Channel request accepted: ' + (data.channel_id || 'pending confirmation.');
          return loadWallet();
        })
        .catch(function (error) { if (channelMessage) channelMessage.textContent = error.message; })
        .finally(function () { openChannel.disabled = false; });
    } catch (error) { if (channelMessage) channelMessage.textContent = error.message; }
  });

  function renderPeers(peers) {
    if (peerSelect) {
      const connectedPeers = peers.filter(function (peer) { return peer.connected; });
      peerSelect.innerHTML = connectedPeers.length
        ? '<option value="">Select a connected peer</option>'
        : '<option value="">No connected peers — use the Peers page</option>';
      connectedPeers.forEach(function (peer) {
        const option = document.createElement('option');
        option.value = peer.id;
        option.textContent = (peer.alias || 'Unnamed peer') + ' · ' + (peer.state || 'Connected');
        peerSelect.appendChild(option);
      });
    }
    if (!peerList) return;
    peerList.innerHTML = '';
    if (!peers.length) {
      peerList.innerHTML = '<p class="muted">No gossip peers discovered yet. Use the manual connection form above.</p>';
      return;
    }
    peers.forEach(function (peer) {
      const row = document.createElement('div');
      row.className = 'peer-row';
      row.innerHTML = '<div><strong></strong><small></small></div><button class="button button-light" type="button"></button>';
      row.querySelector('strong').textContent = peer.alias || 'Unnamed peer';
      row.querySelector('small').textContent = peer.id + (peer.connected ? ' · ' + (peer.state || 'Connected') : '');
      row.querySelector('button').textContent = peer.connected ? 'Connected' : 'Connect';
      row.querySelector('button').disabled = Boolean(peer.connected);
      row.querySelector('button').addEventListener('click', function () {
        if (peerMessage) peerMessage.textContent = 'Connecting to ' + (peer.alias || peer.id.slice(0, 12)) + '…';
        const address = peerAddress(peer);
        connectPeerRequest(peer.id, address.host, address.port, peerMessage, row.querySelector('button')).then(function () { loadPeers(true); });
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
        if (peerMessage) {
          peerMessage.textContent = connected
            ? 'Connected to ' + connected + ' bootstrap peer' + (connected === 1 ? '' : 's') + '. Gossip will continue in the background.'
            : data.discovered
              ? 'Tried ' + attempted + ' freshly discovered peer' + (attempted === 1 ? '' : 's') + '; none accepted the connection. Try again shortly.'
              : 'No fresh public peers were returned by the DNS seeds. Check DNS or connect a peer manually.';
        }
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
          min_emergency_sat: 25000,
          fee_base: 1000,
          fee_per_sat: 10,
          rgb: '',
          log_level: 'info'
        }, data.settings || {});
        const emergencyField = document.querySelector('#setting-min-emergency');
        if (emergencyField && values.min_emergency_sat !== undefined) emergencyField.value = values.min_emergency_sat;
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

  const invoiceAmount = document.querySelector('#invoice-amount');
  const invoiceDescription = document.querySelector('#invoice-description');
  const createInvoice = document.querySelector('#create-invoice');
  const invoiceMessage = document.querySelector('#invoice-message');
  const invoiceResult = document.querySelector('#invoice-result');
  const invoiceBolt11 = document.querySelector('#invoice-bolt11');
  const copyInvoice = document.querySelector('#copy-invoice');
  const invoiceList = document.querySelector('#invoice-list');
  const invoiceQr = document.querySelector('#invoice-qr');

  function timeAgo(seconds) {
    if (!seconds) return '';
    const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(seconds));
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function renderInvoices(invoices) {
    if (!invoiceList) return;
    invoiceList.innerHTML = '';
    if (!invoices.length) {
      invoiceList.innerHTML = '<p class="muted">No invoices yet.</p>';
      return;
    }
    invoices.forEach(function (item) {
      const row = document.createElement('div');
      row.className = 'channel-row';
      const details = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = item.description || item.label || 'Invoice';
      const meta = document.createElement('small');
      meta.textContent = (item.status || 'unpaid') + (item.paid_at ? ' · ' + timeAgo(item.paid_at) : '');
      details.appendChild(title);
      details.appendChild(meta);
      const amounts = document.createElement('div');
      amounts.className = 'channel-amounts';
      const amountText = document.createElement('strong');
      amountText.textContent = Math.floor(msatValue(item.amount_msat) / 1000).toLocaleString() + ' sats';
      amounts.appendChild(amountText);
      row.appendChild(details);
      row.appendChild(amounts);
      invoiceList.appendChild(row);
    });
  }

  function loadInvoices() {
    fetch('api/v1/invoices')
      .then(function (response) { if (!response.ok) throw new Error('Unable to load invoices'); return response.json(); })
      .then(function (data) { renderInvoices(data.invoices || []); })
      .catch(function () { if (invoiceList) invoiceList.innerHTML = '<p class="muted">Unable to load invoices.</p>'; });
  }

  if (copyInvoice) copyInvoice.addEventListener('click', function () {
    if (!invoiceBolt11 || !invoiceBolt11.textContent) return;
    navigator.clipboard.writeText(invoiceBolt11.textContent).then(function () {
      copyInvoice.textContent = 'Copied';
      setTimeout(function () { copyInvoice.textContent = 'Copy'; }, 1400);
    });
  });

  if (createInvoice) createInvoice.addEventListener('click', function () {
    const amount = Number((invoiceAmount && invoiceAmount.value) || 0);
    const description = (invoiceDescription && invoiceDescription.value.trim()) || '';
    if (!amount) { if (invoiceMessage) invoiceMessage.textContent = 'Enter an amount in satoshis.'; return; }
    if (!description) { if (invoiceMessage) invoiceMessage.textContent = 'Enter a description for this invoice.'; return; }
    createInvoice.disabled = true;
    if (invoiceMessage) invoiceMessage.textContent = 'Creating invoice…';
    post('api/v1/invoices', { amount_sat: amount, description: description })
      .then(function (data) {
        if (invoiceBolt11) invoiceBolt11.textContent = data.bolt11 || '';
        if (invoiceResult) invoiceResult.hidden = !data.bolt11;
        renderQr(invoiceQr, data.bolt11);
        if (invoiceMessage) invoiceMessage.textContent = 'Invoice created. Share it to receive payment.';
        if (invoiceAmount) invoiceAmount.value = '';
        if (invoiceDescription) invoiceDescription.value = '';
        loadInvoices();
      })
      .catch(function (error) { if (invoiceMessage) invoiceMessage.textContent = error.message; })
      .finally(function () { createInvoice.disabled = false; });
  });

  const payInvoiceField = document.querySelector('#pay-invoice');
  const payMaxFee = document.querySelector('#pay-max-fee');
  const confirmPayment = document.querySelector('#confirm-payment');
  const sendPayment = document.querySelector('#send-payment');
  const paymentMessage = document.querySelector('#payment-message');
  const paymentList = document.querySelector('#payment-list');

  function renderPayments(payments) {
    if (!paymentList) return;
    paymentList.innerHTML = '';
    if (!payments.length) {
      paymentList.innerHTML = '<p class="muted">No outgoing payments yet.</p>';
      return;
    }
    payments.forEach(function (item) {
      const row = document.createElement('div');
      row.className = 'channel-row';
      const details = document.createElement('div');
      const title = document.createElement('strong');
      const bolt11 = item.bolt11 || '';
      title.textContent = bolt11 ? bolt11.slice(0, 24) + '…' : (item.payment_hash || 'Payment').slice(0, 24);
      const meta = document.createElement('small');
      meta.textContent = (item.status || 'pending') + (item.created_at ? ' · ' + timeAgo(item.created_at) : '');
      details.appendChild(title);
      details.appendChild(meta);
      const amounts = document.createElement('div');
      amounts.className = 'channel-amounts';
      const amountText = document.createElement('strong');
      amountText.textContent = Math.floor(msatValue(item.amount_sent_msat || item.amount_msat) / 1000).toLocaleString() + ' sats';
      amounts.appendChild(amountText);
      row.appendChild(details);
      row.appendChild(amounts);
      paymentList.appendChild(row);
    });
  }

  function loadPayments() {
    fetch('api/v1/payments')
      .then(function (response) { if (!response.ok) throw new Error('Unable to load payments'); return response.json(); })
      .then(function (data) { renderPayments(data.payments || []); })
      .catch(function () { if (paymentList) paymentList.innerHTML = '<p class="muted">Unable to load payments.</p>'; });
  }

  if (sendPayment) sendPayment.addEventListener('click', function () {
    const invoice = (payInvoiceField && payInvoiceField.value.trim()) || '';
    const maxFee = payMaxFee && payMaxFee.value !== '' ? Number(payMaxFee.value) : null;
    if (!invoice) { if (paymentMessage) paymentMessage.textContent = 'Enter a Lightning invoice to pay.'; return; }
    if (!confirmPayment || !confirmPayment.checked) { if (paymentMessage) paymentMessage.textContent = 'Tick the confirmation before sending a payment.'; return; }
    const payload = { invoice: invoice, confirm: true };
    if (maxFee !== null) payload.max_fee_sat = maxFee;
    sendPayment.disabled = true;
    if (paymentMessage) paymentMessage.textContent = 'Sending payment… this can take up to a minute.';
    post('api/v1/payments', payload)
      .then(function (data) {
        const sent = Math.floor(msatValue(data.amount_sent_msat) / 1000);
        if (paymentMessage) paymentMessage.textContent = 'Payment sent · ' + sent.toLocaleString() + ' sats total.';
        if (payInvoiceField) payInvoiceField.value = '';
        if (payMaxFee) payMaxFee.value = '';
        if (confirmPayment) confirmPayment.checked = false;
        loadPayments();
        loadWallet();
      })
      .catch(function (error) { if (paymentMessage) paymentMessage.textContent = error.message; })
      .finally(function () { sendPayment.disabled = false; });
  });

  const saveSettingsButton = document.querySelector('#save-settings');
  const reloadSettingsButton = document.querySelector('#reload-settings');
  if (saveSettingsButton) saveSettingsButton.addEventListener('click', saveSettings);
  if (reloadSettingsButton) reloadSettingsButton.addEventListener('click', loadSettings);
  // Apply the initial hash only after all view-specific loaders and controls
  // have been initialized. This matters when a user opens /#settings or
  // /#peers directly rather than arriving from Home.
  routeFromHash();
})();
