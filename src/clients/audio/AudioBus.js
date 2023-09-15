import { dbtoa, atodb } from '@ircam/sc-utils';

import AudioParam from './AudioParam.js';

class DBParam {
  constructor(param) {
    this._param = param;
  }

  get value() {
    return atodb(this._param.value);
  }

  set value(value) {
    value = dbtoa(value);
    this._param.value = value;
  }

  setValueAtTime(value, time) {
    value = dbtoa(value);
    this._param.setValueAtTime(value, time);
  }

  linearRampToValueAtTime(value, time) {
    value = dbtoa(value);
    this._param.linearRampToValueAtTime(value, time);
  }

  exponentialRampToValueAtTime(value, time) {
    value = dbtoa(value);
    this._param.exponentialRampToValueAtTime(value, time);
  }

  setTargetAtTime(value, startTime, timeConstant) {
    value = dbtoa(value);
    this._param.setTargetAtTime(value, startTime, timeConstant);
  }
}

// @todo - add a volume controller in db
class AudioBus {
  static params = {
    volume: {
      type: 'float',
      min: -80,
      max: 12,
      default: 0,
    },
    mute: {
      type: 'boolean',
      default: false,
    },
  }

  constructor(context, {
    volume = 1,
    mute = false,
  } = {}) {
    this.context = context;

    this._mute = this.context.createGain();

    this._volume = this.context.createGain();
    this._volume.connect(this._mute)

    // init values
    this.mute = mute;
    // this.gain = new AudioParam(this._volume.gain);
    this.volume = new DBParam(this._volume.gain);
  }

  get input() {
    return this._volume;
  }

  get mute() {
    return this._muteValue;
  }

  set mute(value) {
    this._muteValue = value;

    const gain = this._muteValue ? 0 : 1;
    this._mute.gain.setTargetAtTime(gain, this.context.currentTime, 0.005);
  }

  connect(dest) {
    this._mute.connect(dest);
  }

  disconnect() {
    this._mute.disconnect(dest);
  }
}

export default AudioBus;
