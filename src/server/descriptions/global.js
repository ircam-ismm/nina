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
    default: '#ffffff',
  },
  ledIntensityFactor: {
    type: 'float',
    default: 1,
    min: 0,
    max: 1,
  },
  // only for control
  applyFx: {
    type: 'boolean',
    default: false,
  },
};
