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
      if (network) network.textContent = node.network || 'Bitcoin';
      if (peers) peers.textContent = data.peers || '0';
      if (channels) channels.textContent = data.channels || '0';
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

  fetch('api/v1/peers/discovered')
    .then(function (response) { if (!response.ok) throw new Error('Peer discovery unavailable'); return response.json(); })
    .then(function (data) {
      if (!peerSelect) return;
      peerSelect.innerHTML = '<option value="">Select a discovered peer</option>';
      (data.peers || []).forEach(function (peer) {
        const option = document.createElement('option');
        option.value = peer.id;
        option.textContent = (peer.alias || 'Unnamed peer') + ' · ' + peer.id.slice(0, 12) + '…';
        peerSelect.appendChild(option);
      });
    })
    .catch(function () { if (peerSelect) peerSelect.innerHTML = '<option value="">No discovered peers — use manual ID</option>'; });
})();
