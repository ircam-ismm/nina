import os from 'node:os';
import path from 'node:path';

import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { launcher, loadConfig } from '@soundworks/helpers/node.js';
import ClientPluginMixing from '@soundworks/plugin-mixing/client.js';
import ClientPluginCheckin from '@soundworks/plugin-checkin/client.js';
import { Scheduler } from '@ircam/sc-scheduling';
import { AudioContext } from 'node-web-audio-api';

import AudioBus from '../audio/AudioBus.js';
import FeedbackDelay from '../audio/FeedbackDelay.js';
import GranularAudioPlayer from '../audio/GranularAudioPlayer.js';
import { AudioBufferLoader } from '@ircam/sc-loader';
import { decibelToLinear } from '@ircam/sc-utils';

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

  client.pluginManager.register('checkin', ClientPluginCheckin);

  await client.start();

  const thing = await client.stateManager.create('thing', { id: client.id });
  const global = await client.stateManager.attach('global');

  const mixing = await client.pluginManager.get('mixing');
  const checkin =await client.pluginManager.get('checkin');

  // set thing label according to hostname
  const labels = global.get('labels');
  const hostname = os.hostname();
  let isEmulated;

  if (hostname in labels) {
    isEmulated = false;

    const label = labels[hostname];
    thing.set({ label, hostname });
    mixing.trackState.set({ label });
  } else {
    isEmulated = true;
    // DEV mode
    const hostnames = Object.keys(labels);
    const index = checkin.getIndex();
    const hostname = hostnames[index];
    const label = labels[hostname];

    thing.set({ label, hostname });
    mixing.trackState.set({ label });

    console.log(`> DEV mode - hostname: ${hostname} - label: ${label}`);
  }

  const audioBufferLoader = new AudioBufferLoader(audioContext);
  const scheduler = new Scheduler(() => audioContext.currentTime);

  const mix = new AudioBus(audioContext);
  mix.connect(mixing.input);

  const feedbackDelay = new FeedbackDelay(audioContext);
  feedbackDelay.connect(mix.input);

  const wet = audioContext.createGain();
  wet.gain.value = thing.get('applyFx') ? 1 : 0;
  wet.connect(feedbackDelay.input);

  const dry = audioContext.createGain();
  dry.gain.value = thing.get('applyFx') ? 0 : 1;
  dry.connect(mix.input);

  const synthPlayer = new GranularAudioPlayer(audioContext, scheduler);
  synthPlayer.connect(wet);
  synthPlayer.connect(dry);
  // synthPlayer.connect(mix.input); // direct

  // led
  const led = new Led({ emulated: isEmulated, verbose: false });
  led.init(audioContext, scheduler, mix);

  const triggerGains = new Map();

  global.onUpdate(updates => {
    if ('ledBaseColor' in updates) {
      led.baseColor = updates.ledBaseColor;
    }
    if ('ledIntensityFactor' in updates) {
      led.intensityFactor = updates.ledIntensityFactor;
    }
  }, true);

  thing.onUpdate(async updates => {
    for (let [key, value] of Object.entries(updates)) {
      switch (key) {
        case 'soundfile': {
          thing.set({ loaded: false });
          const audioBuffer = await audioBufferLoader.load(path.join(process.cwd(), updates.soundfile));
          synthPlayer.buffer = audioBuffer;
          thing.set({ loaded: true });

          // if (updates.playOnLoad === true && updates['audio-player:control'] === 'start') {
          //   synthPlayer.start();
          // }
          break;
        }
        case 'triggerFile': {
          const { url, volume } = updates.triggerFile;
          const audioBuffer = await audioBufferLoader.load(path.join(process.cwd(), url));

          if (!triggerGains.has(url)) {
            const gain = audioContext.createGain();
            gain.connect(mix.input);
            gain.gain.value = decibelToLinear(volume);
            triggerGains.set(url, gain);
          }

          const gain = triggerGains.get(url);
          gain.gain.setTargetAtTime(decibelToLinear(volume), audioContext.currentTime, 0.03);

          const src = audioContext.createBufferSource();
          src.connect(gain);
          src.buffer = audioBuffer;
          src.start();
          break;
        }
        case 'triggerVolume': {
          const { url, volume } = updates.triggerVolume;

          if (!triggerGains.has(url)) {
            const gain = audioContext.createGain();
            gain.connect(mix.input);
            gain.gain.value = decibelToLinear(volume);
            triggerGains.set(url, gain);
          } else {
            const gain = triggerGains.get(url);
            gain.gain.setTargetAtTime(decibelToLinear(volume), audioContext.currentTime, 0.03);
          }
          break;
        }
        case 'applyFx': {
          const now = audioContext.currentTime;
          dry.gain.setValueAtTime(value ? 1 : 0, now);
          dry.gain.linearRampToValueAtTime(value ? 0 : 1, now + 0.1);
          wet.gain.setValueAtTime(value ? 0 : 1, now);
          wet.gain.linearRampToValueAtTime(value ? 1 : 0, now + 0.1);
          break;
        }
      }
    }
  });

  bindStateUpdatesToAudioNode(thing, 'audio-player', synthPlayer);
  bindStateUpdatesToAudioNode(thing, 'mix', mix);

  bindStateUpdatesToAudioNode(global, 'feedback-delay', feedbackDelay);
}

// The launcher allows to fork multiple clients in the same terminal window
// by defining the `EMULATE` env process variable
// e.g. `EMULATE=10 npm run watch-process thing` to run 10 clients side-by-side
launcher.execute(bootstrap, {
  numClients: process.env.EMULATE ? parseInt(process.env.EMULATE) : 1,
  moduleURL: import.meta.url,
});
