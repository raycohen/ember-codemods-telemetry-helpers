const fs = require('fs-extra');
const path = require('path');
const walkSync = require('walk-sync');

const ADDON_PATHS = {};
const APP_PATHS = {};

const cwd = process.cwd();

let packagePaths = walkSync(cwd, {
  globs: ['**/package.json'],
  ignore: ['**/tmp/**', '**/node_modules/**'],
});

for (let packagePath of packagePaths) {
  let pkg = fs.readJsonSync(packagePath);

  let packageDir = path.dirname(path.resolve(cwd, packagePath));

  if (pkg.keywords && pkg.keywords.includes('ember-addon')) {
    ADDON_PATHS[packageDir] = pkg.name;
  } else if (isEmberCliProject(pkg)) {
    APP_PATHS[packageDir] = pkg.name;
  }
}

function isEmberCliProject(pkg) {
  return (
    pkg &&
    ((pkg.dependencies && Object.keys(pkg.dependencies).indexOf('ember-cli') !== -1) ||
      (pkg.devDependencies && Object.keys(pkg.devDependencies).indexOf('ember-cli') !== -1))
  );
}

/**
 * Transforms a literal "on disk" path to a "module path".
 *
 * @param {String} filePath the path on disk (from current working directory)
 * @returns {String} The in-browser module path for the specified filePath
 */
function getModulePathFor(filePath, addonPaths = ADDON_PATHS, appPaths = APP_PATHS) {
  let bestAddonMatch = '',
    bestAppMatch = '';
  let addonModuleNameRoot,
    appModuleNameRoot,
    appRelativePath,
    addonRelativePath,
    relativePath,
    isApp,
    result;

  for (let addonPath in addonPaths) {
    if (filePath.startsWith(addonPath) && addonPath.length > bestAddonMatch.length) {
      bestAddonMatch = addonPath;
      addonModuleNameRoot = addonPaths[addonPath];
      addonRelativePath = filePath.slice(
        addonPath.length + 1 /* for slash */,
        -path.extname(filePath).length
      );
    }
  }

  for (let appPath in appPaths) {
    if (filePath.startsWith(appPath) && appPath.length > bestAppMatch.length) {
      bestAppMatch = appPath;
      appModuleNameRoot = appPaths[appPath];
      appRelativePath = filePath.slice(
        appPath.length + 1 /* for slash */,
        -path.extname(filePath).length
      );
    }
  }

  if (bestAppMatch.length > bestAddonMatch.length) {
    isApp = true;
    relativePath = appRelativePath;
  } else {
    isApp = false;
    relativePath = addonRelativePath;
  }

  // this is pretty odd, but our tests in
  // transforms/ember-object/__testfixtures__ don't actually live in an ember
  // app or addon, so the standard logic above doesn't work for them
  //
  // this works by passing through the input file name when we are operating
  // on the local ember-es6-class-codemod repo **and** we were not able to
  // resolve a relativePath via normal means
  let isLocallyTesting = process.cwd() === path.resolve(__dirname, '../../..');

  if (!relativePath || isLocallyTesting) {
    let result = filePath.replace(/\.[^/.]+$/, '');

    return result;
  }

  if (!relativePath) {
    return;
  }

  if (isApp) {
    if (relativePath.startsWith('app')) {
      result = `${appModuleNameRoot}${relativePath.slice(3)}`;
    } else if (relativePath.startsWith('tests')) {
      result = `${appModuleNameRoot}/${relativePath}`;
    }
  } else {
    if (relativePath.startsWith('addon-test-support')) {
      result = `${addonModuleNameRoot}/test-support${relativePath.slice(18)}`;
    } else if (relativePath.startsWith('addon')) {
      result = `${addonModuleNameRoot}${relativePath.slice(5)}`;
    } else if (relativePath.startsWith('app') && appModuleNameRoot) {
      result = `${appModuleNameRoot}${relativePath.slice(3)}`;
    }
  }

  return result;
}

module.exports = {
  getModulePathFor,
};
