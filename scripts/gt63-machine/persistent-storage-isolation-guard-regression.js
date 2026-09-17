const fs = require("fs");
const path = require("path");
const os = require("os");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..", "..");
const SERVER = path.join(ROOT, "server.js");
const source = fs.readFileSync(SERVER, "utf8");

const helperStart = source.indexOf("function isStrictDescendantPath");
const guardStart = source.indexOf("function validateRuntimeIsolation");
const ensureDbStart = source.indexOf("function ensureDb");

assert.ok(helperStart >= 0, "Missing isStrictDescendantPath()");
assert.ok(guardStart > helperStart, "Missing validateRuntimeIsolation()");
assert.ok(ensureDbStart > guardStart, "Missing ensureDb() boundary");

const isolatedSource = source.slice(helperStart, ensureDbStart);

function runGuard({
  isolated = true,
  dbFile,
  mountPath,
  liveBaseUrl = "http://localhost:3001",
  setup
} = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-isolation-"));

  try {
    const mountRoot = mountPath === undefined
  ? path.join(tempRoot, "volume")
  : mountPath;
    const targetDb = dbFile === undefined
      ? path.join(mountRoot, "DATABASE", "database.json")
      : dbFile;

    if (setup) setup({ tempRoot, mountRoot, targetDb });

    const context = {
      fs,
      path,
      GT63_REQUIRE_ISOLATED_STORAGE: isolated,
      DB_FILE: targetDb,
      LIVE_BASE_URL: liveBaseUrl,
      process: {
        env: {
          DB_FILE: targetDb || "",
          RAILWAY_VOLUME_MOUNT_PATH: mountRoot || ""
        }
      }
    };

    vm.createContext(context);
vm.runInContext(isolatedSource, context);
vm.runInContext("validateRuntimeIsolation();", context);

return { ok: true };
  } catch (error) {
    return { ok: false, error };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function expectPass(result) {
  assert.strictEqual(
    result.ok,
    true,
    result.error ? result.error.message : "Expected PASS"
  );
}

function expectFail(result, pattern) {
  assert.strictEqual(result.ok, false, "Expected FAIL");
  if (pattern) assert.match(result.error.message, pattern);
}

test("isolation-disabled-preserves-existing-behavior", () => {
  expectPass(runGuard({
    isolated: false,
    dbFile: "",
    mountPath: ""
  }));
});

test("missing-explicit-db-file-fails", () => {
  const result = runGuard({
    dbFile: "",
    setup: ({ mountRoot }) => fs.mkdirSync(mountRoot, { recursive: true })
  });
  expectFail(result, /requires explicit DB_FILE/);
});

test("missing-mount-variable-fails", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-db-"));
  try {
    const result = runGuard({
      dbFile: path.join(temp, "database.json"),
      mountPath: ""
    });
    expectFail(result, /requires RAILWAY_VOLUME_MOUNT_PATH/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("nonexistent-mount-fails", () => {
  const result = runGuard({
    setup: () => {}
  });
  expectFail(result, /mount path does not exist/);
});

test("mount-not-directory-fails", () => {
  const result = runGuard({
    setup: ({ mountRoot }) => {
      fs.writeFileSync(mountRoot, "x", "utf8");
    }
  });
  expectFail(result, /not a directory/);
});

test("db-file-equals-mount-fails", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-equal-"));

  try {
    const mountRoot = path.join(tempRoot, "volume");
    fs.mkdirSync(mountRoot, { recursive: true });

    const result = runGuard({
      mountPath: mountRoot,
      dbFile: mountRoot
    });

    expectFail(result, /strict descendant/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
test("direct-descendant-passes", () => {
  const result = runGuard({
    setup: ({ mountRoot }) => {
      fs.mkdirSync(mountRoot, { recursive: true });
    }
  });
  expectPass(result);
});

test("nested-descendant-passes", () => {
  const result = runGuard({
    setup: ({ mountRoot }) => {
      fs.mkdirSync(path.join(mountRoot, "nested"), { recursive: true });
    },
    dbFile: undefined
  });

  expectPass(result);
});

test("outside-mount-fails", () => {
  const result = runGuard({
    setup: ({ mountRoot }) => {
      fs.mkdirSync(mountRoot, { recursive: true });
    },
    dbFile: path.resolve(os.tmpdir(), "gt63-outside", "database.json")
  });
  expectFail(result, /strict descendant/);
});

test("dot-dot-escape-fails", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-escape-"));
  try {
    const mountRoot = path.join(tempRoot, "volume");
    fs.mkdirSync(mountRoot, { recursive: true });

    const result = runGuard({
      mountPath: mountRoot,
      dbFile: path.join(mountRoot, "..", "outside", "database.json")
    });

    expectFail(result, /strict descendant/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("textual-prefix-collision-fails", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-prefix-"));
  try {
    const mountRoot = path.join(tempRoot, "data");
    fs.mkdirSync(mountRoot, { recursive: true });

    const result = runGuard({
      mountPath: mountRoot,
      dbFile: path.join(`${mountRoot}-ephemeral`, "database.json")
    });

    expectFail(result, /strict descendant/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("data-dir-only-fails", () => {
  const result = runGuard({
    dbFile: "",
    setup: ({ mountRoot }) => {
      fs.mkdirSync(mountRoot, { recursive: true });
    }
  });
  expectFail(result, /requires explicit DB_FILE/);
});

test("persistent-data-dir-only-fails", () => {
  const result = runGuard({
    dbFile: "",
    setup: ({ mountRoot }) => {
      fs.mkdirSync(mountRoot, { recursive: true });
    }
  });
  expectFail(result, /requires explicit DB_FILE/);
});

test("production-live-base-url-fails", () => {
  const result = runGuard({
    liveBaseUrl: "https://2l1p-neural-travel-production.up.railway.app",
    setup: ({ mountRoot }) => {
      fs.mkdirSync(mountRoot, { recursive: true });
    }
  });
  expectFail(result, /must not use the V8 production LIVE_BASE_URL/);
});

let passed = 0;

for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err && err.stack ? err.stack : err);
    console.log(`${passed}/${tests.length} PASS`);
    process.exitCode = 1;
    process.exit();
  }
}

console.log(`${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;