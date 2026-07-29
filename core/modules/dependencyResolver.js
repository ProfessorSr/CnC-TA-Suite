export class DependencyResolver {
  resolve(modules) {
    const byId = modules instanceof Map
      ? new Map(modules)
      : new Map([...modules].map((module) => [module.id, module]));

    const visiting = new Set();
    const visited = new Set();
    const ordered = [];

    const visit = (id, path = []) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Circular module dependency: ${[...path, id].join(' -> ')}`);
      }

      const module = byId.get(id);
      if (!module) throw new Error(`Missing module dependency: ${id}`);

      visiting.add(id);
      for (const dependency of module.dependencies ?? []) {
        if (!byId.has(dependency)) {
          throw new Error(`Module "${id}" requires missing dependency "${dependency}".`);
        }
        visit(dependency, [...path, id]);
      }
      visiting.delete(id);
      visited.add(id);
      ordered.push(module);
    };

    for (const id of byId.keys()) visit(id);
    return ordered;
  }
}
