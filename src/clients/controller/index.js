import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import filesystemPlugin from '@soundworks/plugin-filesystem/client.js';
import launcher from '@soundworks/helpers/launcher.js';
import { html } from 'lit';
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

// state is actaully a collection, but that's ok
function createInterfaceAndBindStateNamespaced(params, state, namespace) {
  return html`
    <div>
      <h3>${namespace}</h3>
      ${Object.keys(params).map(paramName => {
        const param = params[paramName];
        const stateKey = `${namespace}:${paramName}`

        const title = html`<sc-text>${paramName}</sc-text>`;
        const sep = html`<hr>`;
        let control;

        switch (param.type) {
          // case 'enum': {
          //   control = html`
          //     <sc-tab
          //       .options=${param.list}
          //       value=${state.get(stateKey)[0]}
          //       @change=${e => state.set({ [stateKey]: e.detail.value })}
          //     ></sc-tab>
          //   `
          //   break;
          // }
          case 'boolean': {
            control = html`
              <sc-toggle
                ?active=${state.get(stateKey)[0]}
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
                value=${state.get(stateKey)[0]}
                number-box
                @input=${e => state.set({ [stateKey]: e.detail.value })}
              ></sc-slider>
            `;
            break;
          }
        }

        return [title, control, sep];
      })}
  `
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

  const players = await client.stateManager.getCollection('player');
  players.onAttach(() => $layout.requestUpdate());
  players.onDetach(() => $layout.requestUpdate());
  players.onUpdate(() => $layout.requestUpdate());

  const alphabet = 'ABCDEFGHIJLKMNOPQRSTUVWXYZ';



  const audioControls = {
    render() {
      return html`
        <div class="col">
          <h2># controls</h2>
          <sc-transport
            style="height: 50px;"
            .buttons=${['play', 'stop']}
            .value=${players.get('audio-player:control')[0] === 'start' ? 'play' : 'stop'}
            @change=${e => {
              const value = e.detail.value === 'play' ? 'start' : 'stop';
              players.set({ 'audio-player:control': value })
            }}
          ></sc-transport>

          ${createInterfaceAndBindStateNamespaced(GranularAudioPlayer.params, players, 'audio-player')}
          ${createInterfaceAndBindStateNamespaced(AudioBus.params, players, 'input-bus')}
          ${createInterfaceAndBindStateNamespaced(Overdrive.params, players, 'overdrive')}
          ${createInterfaceAndBindStateNamespaced(FeedbackDelay.params, players, 'feedback-delay')}
          ${createInterfaceAndBindStateNamespaced(AudioBus.params, players, 'master')}
        </div>
      `;
    }
  }

  const playersView = {
    render() {
      // @todo - replace with iterator when fixed
      return html`
        <div class="col">
          <h2># Players</h2>
          ${repeat(players, player => player.id, player => {
            return html`
              <div style="padding: 16px 0; border-bottom: 1px solid white;">
                <sc-text style="width: 100px;">player ${player.get('id')}</sc-text>
                <sc-select
                  style="width: 120px;"
                  .options=${alphabet.split('')}
                  placeholder="select label"
                  value=${player.get('label')}
                  @change=${e => player.set({ label: e.detail.value })}
                ></sc-select>
                <sc-select
                  style="width: 180px;"
                  .options=${filesystem.getTreeAsUrlMap('', true)}
                  placeholder="select sound file"
                  value=${player.get('soundfile')}
                  @change=${e => player.set({ soundfile: e.detail.value })}
                ></sc-select>
                <sc-status ?active=${player.get('loaded')}></sc-status>
                <sc-toggle
                  @change=${e => player.set({ probe: !player.get('probe') })}
                ></sc-toggle>
                <hr />
                <sc-transport
                  .buttons=${['play', 'stop']}
                  .value=${player.get('audio-player:control') === 'start' ? 'play' : 'stop'}
                  @change=${e => {
                    const value = e.detail.value === 'play' ? 'start' : 'stop';
                    player.set({ 'audio-player:control': value })
                  }}
                ></sc-transport>
                <sc-slider
                  min="0"
                  max="2"
                  value=${player.get('mix:gain')}
                  @input=${e => player.set({ 'mix:gain': e.detail.value })}
                ></sc-slider>
              </div>
            `
          })}
        </div>
      `;
    }
  }

  $layout.addComponent(audioControls);
  $layout.addComponent(playersView);
}

launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate')) || 1,
  width: '50%',
});
