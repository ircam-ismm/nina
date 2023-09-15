class GranularAudioPlayer {
  static params = {
    control: {
      type: 'enum',
      list: ['start', 'stop'],
      default: 'stop',
    },
    period: {
      type: 'float',
      min: 0.01,
      max: 1,
      default: 0.02,
    },
    duration: {
      type: 'float',
      min: 0.01,
      max: 1,
      default: 0.1,
    },
  };

  constructor(context, scheduler, {
    period = 0.02,
    duration = 0.1,
  } = {}) {
    this.context = context;

    this.scheduler = scheduler;

    this.period = period;
    this.duration = duration;
    this.position = 0;
    this._buffer = null;

    this._output = this.context.createGain();

    this.render = this.render.bind(this);
    this.scheduler.add(this.render, Infinity);
  }

  get buffer() {
    return this._buffer;
  }

  set buffer(buffer) {
    this._buffer = buffer;
    this.position = 0;
  }

  connect(dest) {
    this._output.connect(dest);
  }

  disconnect(dest) {
    this._output.disconnect(dest);
  }

  start() {
    if (!this.buffer) {
      console.log('[GranularAudioPlayer] no buffer set, abort start');
      return;
    }

    this.scheduler.reset(this.render, this.context.currentTime);
  }

  stop() {
    this.scheduler.reset(this.render, Infinity);
  }

  render(currentTime) {

    const env = this.context.createGain();
    env.connect(this._output);
    env.gain.value = 0;
    env.gain.setValueAtTime(0, currentTime);
    env.gain.linearRampToValueAtTime(1, currentTime + this.duration / 2);
    env.gain.linearRampToValueAtTime(0, currentTime + this.duration);

    const src = this.context.createBufferSource();
    src.connect(env);
    src.loop = true;
    src.buffer = this.buffer;
    src.start(currentTime, this.position, this.duration);


    this.position = (this.position + this.period) % this.buffer.duration;

    return currentTime + this.period;
  }
}

export default GranularAudioPlayer;
