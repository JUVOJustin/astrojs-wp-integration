export const hooks = {
  beforePacking(pkg) {
    // Contributor tooling must never run when consumers install the published package.
    const { scripts: _scripts, ...manifest } = pkg;

    return manifest;
  },
};
