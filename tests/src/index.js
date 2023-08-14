import { render, html } from 'lit/html.js';
import { resumeAudioContext } from '@ircam/resume-audio-context';
import { Scheduler } from '@ircam/sc-scheduling';
import '@ircam/sc-components';

// console.info('> self.crossOriginIsolated', self.crossOriginIsolated);

import GranularAudioPlayer from '../../src/clients/audio/GranularAudioPlayer.js';
import Overdrive from '../../src/clients/audio/Overdrive.js';
import FeedbackDelay from '../../src/clients/audio/FeedbackDelay.js';
import AudioBus from '../../src/clients/audio/AudioBus.js';

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();

const scheduler = new Scheduler(() => audioContext.currentTime);

let buffer;
// let src;
// let state = 'stop';
// console.log('is class', AudioBus);

const master = new AudioBus(audioContext);
master.connect(audioContext.destination);

const feedbackDelay = new FeedbackDelay(audioContext);
feedbackDelay.connect(master.input);

const overdrive = new Overdrive(audioContext);
overdrive.connect(feedbackDelay.input);
overdrive.connect(master.input);

const inputBus = new AudioBus(audioContext);
inputBus.connect(overdrive.input);

const player = new GranularAudioPlayer(audioContext, scheduler);
player.connect(inputBus.input);

renderScreen();

function generateInterface(title, node) {
  const params = node.constructor.params;
  const context = node.context;

  return html`
    <div>
      <h3>${title}</h3>
      ${Object.keys(params).map(paramName => {
        const param = params[paramName];

        const title = html`<sc-text>${paramName}</sc-text>`;
        const sep = html`<hr>`;
        let control;

        switch (param.type) {
          case 'enum': {
            control = html`
              <sc-tab
                .options=${param.list}
                value=${param.default}
                @change=${e => node[e.detail.value]()}
              ></sc-tab>
            `
            break;
          }
          case 'float':
          case 'integer': {
            control = html`
              <sc-slider
                min=${param.min}
                max=${param.max}
                value=${param.default}
                number-box
                @input=${e => {
                  if (node[paramName].constructor.name === 'AudioParam') {
                    node[paramName].setTargetAtTime(e.detail.value, context.currentTime, 0.01);
                  } else {
                    node[paramName] = e.detail.value;
                  }
                }}
              ></sc-slider>
            `;
            break;
          }
          case 'boolean': {
            control = html`
              <sc-toggle
                value=${param.default}
                @change=${e => node[paramName] = e.detail.value}
              ></sc-toggle>
            `
            break;
          }
        }

        return [title, control, sep];
      })}
  `
}

function renderScreen() {
  render(html`
    <h2>Test synths</h2>

    <sc-midi></sc-midi>
    <sc-dragndrop
      @change=${e => player.buffer = e.detail.value[Object.keys(e.detail.value)[0]]}
    ></sc-dragndrop>

    ${generateInterface('Audio Player', player)}
    ${generateInterface('Input Gain', inputBus)}
    ${generateInterface('Overdrive', overdrive)}
    ${generateInterface('FeedbackDelay', feedbackDelay)}
    ${generateInterface('Master', master)}

  `, document.body);
}
