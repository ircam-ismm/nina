class SimpleAudioPlayer {
  static params = {
    control: {
      type: 'enum',
      list: ['start', 'stop'],
      default: 'stop',
    },
  };

  constructor(context) {
    this.context = context;

    this._buffer = null;
    this._src = null;

    this._output = this.context.createGain();
  }

  get buffer() {
    return this._buffer;
  }

  set buffer(buffer) {
    this._buffer = buffer;
  }

  connect(dest) {
    this._output.connect(dest);
  }

  disconnect(dest) {
    this._output.disconnect(dest);
  }

  start() {
    if (!this._buffer) {
      console.log('[SimpleAudioPlayer] no buffer set, abort start');
      return;
    }

    this._src = this.context.createBufferSource();
    this._src.connect(this._output);
    this._src.buffer = this.buffer;
    this._src.start();
  }
}

export default SimpleAudioPlayer;

