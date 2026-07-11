"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ALL_SUPPLIERS_VALUE,
  buildProjectDownloadSupplierState,
  isProjectDownloadSupplierSelectionValid,
} = require("./options-project-download-supplier");

test("project download supplier helper exposes all option for a single supplier dataset", function () {
  const state = buildProjectDownloadSupplierState({
    supplierRequired: false,
    suppliers: ["希尔贝壳"],
  });

  assert.equal(state.showRow, true);
  assert.equal(state.supplierRequired, false);
  assert.deepEqual(state.options, [
    { value: ALL_SUPPLIERS_VALUE, label: "全部" },
    { value: "希尔贝壳", label: "希尔贝壳" },
  ]);
});

test("project download supplier helper treats all option as valid for multi-supplier datasets", function () {
  const dataset = {
    supplierRequired: true,
    suppliers: ["海天", "希尔贝壳"],
  };

  assert.equal(
    isProjectDownloadSupplierSelectionValid(dataset, ALL_SUPPLIERS_VALUE),
    true
  );
  assert.equal(isProjectDownloadSupplierSelectionValid(dataset, ""), false);
});
