import path from 'node:path';
import fs from 'node:fs';
import JSON5 from 'json5';

import '@soundworks/helpers/polyfills.js';
import { Server } from '@soundworks/core/server.js';
import { loadConfig, configureHttpRouter } from '@soundworks/helpers/server.js';
import ServerPluginFilesystem from '@soundworks/plugin-filesystem/server.js';
import ServerPluginPlatformInit from '@soundworks/plugin-platform-init/server.js';
import ServerPluginSync from '@soundworks/plugin-sync/server.js';
import ServerPluginMixing from '@soundworks/plugin-mixing/server.js';

import playerDescription from './descriptions/player.js';
import globalDescription from './descriptions/global.js';

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

server.pluginManager.register('platform-init', ServerPluginPlatformInit);
server.pluginManager.register('synth-filesystem', ServerPluginFilesystem, {
  dirname: 'audio-files/synth',
  publicPath: 'audio-files/synth',
});
server.pluginManager.register('trigger-filesystem', ServerPluginFilesystem, {
  dirname: 'audio-files/trigger',
  publicPath: 'audio-files/trigger',
});
server.pluginManager.register('intro-filesystem', ServerPluginFilesystem, {
  dirname: 'audio-files/intro',
  publicPath: 'audio-files/intro',
});
server.pluginManager.register('sync', ServerPluginSync);
server.pluginManager.register('mixing', ServerPluginMixing);

// extend player schema with audio controls
function assignNamespaced(target, src, namespace) {
  for (let [name, def] of Object.entries(src)) {
    target[`${namespace}:${name}`] = def;
  }
}

// extend player schema
assignNamespaced(playerDescription, AudioBus.params, 'mix');
playerDescription['audio-player:control'] = Object.assign({}, GranularAudioPlayer.params.control);

// extend global schema
assignNamespaced(globalDescription, GranularAudioPlayer.params, 'audio-player');
assignNamespaced(globalDescription, FeedbackDelay.params, 'feedback-delay');
assignNamespaced(globalDescription, AudioBus.params, 'master');

// use defaults defined in presets
for (let name in presets) {
  if (playerDescription[name]) {
    playerDescription[name].default = presets[name];
  }

  if (globalDescription[name]) {
    globalDescription[name].default = presets[name];
  }
}

/**
 * Launch application (init plugins, http server, etc.)
 */
await server.start();

server.stateManager.defineClass('global', globalDescription);
const global = await server.stateManager.create('global', { labels, introFile });

server.stateManager.defineClass('player', playerDescription);
const players = await server.stateManager.getCollection('player');

// forward start and stop to players state
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
