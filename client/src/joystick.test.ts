import { test } from "node:test";
import assert from "node:assert/strict";
import { dragToDirectionName, createDirectionDeduper } from "./joystick.ts";

test("dragToDirectionName returns null below the dead zone", () => {
  assert.equal(dragToDirectionName(0, 0, 20), null);
  assert.equal(dragToDirectionName(5, 5, 20), null);
});

test("dragToDirectionName maps cardinal screen drags to world axes", () => {
  assert.equal(dragToDirectionName(40, 0, 20), "+x");
  assert.equal(dragToDirectionName(-40, 0, 20), "-x");
  assert.equal(dragToDirectionName(0, -40, 20), "+y");
  assert.equal(dragToDirectionName(0, 40, 20), "-y");
});

test("dragToDirectionName maps diagonal screen drags to the depth axis", () => {
  assert.equal(dragToDirectionName(40, -40, 20), "+z");
  assert.equal(dragToDirectionName(-40, -40, 20), "+z");
  assert.equal(dragToDirectionName(40, 40, 20), "-z");
  assert.equal(dragToDirectionName(-40, 40, 20), "-z");
});

test("createDirectionDeduper only reports changed directions", () => {
  const dedupe = createDirectionDeduper();
  assert.equal(dedupe("+x"), true);
  assert.equal(dedupe("+x"), false);
  assert.equal(dedupe("+x"), false);
  assert.equal(dedupe("-y"), true);
  assert.equal(dedupe("-y"), false);
  assert.equal(dedupe("+x"), true);
});

test("createDirectionDeduper ignores null choices", () => {
  const dedupe = createDirectionDeduper();
  assert.equal(dedupe(null), false);
  assert.equal(dedupe("+z"), true);
  assert.equal(dedupe(null), false);
  assert.equal(dedupe("+z"), false);
});
