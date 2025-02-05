import path from 'node:path';
import fs from 'node:fs';
import JSON5 from 'json5';

import '@soundworks/helpers/polyfills.js';
import { Server } from '@soundworks/core/server.js';
import { loadConfig, configureHttpRouter } from '@soundworks/helpers/server.js';
import filesystemPlugin from '@soundworks/plugin-filesystem/server.js';
import platformInitPlugin from '@soundworks/plugin-platform-init/server.js';
import syncPlugin from '@soundworks/plugin-sync/server.js';

import playerSchema from './schemas/player.js';
import globalSchema from './schemas/global.js';

import AudioBus from '../clients/audio/AudioBus.js';
import FeedbackDelay from '../clients/audio/FeedbackDelay.js';
// import Overdrive from '../clients/audio/Overdrive.js';
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
const configPath = path.join(process.cwd(), 'config.json');
const { presets, labels, introFile } = JSON5.parse(fs.readFileSync(configPath));

const server = new Server(config);
configureHttpRouter(server);

server.pluginManager.register('platform-init', platformInitPlugin);
server.pluginManager.register('synth-filesystem', filesystemPlugin, {
  dirname: 'audio-files/synth',
  publicPath: 'audio-files/synth',
});
server.pluginManager.register('trigger-filesystem', filesystemPlugin, {
  dirname: 'audio-files/trigger',
  publicPath: 'audio-files/trigger',
});
server.pluginManager.register('intro-filesystem', filesystemPlugin, {
  dirname: 'audio-files/intro',
  publicPath: 'audio-files/intro',
});
server.pluginManager.register('sync', syncPlugin);

// extend player schema with audio controls
function assignNamespaced(target, src, namespace) {
  for (let [name, def] of Object.entries(src)) {
    target[`${namespace}:${name}`] = def;
  }
}

// extend player schema
assignNamespaced(playerSchema, AudioBus.params, 'mix');
playerSchema['audio-player:control'] = Object.assign({}, GranularAudioPlayer.params.control);

// extend global schema
assignNamespaced(globalSchema, GranularAudioPlayer.params, 'audio-player');
assignNamespaced(globalSchema, FeedbackDelay.params, 'feedback-delay');
assignNamespaced(globalSchema, AudioBus.params, 'master');

// use defaults defined in presets
for (let name in presets) {
  if (playerSchema[name]) {
    playerSchema[name].default = presets[name];
  }

  if (globalSchema[name]) {
    globalSchema[name].default = presets[name];
  }
}

/**
 * Launch application (init plugins, http server, etc.)
 */
await server.start();

server.stateManager.defineClass('global', globalSchema);
const global = await server.stateManager.create('global', { labels, introFile });

server.stateManager.defineClass('player', playerSchema);
const players = await server.stateManager.getCollection('player');

// florward start stop to players state
global.onUpdate(updates => {
  if ('audio-player:control' in updates) {
    const value = updates['audio-player:control'];
    players.set({ 'audio-player:control': value });
  }

  if ('reset' in updates) {
    global.set(presets);
  }
});

const sync = await server.pluginManager.get('sync');

server.stateManager.registerUpdateHook('global', updates => {
  if ('introPlayingState' in updates) {
    const now = sync.getSyncTime();

    return {
      introPlayingStartTime: now + 1,
      ...updates,
    };
  }
});
