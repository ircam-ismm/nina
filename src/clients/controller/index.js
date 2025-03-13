import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/browser.js';
import ClientPluginFilesystem from '@soundworks/plugin-filesystem/client.js';
import ClientPluginMixing from '@soundworks/plugin-mixing/client.js';

import { render, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
// import { live } from 'lit/directives/live.js';

import AudioBus from '../audio/AudioBus.js';
import FeedbackDelay from '../audio/FeedbackDelay.js';
// import Overdrive from '../audio/Overdrive.js';
import GranularAudioPlayer from '../audio/GranularAudioPlayer.js';

import '@ircam/sc-components';
import '@soundworks/plugin-mixing/components.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

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
                ?active=${'size' in state ? state.getDescription(stateKey).default : state.get(stateKey)}
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
                value=${'size' in state ? state.getDescription(stateKey).default : state.get(stateKey)}
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
  const config = loadConfig();
  const client = new Client(config);

  launcher.register(client, {
    initScreensContainer: $container,
    reloadOnVisibilityChange: false,
  });

  client.pluginManager.register('synth-filesystem', ClientPluginFilesystem);
  client.pluginManager.register('trigger-filesystem', ClientPluginFilesystem);
  client.pluginManager.register('mixing', ClientPluginMixing, {
    role: 'controller',
  });

  await client.start();

  const synthFilesystem = await client.pluginManager.get('synth-filesystem');
  synthFilesystem.onUpdate(renderApp);

  const triggerFilesystem = await client.pluginManager.get('trigger-filesystem');
  triggerFilesystem.onUpdate(renderApp);

  const mixing = await client.pluginManager.get('mixing');

  const global = await client.stateManager.attach('global');
  global.onUpdate(renderApp);

  const players = await client.stateManager.getCollection('player');
  players.onChange(renderApp);

  console.log(global.getValues());

  function renderApp() {
    console.log()
    render(html`
      <!-- intro -->
      <div style="height: 40px; width: 100%; position: relative">
        <div>
          <sc-text style="width: 100px;">LED</sc-text>
          <sc-color-picker
            value=${global.get('ledBaseColor')}
            @input=${e => global.set({ ledBaseColor: e.detail.value })}
          ></sc-color-picker>
          <sc-slider
            value=${global.get('ledIntensityFactor')}
            @input=${e => global.set({ ledIntensityFactor: e.detail.value })}
            min="0"
            max="1"
          ></sc-slider>
          <sc-midi></sc-midi>
          <sc-icon
            type="slider"
            @click=${e => {
              const target = document.querySelector('#mixing-wrapper')
              target.style.display = target.style.display !== 'block' ? 'block' : 'none';
            }}
          ></sc-icon>
        </div>
        <div style="position: absolute; top: 0; right: 2px;">
          <sc-text>${global.get('introFile')}</sc-text>
          <sc-transport value=${global.get('introPlayingState')} buttons=${JSON.stringify(['play', 'stop'])}
            id="global-intro-transport"
            @change=${e => global.set({ introPlayingState: e.detail.value })}
          ></sc-transport>
        </div>
      </div>
      <div id="mixing-wrapper">
        <sw-plugin-mixing .plugin=${mixing}></sw-plugin-mixing>
      </div>
      <div class="row-1">
        <!-- global controls -->
        <div class="col-1">
          <div style="margin: 16px 0 10px;">
            <sc-button
              @input=${e => global.set({ reset: true })}
            >Reset</sc-button>
          </div>
          <sc-transport
            id="global-audio-player-transport"
            style="height: 50px;"
            .buttons=${['start', 'stop']}
            @input=${e => {
              players.set({ 'audio-player:control': e.detail.value })
            }}
          ></sc-transport>

          <div style="margin: 20px 0 4px">
            <sc-text style="width: 120px";>period</sc-text>
            <sc-slider
              id="global-audio-player-period"
              min=${global.getDescription('audio-player:period').min}
              max=${global.getDescription('audio-player:period').max}
              number-box
              value=${global.get('audio-player:period')}
              @input=${e => {
                global.set('audio-player:period', e.detail.value)
                players.set('audio-player:period', e.detail.value)
              }}
            ></sc-slider>
          </div>
          <div style="margin: 4px 0">
            <sc-text style="width: 120px";>duration</sc-text>
            <sc-slider
              id="global-audio-player-duration"
              min=${players.getDescription('audio-player:duration').min}
              max=${players.getDescription('audio-player:duration').max}
              number-box
              value=${global.get('audio-player:duration')}
              @input=${e => {
                global.set('audio-player:duration', e.detail.value)
                players.set('audio-player:duration', e.detail.value)
              }}
            ></sc-slider>
          </div>

          <div style="padding-top: 10px; margin-top: 10px; border-top: 1px solid #454545">
            <sc-text style="width: 120px;">fx</sc-text>
            <sc-toggle
              id="global-audio-player-apply-fx"
              midi-mode="latch"
              @change=${e => {
                global.set('applyFx', e.detail.value)
                players.set('applyFx', e.detail.value)
              }}
            ></sc-toggle>
          </div>

          ${createInterfaceAndBindStateNamespaced(FeedbackDelay.params, global, 'feedback-delay')}
        </div>
        <div class="col-2">
          ${repeat(Object.entries(global.get('labels')), ([hostname, _]) => hostname, ([hostname, label]) => {
            const player = players.find(p => p.get('hostname') === hostname);

            if (player) {
              return html`
                <div style="padding: 16px 0; border-bottom: 1px solid #787878;">
                  <sc-text style="width: 140px;">${label} (${hostname})</sc-text>
                  <sc-status active></sc-status>
                  <sc-select
                    style="width: 180px;"
                    .options=${synthFilesystem.getTreeAsUrlMap('', true)}
                    placeholder="select sound file"
                    value=${player.get('soundfile')}
                    @change=${e => player.set({ soundfile: e.detail.value })}
                  ></sc-select>
                  <sc-status ?active=${player.get('loaded')}></sc-status>
                  <sc-transport
                    id="${hostname}-audio-player-transport"
                    .buttons=${['start', 'stop']}
                    .value=${player.get('audio-player:control')}
                    @input=${e => {
                      player.set({ 'audio-player:control': e.detail.value })
                    }}
                  ></sc-transport>
                  <sc-slider
                    id="${hostname}-audio-player-volume"
                    min=${AudioBus.params.volume.min}
                    max=${AudioBus.params.volume.max}
                    value=${player.get('mix:volume')}
                    @input=${e => player.set({ 'mix:volume': e.detail.value })}
                  ></sc-slider>

                  <sc-text style="width: 30px";>fx</sc-text>
                  <sc-toggle
                    id="${hostname}-audio-player-apply-fx"
                    midi-mode="latch"
                    ?active=${player.get('applyFx')}
                    @change=${e => player.set('applyFx', e.detail.value)}
                  ></sc-toggle>

                  <sc-text style="width: 60px";>period</sc-text>
                  <sc-slider
                    id="${hostname}-audio-player-period"
                    min=${player.getDescription('audio-player:period').min}
                    max=${player.getDescription('audio-player:period').max}
                    number-box
                    value=${player.get('audio-player:period')}
                    @input=${e => player.set('audio-player:period', e.detail.value)}
                  ></sc-slider>
                  <sc-text style="width: 60px";>duration</sc-text>
                  <sc-slider
                    id="${hostname}-audio-player-duration"
                    min=${player.getDescription('audio-player:duration').min}
                    max=${player.getDescription('audio-player:duration').max}
                    number-box
                    value=${player.get('audio-player:duration')}
                    @input=${e => player.set('audio-player:duration', e.detail.value)}
                  ></sc-slider>
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
        </div>
      </div>
      <div class="trigger-files">
        ${Object.entries(triggerFilesystem.getTreeAsUrlMap('', true)).map(([name, url]) => {
          return html`
            <div style="display: flex; margin-bottom: 2px;">
              <sc-text>${name}</sc-text>
              <sc-slider
                id="${name}-trigger-volume"
                class="volume"
                min="-80"
                max="12"
                value="0"
                @input=${e => players.set('triggerVolume', { url, volume: e.detail.value })}
              ></sc-slider>

              ${players.map(player => {
                return html`
                  <sc-button
                    @input=${e => {
                      const volume = e.target.parentNode.querySelector('.volume').value;
                      player.set('triggerFile', { url, volume });
                    }}
                  >${player.get('label')}</sc-button>
                `;
              })}
              <sc-bang
                @input=${e => {
                  const volume = e.target.parentNode.querySelector('.volume').value;
                  players.set('triggerFile', { url, volume });
                }}
              ></sc-bang>

            </div>
          `
        })}
      </div>
    `, $container);
  }

  renderApp();
}

launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate')) || 1,
  width: '50%',
});
