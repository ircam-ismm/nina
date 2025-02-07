class GranularAudioPlayer {
  static params = {
    control: {
      type: 'enum',
      list: ['start', 'stop'],
      default: 'stop',
      filterChange: false,
    },
    period: {
      type: 'float',
      min: 0.05,
      max: 1,
      default: 0.1,
    },
    duration: {
      type: 'float',
      min: 0.01,
      max: 1,
      default: 0.25,
    },
  };

  constructor(context, scheduler, {
    period = 0.1,
    duration = 0.25,
  } = {}) {
    this.context = context;

    this.scheduler = scheduler;

    this.period = period;
    this.duration = duration;
    this.position = 0;
    this._buffer = null;
    this._nextBuffer = null;

    this._output = this.context.createGain();

    this.render = this.render.bind(this);
    this.scheduler.add(this.render, Infinity);
  }

  get buffer() {
    return this._buffer;
  }

  set buffer(buffer) {
    this._nextBuffer = buffer;
  }

  connect(dest) {
    this._output.connect(dest);
  }

  disconnect(dest) {
    this._output.disconnect(dest);
  }

  start() {
    this._buffer = this._nextBuffer;
    this.position = 0;

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
    let now = currentTime;

    // add jitter is period is in audible range (> 50Hz || < 20ms), otherwise keep it straight to
    // avoid phase artifacts
    if (this.period < 0.02) {
      now += Math.random() * 0.001;
    }

    // if duration has increased between two grains, we might go beyond buffer duration
    // clamp duration so that we don't reach the end of audio file (which might produce clics)
    const duration = Math.min(this.duration, this.buffer.duration - this.position);

    const env = this.context.createGain();
    env.connect(this._output);
    env.gain.value = 0;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + duration / 2);
    env.gain.linearRampToValueAtTime(0, now + duration);

    const src = this.context.createBufferSource();
    src.connect(env);
    src.loop = true;
    src.buffer = this.buffer;
    src.start(now, this.position);
    src.stop(now + duration)

    // take grain duration into account to wrap around
    this.position = (this.position + this.period) % (this.buffer.duration - this.duration);

    return currentTime + this.period;
  }
}

export default GranularAudioPlayer;
