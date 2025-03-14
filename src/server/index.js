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
import ServerPluginCheckin from '@soundworks/plugin-checkin/server.js';

import thingDescription from './descriptions/thing.js';
import globalDescription from './descriptions/global.js';

import dbMapper from './dbMapper.js';

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
server.pluginManager.register('things-presets', ServerPluginFilesystem, {
  dirname: 'things-presets',
});
server.pluginManager.register('sync', ServerPluginSync);
server.pluginManager.register('mixing', ServerPluginMixing);
// for dev purposes
server.pluginManager.register('checkin', ServerPluginCheckin, {
  capacity: Object.keys(labels).length,
});

// extend player schema with audio controls
function assignNamespaced(target, src, namespace) {
  for (let [name, def] of Object.entries(src)) {
    target[`${namespace}:${name}`] = def;
  }
}

// extend player schema
assignNamespaced(thingDescription, AudioBus.params, 'mix');
assignNamespaced(thingDescription, GranularAudioPlayer.params, 'audio-player');
thingDescription['audio-player:control'] = Object.assign({}, GranularAudioPlayer.params.control);

// extend global schema
assignNamespaced(globalDescription, GranularAudioPlayer.params, 'audio-player');
assignNamespaced(globalDescription, FeedbackDelay.params, 'feedback-delay');

/**
 * Launch application (init plugins, http server, etc.)
 */
await server.start();

// apply preset to default
for (let name in presets) {
  if (thingDescription[name]) {
    thingDescription[name].default = presets[name];
  }

  if (globalDescription[name]) {
    globalDescription[name].default = presets[name];
  }
}

server.stateManager.defineClass('global', globalDescription);
const global = await server.stateManager.create('global', { labels, introFile });

server.stateManager.defineClass('thing', thingDescription);
const things = await server.stateManager.getCollection('thing');

// use defaults defined in presets
function applyGlobalPreset() {
  const thingDescription = things.getDescription();
  const globalDescription = global.getDescription();

  for (let name in presets) {
    if (thingDescription[name]) {
      things.set(name, presets[name]);
    }

    if (globalDescription[name]) {
      global.set(name, presets[name]);
    }
  }
}

applyGlobalPreset();

const sync = await server.pluginManager.get('sync');
const thingPresetsFilesystem = await server.pluginManager.get('things-presets');
dbMapper.configure(thingPresetsFilesystem);
// init things preset list
global.set('thingsPresetList', dbMapper.getThingsPresetList());

// forward start and stop to things state
global.onUpdate(async updates => {
  for (let [name, value] of Object.entries(updates)) {
    switch (name) {
      case 'reset': {
        applyGlobalPreset();
        break;
      }
      case 'activeThingsPreset': {
        if (value !== null) {
          await dbMapper.loadThingsPreset(value, things);
        }
        break;
      }
      case 'saveThingsPreset': {
        await dbMapper.saveThingsPreset(value, things);
        global.set({
          thingsPresetList: dbMapper.getThingsPresetList(),
          activeThingsPreset: value,
        });
        break;
      }
      case 'deleteThingsPreset': {
        await dbMapper.deleteThingsPreset(value);
        const nextActivePreset = global.get('activeThingsPreset') === value
          ? null
          : global.get('activeThingsPreset');

        global.set({
          thingsPresetList: dbMapper.getThingsPresetList(),
          activeThingsPreset: nextActivePreset,
        });
        break;
      }
    }
  }
});

server.stateManager.registerUpdateHook('global', updates => {
  if ('introPlayingState' in updates) {
    const now = sync.getSyncTime();

    return {
      introPlayingStartTime: now + 1,
      ...updates,
    };
  }
});
