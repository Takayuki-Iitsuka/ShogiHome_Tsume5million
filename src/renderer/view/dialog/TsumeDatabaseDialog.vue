<template>
  <DialogFrame @cancel="onClose">
    <div class="root">
      <div class="title">{{ t.tsumeDatabase }}</div>

      <!-- フォルダ未設定時の選択UI -->
      <div v-if="!dataDirectory" class="section">
        <div class="notice">{{ t.tumeDataDirectoryNotSet }}</div>
        <button @click="onSelectDirectory">{{ t.selectTsumeDataDirectory }}</button>
      </div>

      <!-- フォルダ設定済み -->
      <template v-else>
        <!-- 手数選択 -->
        <div class="section">
          <div class="mate-buttons">
            <button
              v-for="num in mateNums"
              :key="num"
              :class="{ selected: mateNum === num }"
              @click="onSelectMate(num)"
            >
              {{ mateLabel(num) }}
            </button>
          </div>
        </div>

        <!-- インデックス構築中 -->
        <div v-if="isBuilding" class="section building">
          {{ t.buildingTsumeIndex }}
        </div>

        <!-- 問題選択UI -->
        <template v-else-if="lineCount > 0">
          <div class="section">
            <div class="current-sfen">{{ currentSfen || "-" }}</div>
          </div>
          <div class="section nav-row">
            <span class="label">{{ t.problemNumber }}</span>
            <button :disabled="currentLineNumber <= 1" @click="onPrev">◀</button>
            <input
              v-model.number="inputLineNumber"
              class="number"
              type="number"
              min="1"
              :max="lineCount"
              @change="onLineNumberInput"
            />
            <span class="total">/ {{ lineCount.toLocaleString() }}</span>
            <button :disabled="currentLineNumber >= lineCount" @click="onNext">▶</button>
            <button @click="onRandom">{{ t.randomProblem }}</button>
          </div>
        </template>

        <div v-else class="section notice">{{ t.tsumeFileNotFound }}{{ currentFilePath }}</div>
      </template>

      <!-- 下部ボタン -->
      <div class="main-buttons">
        <button v-if="currentSfen" data-hotkey="Enter" autofocus @click="onLoadToBoard">
          {{ t.loadToBoard }}
        </button>
        <button v-if="dataDirectory" @click="onSelectDirectory">
          {{ t.selectTsumeDataDirectory }}
        </button>
        <button data-hotkey="Escape" @click="onClose">{{ t.close }}</button>
      </div>
    </div>
  </DialogFrame>
</template>

<script setup lang="ts">
import { t } from "@/common/i18n";
import api from "@/renderer/ipc/api";
import { useStore } from "@/renderer/store";
import { useAppSettings } from "@/renderer/store/settings";
import { useErrorStore } from "@/renderer/store/error";
import { computed, onMounted, ref, watch } from "vue";
import DialogFrame from "./DialogFrame.vue";
import { join as pathJoin } from "@/renderer/helpers/path";

type MateNum = 3 | 5 | 7 | 9 | 11;

const store = useStore();
const appSettings = useAppSettings();

const mateNums: MateNum[] = [3, 5, 7, 9, 11];
const mateNum = ref<MateNum>(3);
const dataDirectory = computed(() => appSettings.tsumeDataDirectory);
const currentFilePath = computed(() => {
  if (!dataDirectory.value) {
    return "";
  }
  return pathJoin(dataDirectory.value, `mate${mateNum.value}.sfen`);
});

const lineCount = ref(0);
const currentLineNumber = ref(0);
const inputLineNumber = ref(1);
const currentSfen = ref("");
const isBuilding = ref(false);

const mateLabel = (num: MateNum): string => {
  switch (num) {
    case 3:
      return t.mate3;
    case 5:
      return t.mate5;
    case 7:
      return t.mate7;
    case 9:
      return t.mate9;
    case 11:
      return t.mate11;
  }
};

onMounted(async () => {
  if (dataDirectory.value) {
    await buildIndex();
  }
});

watch(currentFilePath, async () => {
  lineCount.value = 0;
  currentLineNumber.value = 0;
  currentSfen.value = "";
  if (dataDirectory.value) {
    await buildIndex();
  }
});

async function buildIndex() {
  isBuilding.value = true;
  lineCount.value = 0;
  try {
    lineCount.value = await api.buildTsumeIndex(currentFilePath.value);
  } catch (e) {
    useErrorStore().add(e);
  } finally {
    isBuilding.value = false;
  }
}

async function loadLine(lineNum: number) {
  try {
    const lines = await api.getTsumeLines(currentFilePath.value, [lineNum]);
    currentSfen.value = lines[0] || "";
    currentLineNumber.value = lineNum;
    inputLineNumber.value = lineNum;
  } catch (e) {
    useErrorStore().add(e);
  }
}

const onSelectMate = async (num: MateNum) => {
  mateNum.value = num;
};

const onRandom = async () => {
  try {
    const result = await api.getRandomTsumeLines(currentFilePath.value, 1);
    if (result.sfens.length > 0) {
      currentSfen.value = result.sfens[0];
      currentLineNumber.value = result.lineNumbers[0];
      inputLineNumber.value = result.lineNumbers[0];
    }
  } catch (e) {
    useErrorStore().add(e);
  }
};

const onPrev = async () => {
  if (currentLineNumber.value > 1) {
    await loadLine(currentLineNumber.value - 1);
  }
};

const onNext = async () => {
  if (currentLineNumber.value < lineCount.value) {
    await loadLine(currentLineNumber.value + 1);
  }
};

const onLineNumberInput = async () => {
  const n = Math.max(1, Math.min(lineCount.value, inputLineNumber.value));
  await loadLine(n);
};

const onLoadToBoard = () => {
  if (currentSfen.value) {
    store.pasteRecord(currentSfen.value);
  }
  onClose();
};

const onSelectDirectory = async () => {
  try {
    const dir = await api.showSelectTsumeDirectoryDialog();
    if (dir) {
      await appSettings.updateAppSettings({ tsumeDataDirectory: dir });
      await buildIndex();
    }
  } catch (e) {
    useErrorStore().add(e);
  }
};

const onClose = () => {
  store.closeTsumeDatabaseDialog();
};
</script>

<style scoped>
.root {
  width: 520px;
}
.title {
  font-size: 1.2em;
  font-weight: bold;
  margin-bottom: 12px;
}
.section {
  margin-bottom: 10px;
}
.mate-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.mate-buttons button {
  padding: 4px 10px;
}
.mate-buttons button.selected {
  font-weight: bold;
  text-decoration: underline;
}
.nav-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nav-row .label {
  white-space: nowrap;
}
.nav-row .total {
  white-space: nowrap;
  color: var(--text-color-secondary, #888);
}
input.number {
  text-align: right;
  width: 90px;
}
.current-sfen {
  font-family: monospace;
  font-size: 0.85em;
  word-break: break-all;
  color: var(--text-color-secondary, #888);
  border: 1px solid var(--dialog-border-color);
  padding: 4px 6px;
  border-radius: 4px;
  min-height: 1.4em;
}
.building {
  color: var(--text-color-secondary, #888);
}
.notice {
  color: var(--text-color-secondary, #888);
}
.main-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
