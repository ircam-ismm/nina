export default {
  id: {
    type: 'integer',
    default: null,
    nullable: true,
  },
  label: {
    type: 'string',
    default: null,
    nullable: true,
  },
  hostname: {
    type: 'string',
    default: null,
    nullable: true,
  },
  soundfile: {
    type: 'string',
    default: null,
    nullable: true,
  },
  loaded: {
    type: 'boolean',
    default: false,
  },
  // play sound loaded sound file as soon as possible is 'audio-player:control' is set to start
  // useful when applying a preset
  playOnLoad: {
    type: 'boolean',
    event: true,
  },
  applyFx: {
    type: 'boolean',
    default: false,
  },
  triggerFile: {
    type: 'any', // { url, volume }
    event: true,
  },
  triggerVolume: {
    type: 'any', // { url, volume
    event: true,
  },
};
