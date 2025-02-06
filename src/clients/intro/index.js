import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import launcher from '@soundworks/helpers/launcher.js';
import pluginSync from '@soundworks/plugin-sync/client.js';
import pluginPlatformInit from '@soundworks/plugin-platform-init/client.js';
import { AudioBufferLoader } from 'waves-loaders';

import { render, html } from 'lit';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

/**
 * Grab the configuration object written by the server in the `index.html`
 */
const config = window.SOUNDWORKS_CONFIG;

/**
 * If multiple clients are emulated you might to want to share some resources
 */
const audioContext = new AudioContext();
const loader = new AudioBufferLoader();

async function main($container) {
  const client = new Client(config);

  client.pluginManager.register('platform-init', pluginPlatformInit, { audioContext });
  client.pluginManager.register('sync', pluginSync, {
    getTimeFunction: () => audioContext.currentTime,
  }, ['platform-init']);

  launcher.register(client, { initScreensContainer: $container });

  await client.start();

  const global = await client.stateManager.attach('global');
  const sync = await client.pluginManager.get('sync');

  let loading = true;

  function renderApp() {
    render(html`
      ${
        loading
          ? html`<h1 style="padding-top: 120px; text-align: center;">loading...</h1>`
          : html`<h1 style="padding-top: 120px; text-align: center;">nina</h1>`
      }
      <sw-credits .client="${this.client}"></sw-credits>
    `, $container)
  }

  renderApp();

  const introFile = global.get('introFile');
  const buffer = await loader.load(introFile);

  loading = false;
  renderApp();

  let src;

  global.onUpdate(updates => {
    if ('introPlayingState' in updates) {
      if (src) {
        src.stop();
      }

      if (updates['introPlayingState'] === 'play') {
        const startTime = global.get('introPlayingStartTime');
        const now = sync.getSyncTime();
        src = audioContext.createBufferSource();
        src.connect(audioContext.destination);
        src.buffer = buffer;

        if (startTime >= now) {
          const localStartTime = sync.getLocalTime(startTime);
          src.start(localStartTime)
        } else {
          const offset = now - startTime;
          src.start(audioContext.currentTime, offset);
        }
      }
    }
  }, true);
}

// The launcher enables instantiation of multiple clients in the same page to
// facilitate development and testing.
// e.g. `http://127.0.0.1:8000?emulate=10` to run 10 clients side-by-side
launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate')) || 1,
});
