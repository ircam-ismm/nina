import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import launcher from '@soundworks/helpers/launcher.js';
import pluginSync from '@soundworks/plugin-sync/client.js';
import pluginPlatformInit from '@soundworks/plugin-platform-init/client.js';
import { AudioBufferLoader } from 'waves-loaders';

import createLayout from './layout.js';
import { html } from 'lit';

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
  /**
   * Create the soundworks client
   */
  const client = new Client(config);

  /**
   * Register some soundworks plugins, you will need to install the plugins
   * before hand (run `npx soundworks` for help)
   */
  client.pluginManager.register('platform-init', pluginPlatformInit, { audioContext });

  client.pluginManager.register('sync', pluginSync, {
    getTimeFunction: () => audioContext.currentTime,
  }, ['platform-init']);

  /**
   * Register the soundworks client into the launcher
   *
   * The launcher will do a bunch of stuff for you:
   * - Display default initialization screens. If you want to change the provided
   * initialization screens, you can import all the helpers directly in your
   * application by doing `npx soundworks --eject-helpers`. You can also
   * customize some global styles variables (background-color, text color etc.)
   * in `src/clients/components/css/app.scss`.
   * You can also change the default language of the initialization screen by
   * setting, the `launcher.language` property, e.g.:
   * `launcher.language = 'fr'`
   * - By default the launcher automatically reloads the client when the socket
   * closes or when the page is hidden. Such behavior can be quite important in
   * performance situation where you don't want some phone getting stuck making
   * noise without having any way left to stop it... Also be aware that a page
   * in a background tab will have all its timers (setTimeout, etc.) put in very
   * low priority, messing any scheduled events.
   */
  launcher.register(client, { initScreensContainer: $container });
  /**
   * Launch application
   */
  await client.start();

  const global = await client.stateManager.attach('global');
  const sync = await client.pluginManager.get('sync');

  // The `$layout` is provided as a convenience and is not required by soundworks,
  // its full source code is located in the `./views/layout.js` file, so feel free
  // to edit it to match your needs or even to delete it.
  const $layout = createLayout(client, $container);

  let loading = true;
  const view = {
    render: () => loading
      ? html`<h1 style="padding-top: 120px; text-align: center;">loading...</h1>`
      : html`<h1 style="padding-top: 120px; text-align: center;">nina</h1>`
  }

  $layout.addComponent(view);
  const introFile = global.get('introFile');
  const buffer = await loader.load(introFile);

  loading = false;
  $layout.requestUpdate();

  let src;

  global.onUpdate(updates => {
    if ('introPlayingState' in updates) {
      console.log(updates);
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
