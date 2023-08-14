
class AudioParam {
  constructor(preGain, postGain) {
    this._preGain = preGain;
    this._postGain = postGain;
  }

  get value() {
    return this._preGain.gain.value;
  }

  set value(value) {
    this._preGain.gain.value = value;
    this._postGain.gain.value = 1 / value;
  }

  setValueAtTime(value, time) {
    this._preGain.gain.setValue(value, time);
    this._postGain.gain.setValue(1 / value, time);
  }

  linearRampToValueAtTime(value, time) {
    this._preGain.gain.linearRampToValueAtTime(value, time);
    this._postGain.gain.linearRampToValueAtTime(1 / value, time);
  }

  exponentialRampToValueAtTime(value, time) {
    this._preGain.gain.exponentialRampToValueAtTime(value, time);
    this._postGain.gain.exponentialRampToValueAtTime(1 / value, time);
  }

  setTargetAtTime(value, startTime, timeConstant) {
    this._preGain.gain.setTargetAtTime(value, startTime, timeConstant);
    this._postGain.gain.setTargetAtTime(1 / value, startTime, timeConstant);
  }
}

const defaultCurve = new Float32Array(1024);
// populate with cosine portion [pi, 2pi]
for (let i = 0; i < defaultCurve.length; i++) {
  const phase = Math.PI + i / (defaultCurve.length - 1) * Math.PI;
  // const value = (Math.cos(phase) + 1) / 2;
  const value = Math.cos(phase);
  defaultCurve[i] = value;
}

class Overdrive {
  static params = {
    gain: {
      type: 'float',
      min: 0.1,
      max: 25,
      default: 1,
    },
  };

  constructor(context, { curve = defaultCurve } = {}) {
    this.context = context;

    this._postGain = this.context.createGain();

    this._waveshaper = this.context.createWaveShaper();
    this._waveshaper.connect(this._postGain);
    this._waveshaper.curve = curve;

    this._preGain = this.context.createGain();
    this._preGain.connect(this._waveshaper);

    this.gain = new AudioParam(this._preGain, this._postGain);
  }

  get input() {
    return this._preGain;
  }

  connect(dest) {
    this._postGain.connect(dest);
  }

  disconnect(dest) {
    this._postGain.disconnect(dest);
  }
}

export default Overdrive;
