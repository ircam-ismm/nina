import AudioParam from './AudioParam.js';

// @todo - add a volume controller in db
class AudioBus {
  static params = {
    mute: {
      type: 'boolean',
      default: false,
    },
    gain: {
      type: 'float',
      min: 0,
      max: 2,
      default: 1,
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
    this.gain = new AudioParam(this._volume.gain);
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
