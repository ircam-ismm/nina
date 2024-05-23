import os from 'node:os';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import launcher from '@soundworks/helpers/launcher.js';
import { Scheduler } from '@ircam/sc-scheduling';
import { AudioContext } from 'node-web-audio-api';

import { loadConfig } from '../../utils/load-config.js';
import createLayout from './layout.js';
import AudioBus from '../audio/AudioBus.js';
import FeedbackDelay from '../audio/FeedbackDelay.js';
import GranularAudioPlayer from '../audio/GranularAudioPlayer.js';
import SimpleAudioPlayer from '../audio/SimpleAudioPlayer.js';
import NodeBufferLoader from '../audio/NodeBufferLoader.js';

import LED from './led.js';


// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

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
  const audioBufferLoader = new NodeBufferLoader(audioContext);
  const scheduler = new Scheduler(() => audioContext.currentTime);

  const config = loadConfig(process.env.ENV, import.meta.url);
  const client = new Client(config);

  launcher.register(client);

  await client.start();

  // shared states
  const player = await client.stateManager.create('player', { id: client.id });
  const global = await client.stateManager.attach('global');

  // set player label according to hostname
  const labels = global.get('labels');
  const hostname = os.hostname();
  let isEmulated;

  if (hostname in labels) {
    isEmulated = false;

    const label = labels[hostname];
    player.set({ label, hostname });
  } else {
    isEmulated = true;
    // DEV mode
    const hostnames = Object.keys(labels);
    const index = client.id % hostnames.length;
    const hostname = hostnames[index];
    const label = labels[hostname];

    player.set({ label, hostname });
    console.log(`> DEV mode - hostname: ${hostname} - label: ${label}`);
  }

  // audio chain
  const master = new AudioBus(audioContext);
  master.connect(audioContext.destination);

  const mix = new AudioBus(audioContext);
  mix.connect(master.input);

  const feedbackDelay = new FeedbackDelay(audioContext);
  feedbackDelay.connect(mix.input);

  const synthPlayer = new GranularAudioPlayer(audioContext, scheduler);
  synthPlayer.connect(feedbackDelay.input);
  synthPlayer.connect(mix.input);

  const triggerPlayer = new SimpleAudioPlayer(audioContext);
  triggerPlayer.connect(master.input);

  // led
  const verboseLed = false;
  const led = new LED({ emulated: isEmulated, verbose: false });
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
    if ('soundfile' in updates) {
      player.set({ loaded: false });

      const arrayBuffer = await fs.readFile(path.join(process.cwd(), updates.soundfile));
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.buffer);
      synthPlayer.buffer = audioBuffer;

      player.set({ loaded: true });
    }

    if ('triggerFile' in updates) {
      const arrayBuffer = await fs.readFile(path.join(process.cwd(), updates.triggerFile));
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.buffer);
      triggerPlayer.buffer = audioBuffer;

      triggerPlayer.start();
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
