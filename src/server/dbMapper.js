
export default {
  configure(filesystem) {
    this.filesystem = filesystem;
  },

  async saveThingsPreset(presetName, things) {
    const data = {};
    const paramOfInterest = [
      'soundfile',
      'applyFx',
      'mix:volume',
      'mix:mute',
      'audio-player:control',
      'audio-player:period',
      'audio-player:duration',
    ]

    things.forEach(thing => {
      const values = thing.getValues();
      const { hostname } = values;
      data[hostname] = paramOfInterest.reduce((acc, key) => {
        acc[key] = values[key];
        return acc;
      }, {});
    });

    await this.filesystem.writeFile(`${presetName}.json`, JSON.stringify(data, null, 2));
  },

  async deleteThingsPreset(presetName) {
    await this.filesystem.rm(`${presetName}.json`);
  },

  async loadThingsPreset(presetName, things) {
    const blob = await this.filesystem.readFile(`${presetName}.json`);
    const txt = await blob.text();
    const data = JSON.parse(txt);

    for (let hostname in data) {
      const values = data[hostname];
      const thing = things.find(thing => thing.get('hostname') === hostname);
      if (thing) {
        thing.set({
          ...values,
          playOnLoad: true, // immediately play the file if any and transport is set to start
        });
      }
    }
  },

  getThingsPresetList() {
    const files = this.filesystem.getTree()
      .children
      .map(node => node.name.replace(/\.json$/, ''));

    return files;
  },
};
