export default {
  labels: {
    type: 'any',
    default: [],
  },
  reset: {
    type: 'boolean',
    event: true,
  },
  introFile: {
    type: 'string',
    default: '',
  },
  introPlayingState: {
    type: 'string',
    default: 'stop',
  },
  introPlayingStartTime: {
    type: 'float',
    default: null,
    nullable: true,
  },
  ledBaseColor: {
    type: 'string',
    default: '#1100fa',
  },
  ledIntensityFactor: {
    type: 'float',
    default: 0.1,
    min: 0,
    max: 1,
  },
  // only for control
  applyFx: {
    type: 'boolean',
    default: false,
  },

  // presets
  activeThingsPreset: {
    type: 'string',
    default: null,
    nullable: true,
  },
  saveThingsPreset: {
    type: 'string',
    event: true,
  },
  deleteThingsPreset: {
    type: 'string',
    event: true,
  },
  thingsPresetList: {
    type: 'any',
    default: {},
  },
};
