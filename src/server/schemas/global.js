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
  shutdown: {
    type: 'boolean',
    event: true,
  },
};
