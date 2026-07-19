export class StorageMigration {
  constructor() {
    this.steps = [];
  }

  register(fromVersion, toVersion, migrate) {
    this.steps.push({ fromVersion, toVersion, migrate });
    return this;
  }

  async run(data, currentVersion, targetVersion) {
    let version = currentVersion;
    let result = data;
    while (version !== targetVersion) {
      const step = this.steps.find((item) => item.fromVersion === version);
      if (!step) throw new Error(`No migration path from ${version} to ${targetVersion}.`);
      result = await step.migrate(result);
      version = step.toVersion;
    }
    return result;
  }
}
