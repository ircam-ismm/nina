import path from 'node:path';
import fs from 'node:fs';
import JSON5 from 'json5';

import '@soundworks/helpers/polyfills.js';
import { Server } from '@soundworks/core/server.js';
import filesystemPlugin from '@soundworks/plugin-filesystem/server.js';
import platformInitPlugin from '@soundworks/plugin-platform-init/server.js';

import { loadConfig } from '../utils/load-config.js';
import '../utils/catch-unhandled-errors.js';

import playerSchema from './schemas/player.js';

import AudioBus from '../clients/audio/AudioBus.js';
import FeedbackDelay from '../clients/audio/FeedbackDelay.js';
import Overdrive from '../clients/audio/Overdrive.js';
import GranularAudioPlayer from '../clients/audio/GranularAudioPlayer.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

const config = loadConfig(process.env.ENV, import.meta.url);

console.log(`
--------------------------------------------------------
- launching "${config.app.name}" in "${process.env.ENV || 'default'}" environment
- [pid: ${process.pid}]
--------------------------------------------------------
`);

// load preset file
const presetPath = path.join(process.cwd(), 'default-preset.json');
const preset = JSON5.parse(fs.readFileSync(presetPath));

/**
 * Create the soundworks server
 */
const server = new Server(config);
// configure the server for usage within this application template
server.useDefaultApplicationTemplate();

server.pluginManager.register('platform-init', platformInitPlugin);
server.pluginManager.register('filesystem', filesystemPlugin, {
  dirname: 'audio-files',
  publicPath: 'audio',
});

// extend player schema with audio controls
function assignNamespaced(target, src, namespace) {
  for (let [name, def] of Object.entries(src)) {
    target[`${namespace}:${name}`] = def;
  }
}

assignNamespaced(playerSchema, GranularAudioPlayer.params, 'audio-player');
assignNamespaced(playerSchema, AudioBus.params, 'input-bus');
assignNamespaced(playerSchema, Overdrive.params, 'overdrive');
assignNamespaced(playerSchema, FeedbackDelay.params, 'feedback-delay');
assignNamespaced(playerSchema, AudioBus.params, 'master');

for (let name in preset) {
  playerSchema[name].default = preset[name];
}

server.stateManager.registerSchema('player', playerSchema);

// const players = await server.stateManager.getCollection('players');

  // 'audio-player:control': { type: 'enum', list: [ 'start', 'stop' ], default: 'stop' },
  // 'audio-player:period': { type: 'float', min: 0.01, max: 1, default: 0.02 },
  // 'audio-player:duration': { type: 'float', min: 0.01, max: 1, default: 0.1 },
  // 'audio-player:position': { type: 'float', min: 0, max: 9999, default: 0 },
  // 'input-bus:mute': { type: 'boolean', default: false },
  // 'input-bus:gain': { type: 'float', min: 0, max: 2, default: 1 },
  // 'overdrive:gain': { type: 'float', min: 0.1, max: 250, default: 1 },
  // 'feedback-delay:preGain': { type: 'float', min: 0, max: 1, default: 0.8 },
  // 'feedback-delay:delayTime': { type: 'float', min: 0, max: 1, default: 0.1 },
  // 'feedback-delay:feedback': { type: 'float', min: 0, max: 1, default: 0.8 },
  // 'feedback-delay:filterFrequency': { type: 'integer', min: 0, max: 20000, default: 12000 },
  // 'master:mute': { type: 'boolean', default: false },
  // 'master:gain': { type: 'float', min: 0, max: 2, default: 1 }

/**
 * Launch application (init plugins, http server, etc.)
 */
await server.start();

// and do your own stuff!

