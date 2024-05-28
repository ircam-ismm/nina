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

    const src = this.context.createBufferSource();
    src.connect(this._output);
    src.buffer = this.buffer;
    src.start();
  }

}

export default SimpleAudioPlayer;

