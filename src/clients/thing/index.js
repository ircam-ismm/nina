import os from 'node:os';
import path from 'node:path';

import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { launcher, loadConfig } from '@soundworks/helpers/node.js';
import ClientPluginMixing from '@soundworks/plugin-mixing/client.js';
import { Scheduler } from '@ircam/sc-scheduling';
import { AudioContext } from 'node-web-audio-api';

import AudioBus from '../audio/AudioBus.js';
import FeedbackDelay from '../audio/FeedbackDelay.js';
import GranularAudioPlayer from '../audio/GranularAudioPlayer.js';
import { AudioBufferLoader } from '@ircam/sc-loader';

import Led from './Led.js';


// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

// helper function
function bindStateUpdatesToAudioNode(state, namespace, node) {
  const regexp = new RegExp(`^${namespace}:`);
  const schema = state.getDescription();

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
            if (node[key].setTargetAtTime) { // AudioNode interfaces
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

async function bootstrap() {
  const audioContext = new AudioContext();

  const config = loadConfig(process.env.ENV, import.meta.url);
  const client = new Client(config);
  launcher.register(client);

  client.pluginManager.register('mixing', ClientPluginMixing, {
    role: 'track',
    audioContext,
  });

  await client.start();

  const player = await client.stateManager.create('player', { id: client.id });
  const global = await client.stateManager.attach('global');

  const mixing = await client.pluginManager.get('mixing');

  // set player label according to hostname
  const labels = global.get('labels');
  const hostname = os.hostname();
  let isEmulated;

  if (hostname in labels) {
    isEmulated = false;

    const label = labels[hostname];
    player.set({ label, hostname });
    mixing.trackState.set({ label });
  } else {
    isEmulated = true;
    // DEV mode
    const hostnames = Object.keys(labels);
    const index = client.id % hostnames.length;
    const hostname = hostnames[index];
    const label = labels[hostname];

    player.set({ label, hostname });
    mixing.trackState.set({ label });
    console.log(`> DEV mode - hostname: ${hostname} - label: ${label}`);
  }

  const audioBufferLoader = new AudioBufferLoader(audioContext);
  const scheduler = new Scheduler(() => audioContext.currentTime);

  // audio chain
  const master = new AudioBus(audioContext);
  master.connect(mixing.input);

  const mix = new AudioBus(audioContext);
  mix.connect(master.input);

  const feedbackDelay = new FeedbackDelay(audioContext);
  feedbackDelay.connect(mix.input);

  const synthPlayer = new GranularAudioPlayer(audioContext, scheduler);
  synthPlayer.connect(feedbackDelay.input);
  synthPlayer.connect(mix.input);

  // led
  const led = new Led({ emulated: isEmulated, verbose: false });
  led.init(audioContext, scheduler, master);

  global.onUpdate(updates => {
    if ('ledBaseColor' in updates) {
      led.baseColor = updates.ledBaseColor;
    }
    if ('ledIntensityFactor' in updates) {
      led.intensityFactor = updates.ledIntensityFactor;
    }
  }, true);

  player.onUpdate(async updates => {
    console.log(updates);
    if ('soundfile' in updates) {
      player.set({ loaded: false });

      console.log(updates.soundfile);
      const audioBuffer = await audioBufferLoader.load(path.join(process.cwd(), updates.soundfile));
      synthPlayer.buffer = audioBuffer;

      player.set({ loaded: true });
    }

    if ('triggerFile' in updates) {
      const { url, volume } = updates.triggerFile;
      const audioBuffer = await audioBufferLoader.load(path.join(process.cwd(), url));

      const gain = audioContext.createGain();
      gain.connect(master.input);
      gain.gain.value = volume;

      const src = audioContext.createBufferSource();
      src.connect(gain);
      src.buffer = audioBuffer;
      src.start();
    }

    if ('kill' in updates) {
      await client.stop();
    }
  });

  bindStateUpdatesToAudioNode(player, 'audio-player', synthPlayer);
  bindStateUpdatesToAudioNode(player, 'mix', mix);

  bindStateUpdatesToAudioNode(global, 'audio-player', synthPlayer);
  bindStateUpdatesToAudioNode(global, 'feedback-delay', feedbackDelay);
  bindStateUpdatesToAudioNode(global, 'master', master);
}

// The launcher allows to fork multiple clients in the same terminal window
// by defining the `EMULATE` env process variable
// e.g. `EMULATE=10 npm run watch-process thing` to run 10 clients side-by-side
launcher.execute(bootstrap, {
  numClients: process.env.EMULATE ? parseInt(process.env.EMULATE) : 1,
  moduleURL: import.meta.url,
});
