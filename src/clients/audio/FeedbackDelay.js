import AudioParam from './AudioParam.js';

class FeedbackDelay {
  static params = {
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
    delayTime = 0.1,
    preGain = 0.8,
    feedback = 0.8,
    filterFrequency = 12000,
  } = {}) {
    this.context = context;

    this._filter = this.context.createBiquadFilter();

    this._delay = this.context.createDelay(maxDelayTime);
    this._delay.connect(this._filter);

    this._feedback = this.context.createGain();
    this._filter.connect(this._feedback);
    this._feedback.connect(this._delay);

    this._preGain = this.context.createGain();
    this._preGain.connect(this._delay);

    // expose params
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
    return this._preGain;
  }

  connect(dest) {
    this._filter.connect(dest);
  }

  disconnect(dest) {
    this._filter.disconnect(dest);
  }
}

export default FeedbackDelay;
