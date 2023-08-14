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
  soundfiles: {
    type: 'any',
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
  probe: {
    type: 'boolean',
    default: false,
  },
};
