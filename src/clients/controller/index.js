import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import filesystemPlugin from '@soundworks/plugin-filesystem/client.js';
import launcher from '@soundworks/helpers/launcher.js';
import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import createLayout from './layout.js';

import AudioBus from '../audio/AudioBus.js';
import FeedbackDelay from '../audio/FeedbackDelay.js';
import Overdrive from '../audio/Overdrive.js';
import GranularAudioPlayer from '../audio/GranularAudioPlayer.js';

import '@ircam/sc-components';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

const config = window.SOUNDWORKS_CONFIG;

// state is actually a collection, but that's ok
function createInterfaceAndBindStateNamespaced(params, state, namespace) {
  return html`
    <div>
      <h3>${namespace}</h3>
      ${Object.keys(params).map(paramName => {
        const param = params[paramName];

        if (param.type !== 'boolean' && param.type !== 'float' && param.type !== 'integer') {
          return nothing;
        }

        const stateKey = `${namespace}:${paramName}`

        const title = html`<sc-text style="width: 120px;">${paramName}</sc-text>`;
        const sep = html`<hr>`;
        let control;

        switch (param.type) {
          case 'boolean': {
            control = html`
              <sc-toggle
                ?active=${state.get(stateKey)}
                @change=${e => state.set({ [stateKey]: e.detail.value })}
              ></sc-toggle>
            `
            break;
          }
          case 'float':
          case 'integer': {
            control = html`
              <sc-slider
                min=${param.min}
                max=${param.max}
                value=${state.get(stateKey)}
                number-box
                @input=${e => state.set({ [stateKey]: e.detail.value })}
              ></sc-slider>
            `;
            break;
          }
        }

        return [title, control, sep];
      })}
  `;
}

async function main($container) {
  const client = new Client(config);

  launcher.register(client, {
    initScreensContainer: $container,
    reloadOnVisibilityChange: false,
  });

  client.pluginManager.register('filesystem', filesystemPlugin);

  await client.start();

  const $layout = createLayout(client, $container);

  const filesystem = await client.pluginManager.get('filesystem');
  filesystem.onUpdate(() => $layout.requestUpdate());

  const global = await client.stateManager.attach('global');
  global.onUpdate(() => $layout.requestUpdate());

  const players = await client.stateManager.getCollection('player');
  players.onAttach(() => $layout.requestUpdate());
  players.onDetach(() => $layout.requestUpdate());
  players.onUpdate(() => $layout.requestUpdate());

  const intro = {
    render() {
      return html`
        <div style="position: absolute; right: 2px; top: 40px;">
          <sc-text>${global.get('introFile')}</sc-text>
          <sc-transport value=${global.get('introPlayingState')} buttons=${JSON.stringify(['play', 'stop'])}
            @change=${e => global.set({ introPlayingState: e.detail.value })}
          ></sc-transport>
        </div>
      `;
    }
  }

  const audioControls = {
    render() {
      return html`
        <div class="col-1">
          <div style="margin: 16px 0 10px;">
            <sc-button
              @input=${e => global.set({ reset: true })}
            >Reset</sc-button>
          </div>
          <sc-transport
            style="height: 50px;"
            .buttons=${['play', 'stop']}
            .value=${global.get('audio-player:control') === 'start' ? 'play' : 'stop'}
            @change=${e => {
              const value = e.detail.value === 'play' ? 'start' : 'stop';
              global.set({ 'audio-player:control': value })
            }}
          ></sc-transport>

          ${createInterfaceAndBindStateNamespaced(GranularAudioPlayer.params, global, 'audio-player')}
          ${createInterfaceAndBindStateNamespaced(FeedbackDelay.params, global, 'feedback-delay')}
          ${createInterfaceAndBindStateNamespaced(AudioBus.params, global, 'master')}
        </div>
      `;
    }
  }

  const playersView = {
    render() {
      const labels = global.get('labels');

      return html`
        <div class="col-2">
          ${repeat(Object.entries(labels), ([hostname, label]) => hostname, ([hostname, label]) => {
            const player = players.find(p => p.get('hostname') === hostname);
            const title = html`<sc-text style="width: 100px;">${label} (${hostname})</sc-text>`

            if (player) {
              return html`
                <div style="padding: 16px 0; border-bottom: 1px solid #787878;">
                  <sc-text style="width: 140px;">${label} (${hostname})</sc-text>
                  <sc-status active></sc-status>
                  <sc-select
                    style="width: 180px;"
                    .options=${filesystem.getTreeAsUrlMap('', true)}
                    placeholder="select sound file"
                    value=${player.get('soundfile')}
                    @change=${e => player.set({ soundfile: e.detail.value })}
                  ></sc-select>
                  <sc-status ?active=${player.get('loaded')}></sc-status>
                  <sc-transport
                    .buttons=${['play', 'stop']}
                    .value=${player.get('audio-player:control') === 'start' ? 'play' : 'stop'}
                    @change=${e => {
                      const value = e.detail.value === 'play' ? 'start' : 'stop';
                      player.set({ 'audio-player:control': value })
                    }}
                  ></sc-transport>
                  <sc-slider
                    min=${AudioBus.params.volume.min}
                    max=${AudioBus.params.volume.max}
                    value=${player.get('mix:volume')}
                    @input=${e => player.set({ 'mix:volume': e.detail.value })}
                  ></sc-slider>
                  <sc-text style="width: 90px;">restart app</sc-text>
                  <sc-bang
                    @input=${e => player.set({ kill: true })}
                  ></sc-bang>
                </div>
              `
            } else {
              return html`
                <div style="padding: 16px 0; border-bottom: 1px solid #787878;">
                  <sc-text style="width: 140px;">${label} (${hostname})</sc-text>
                  <sc-status></sc-status>
                </div>
              `;
            }


          })}

          <div style="padding: 16px 0; text-align: right;">
            <sc-button
              @input=${e => {
                if (confirm('are you sure?')) {
                  global.set({ reboot: true });
                }
              }}
            >reboot clients</sc-button>
            <sc-button
              @input=${e => {
                if (confirm('are you sure?')) {
                  global.set({ shutdown: true });
                }
              }}
            >shutdown clients</sc-button>
          </div>
        </div>
      `;
    }
  }

  $layout.addComponent(intro);
  $layout.addComponent(audioControls);
  $layout.addComponent(playersView);
}

launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate')) || 1,
  width: '50%',
});
