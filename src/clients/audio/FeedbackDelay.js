import AudioParam from './AudioParam.js';

class FeedbackDelay {
  static params = {
    directSound: {
      type: 'float',
      min: 0,
      max: 1,
      default: 1.,
    },
    preGain: {
      type: 'float',
      min: 0,
      max: 1,
      default: 0.8,
    },
    delayTime: {
      type: 'float',
      min: 0,
      max: 1,
      default: 0.1,
    },
    feedback: {
      type: 'float',
      min: 0,
      max: 1,
      default: 0.8,
    },
    filterFrequency: {
      type: 'float',
      min: 0,
      max: 20000,
      default: 12000,
    }
  };

  constructor(context, {
    maxDelayTime = 1,
    directSound = 1,
    delayTime = 0.1,
    preGain = 0.8,
    feedback = 0.8,
    filterFrequency = 12000,
  } = {}) {
    this.context = context;

    this._output = this.context.createGain();

    this._filter = this.context.createBiquadFilter();
    this._filter.connect(this._output);

    this._delay = this.context.createDelay(maxDelayTime);
    this._delay.connect(this._filter);

    this._feedback = this.context.createGain();
    this._filter.connect(this._feedback);
    this._feedback.connect(this._delay);

    this._preGain = this.context.createGain();
    this._preGain.connect(this._delay);

    this._directSound = this.context.createGain();
    this._directSound.connect(this._output);

    this._input = this.context.createGain();
    this._input.connect(this._directSound);
    this._input.connect(this._preGain);

    // expose params
    this.directSound = new AudioParam(this._directSound.gain);
    this.directSound.value = directSound;

    this.preGain = new AudioParam(this._preGain.gain);
    this.preGain.value = preGain;

    this.delayTime = new AudioParam(this._delay.delayTime);
    this.delayTime.value = delayTime;

    this.feedback = new AudioParam(this._feedback.gain);
    this.feedback.value = feedback;

    this.filterFrequency = new AudioParam(this._filter.frequency);
    this.filterFrequency.value = filterFrequency;
  }

  get input() {
    return this._input;
  }

  connect(dest) {
    this._output.connect(dest);
  }

  disconnect(dest) {
    this._output.disconnect(dest);
  }
}

export default FeedbackDelay;
