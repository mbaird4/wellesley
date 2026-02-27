#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const prefix = '../src/app';

const tailwindCssPath = path.join(__dirname, prefix, '/tailwind.css');
const tailwindGeneratedCssPath = path.join(
  __dirname,
  prefix, '/tailwind.generated.css',
);
const stylesDir = path.join(__dirname, prefix, '/styles');
const srcDir = path.join(__dirname, prefix, '');

// Debounce function to avoid multiple rapid triggers
let debounceTimer = null;
const DEBOUNCE_DELAY = 100; // ms

function getAllScssFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  try {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        getAllScssFiles(filePath, fileList);
      } else if (file.endsWith('.scss')) {
        fileList.push(filePath);
      }
    });
  } catch (err) {
    // Ignore errors
  }
  return fileList;
}

function touchFile(filePath) {
  try {
    const time = new Date();
    fs.utimesSync(filePath, time, time);
    return true;
  } catch (err) {
    console.error(`[SCSS Watcher] Error touching file:`, err.message);
    return false;
  }
}

function triggerTailwindRegeneration(changedFile) {
  // Clear any pending debounce
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Debounce the trigger to avoid multiple rapid file changes
  debounceTimer = setTimeout(() => {
    console.log(
      `[SCSS Watcher] Detected change in: ${path.basename(changedFile)}`,
    );
    console.log(
      `[SCSS Watcher] Touching tailwind.css to trigger regeneration...`,
    );

    if (touchFile(tailwindCssPath)) {
      console.log(
        `[SCSS Watcher] Successfully triggered Tailwind regeneration`,
      );

      // Wait for Tailwind to regenerate, then touch generated CSS to trigger HMR
      setTimeout(() => {
        if (fs.existsSync(tailwindGeneratedCssPath)) {
          touchFile(tailwindGeneratedCssPath);
          console.log(
            `[SCSS Watcher] Touched generated CSS to trigger HMR`,
          );
        }
      }, 300);
    }
  }, DEBOUNCE_DELAY);
}

function watchDirectory(dir, callback) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const watchers = [];

  try {
    // Watch the directory recursively
    const watcher = fs.watch(
      dir,
      { recursive: true },
      (eventType, filename) => {
        if (filename && filename.endsWith('.scss')) {
          const fullPath = path.join(dir, filename);
          if (fs.existsSync(fullPath)) {
            callback(fullPath);
          }
        }
      },
    );
    watchers.push(watcher);
  } catch (err) {
    console.error(
      `[SCSS Watcher] Error watching directory ${dir}:`,
      err.message,
    );
  }

  return watchers;
}

// Get all SCSS files to watch
const scssFiles = [
  ...getAllScssFiles(stylesDir),
  ...getAllScssFiles(srcDir).filter((file) => {
    const relativePath = path.relative(srcDir, file);
    return !relativePath.startsWith('styles');
  }),
];

console.log('[SCSS Watcher] Initializing...');
console.log(`[SCSS Watcher] Found ${scssFiles.length} SCSS files to watch`);

// Watch the directories for changes
const watchers = [
  ...watchDirectory(stylesDir, triggerTailwindRegeneration),
  ...watchDirectory(srcDir, (filePath) => {
    const relativePath = path.relative(srcDir, filePath);
    if (!relativePath.startsWith('styles') && filePath.endsWith('.scss')) {
      triggerTailwindRegeneration(filePath);
    }
  }),
];

if (watchers.length === 0) {
  console.warn('[SCSS Watcher] No directories could be watched');
} else {
  console.log('[SCSS Watcher] Watching SCSS files for changes...');
  console.log(`[SCSS Watcher] Watching: ${stylesDir}`);
  console.log(`[SCSS Watcher] Watching: ${srcDir}`);
}

// Keep the process alive
process.stdin.resume();

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n[SCSS Watcher] Shutting down...');
  watchers.forEach((watcher) => {
    try {
      watcher.close();
    } catch (err) {
      // Ignore errors during cleanup
    }
  });
  process.exit(0);
});
