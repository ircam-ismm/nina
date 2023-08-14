
class AudioParam {
  constructor(param) {
    this._param = param;
  }

  get value() {
    return this._param.value;
  }

  set value(value) {
    this._param.value = value;
  }

  setValueAtTime(value, time) {
    this._param.setValueAtTime(value, time);
  }

  linearRampToValueAtTime(value, time) {
    this._param.linearRampToValueAtTime(value, time);
  }

  exponentialRampToValueAtTime(value, time) {
    this._param.exponentialRampToValueAtTime(value, time);
  }

  setTargetAtTime(value, startTime, timeConstant) {
    this._param.setTargetAtTime(value, startTime, timeConstant);
  }
}

export default AudioParam;
