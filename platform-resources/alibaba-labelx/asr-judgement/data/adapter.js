"use strict";

function isBlank(value) {
  return String(value === undefined || value === null ? "" : value).trim() === "";
}

function normalizeValue(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

function getLabelSlots(row) {
  return [1, 2, 3].map(function (slot) {
    return {
      slot: slot,
      subTaskId: normalizeValue(row?.["标注员" + slot + "子任务ID"] || ""),
      userName: normalizeValue(row?.["标注员" + slot + "_P"] || ""),
    };
  });
}

function pickRow(rows, role, subTaskId, userName) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    return null;
  }
  const subTaskIdText = String(subTaskId || "").trim();
  if (role === "audit") {
    if (subTaskIdText) {
      const byId = list.find(function (row) {
        return String(row["审核子任务ID"] || "").trim() === subTaskIdText;
      });
      if (byId) {
        return byId;
      }
    }
    return (
      list.find(function (row) {
        return !isBlank(row["审核子任务ID"]);
      }) || list[0]
    );
  }

  const userNameText = normalizeValue(userName);
  if (!subTaskIdText && !userNameText) {
    return list[0];
  }

  for (let index = 0; index < list.length; index += 1) {
    const row = list[index];
    const matched = getLabelSlots(row).some(function (slot) {
      return slot.subTaskId === subTaskIdText && slot.userName === userNameText;
    });
    if (matched) {
      return row;
    }
  }

  if (subTaskIdText) {
    for (let index = 0; index < list.length; index += 1) {
      const row = list[index];
      const matched = getLabelSlots(row).some(function (slot) {
        return slot.subTaskId === subTaskIdText;
      });
      if (matched) {
        return row;
      }
    }
  }

  if (userNameText) {
    for (let index = 0; index < list.length; index += 1) {
      const row = list[index];
      const matched = getLabelSlots(row).some(function (slot) {
        return slot.userName === userNameText;
      });
      if (matched) {
        return row;
      }
    }
  }

  return list[0];
}

function evaluateCompletion(row, role, subTaskId, userName) {
  const target = row || {};
  const missingFields = [];
  ["分包ID", "任务名称", "任务ID", "题数"].forEach(function (field) {
    if (isBlank(target[field])) {
      missingFields.push(field);
    }
  });
  if (role === "audit") {
    if (isBlank(target["审核子任务ID"])) {
      missingFields.push("审核子任务ID");
    }
    const complete = missingFields.length === 0;
    return {
      complete,
      missingFields: complete ? [] : missingFields,
    };
  }

  const targetSubTaskId = normalizeValue(subTaskId);
  const targetUserName = normalizeValue(userName);
  const slots = getLabelSlots(target);
  if (!targetSubTaskId) {
    missingFields.push("标注员子任务ID");
  }
  if (!targetUserName) {
    missingFields.push("标注员_P");
  }
  const exactSlot = slots.find(function (slot) {
    return slot.subTaskId === targetSubTaskId && slot.userName === targetUserName;
  });
  if (exactSlot && missingFields.length === 0) {
    return {
      complete: true,
      missingFields: [],
    };
  }

  if (missingFields.length === 0) {
    const subTaskConflict = slots.find(function (slot) {
      return slot.subTaskId === targetSubTaskId && slot.userName !== targetUserName;
    });
    if (subTaskConflict) {
      missingFields.push("标注员双键冲突:子任务ID命中但用户名不一致");
    }
    const userConflict = slots.find(function (slot) {
      return slot.userName === targetUserName && slot.subTaskId !== targetSubTaskId;
    });
    if (userConflict) {
      missingFields.push("标注员双键冲突:用户名命中但子任务ID不一致");
    }
    if (missingFields.length === 0) {
      missingFields.push("标注员双键未命中");
    }
  }
  return {
    complete: false,
    missingFields,
  };
}

function getMissingFieldsForAbsentBatch(role, subTaskId, userName) {
  if (role === "audit") {
    return ["审核子任务ID"];
  }
  const missingFields = [];
  if (isBlank(subTaskId)) {
    missingFields.push("标注员子任务ID");
  }
  if (isBlank(userName)) {
    missingFields.push("标注员_P");
  }
  return missingFields.length > 0 ? missingFields : ["标注员双键未命中"];
}

function getBatchIdFromRow(row) {
  return String(row?.["分包ID"] || "").trim();
}

module.exports = {
  datasetId: "asr-judgement-statistics",
  downloadFilePrefix: "asr-judgement",
  getBatchIdFromRow,
  getMissingFieldsForAbsentBatch,
  pickRow,
  evaluateCompletion,
};
