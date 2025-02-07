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
  applyFx: {
    type: 'boolean',
    default: false,
  },
  triggerFile: {
    type: 'any',
    event: true,
  },
};
