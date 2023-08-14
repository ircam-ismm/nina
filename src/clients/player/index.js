import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import launcher from '@soundworks/helpers/launcher.js';
import platformInitPlugin from '@soundworks/plugin-platform-init/client.js';
import { Scheduler } from '@ircam/sc-scheduling';
import { html } from 'lit';
import { AudioBufferLoader } from 'waves-loaders';

import AudioBus from '../audio/AudioBus.js';
import FeedbackDelay from '../audio/FeedbackDelay.js';
import Overdrive from '../audio/Overdrive.js';
import GranularAudioPlayer from '../audio/GranularAudioPlayer.js';

import createLayout from './layout.js';

// import Waveshaper from '../audio/Waveshaper.js';

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
const audioBufferLoader = new AudioBufferLoader();
const scheduler = new Scheduler(() => audioContext.currentTime);

// helper function
function bindStateUpdatesToAudioNode(state, namespace, node) {
  const regexp = new RegExp(`^${namespace}:`);
  const schema = state.getSchema();

  state.onUpdate(updates => {
    for (let [name, value] of Object.entries(updates)) {
      if (regexp.test(name)) {
        const key = name.replace(regexp, '');
        const type = schema[name].type;

        switch (type) {
          case 'enum':
            node[value]();
            break;
          case 'float':
          case 'integer':
            if (node[key].constructor && node[key].constructor.name === 'AudioParam') {
              node[key].setTargetAtTime(value, node.context.currentTime, 0.01);
            } else {
              node[key] = value;
            }
            break;
          case 'boolean':
            node[key] = value;
            break;
        }
      }
    }
  }, true);
}

async function main($container) {
  /**
   * Create the soundworks client
   */
  const client = new Client(config);

  client.pluginManager.register('platform-init', platformInitPlugin, { audioContext });

  launcher.register(client, { initScreensContainer: $container });

  /**
   * Launch application
   */
  await client.start();

  const $layout = createLayout(client, $container);
  // shared states
  const player = await client.stateManager.create('player', { id: client.id });
  // audio chain
  const master = new AudioBus(audioContext);
  master.connect(audioContext.destination);

  const feedbackDelay = new FeedbackDelay(audioContext);
  feedbackDelay.connect(master.input);

  const overdrive = new Overdrive(audioContext);
  overdrive.connect(feedbackDelay.input);
  overdrive.connect(master.input);

  const inputBus = new AudioBus(audioContext);
  inputBus.connect(overdrive.input);

  const audioPlayer = new GranularAudioPlayer(audioContext, scheduler);
  audioPlayer.connect(inputBus.input);

  player.onUpdate(async updates => {
    if ('soundfile' in updates) {
      player.set({ loaded: false });

      const pathname = updates.soundfile;
      const buffer = await audioBufferLoader.load(pathname);
      audioPlayer.buffer = buffer;

      player.set({ loaded: true });
    }

    $layout.requestUpdate();
  });

  bindStateUpdatesToAudioNode(player, 'audio-player', audioPlayer);
  bindStateUpdatesToAudioNode(player, 'input-bus', inputBus);
  bindStateUpdatesToAudioNode(player, 'overdrive', overdrive);
  bindStateUpdatesToAudioNode(player, 'feedback-delay', feedbackDelay);
  bindStateUpdatesToAudioNode(player, 'master', master);

  const view = {
    render() {
      return html`
        <div class="${player.get('probe') ? 'probe' : ''}">
          <p>id: ${player.get('id')}</p>
          <p>label: ${player.get('label')}</p>
          <p>soundfile: ${player.get('soundfile')}</p>
        </div>
      `;
    }
  }

  $layout.addComponent(view);


}

// The launcher enables instanciation of multiple clients in the same page to
// facilitate development and testing.
// e.g. `http://127.0.0.1:8000?emulate=10` to run 10 clients side-by-side
launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate')) || 1,
});
