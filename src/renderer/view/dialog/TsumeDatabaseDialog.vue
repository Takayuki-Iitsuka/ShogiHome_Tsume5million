<template>
  <DialogFrame @cancel="onClose">
    <div class="root">
      <div class="title">{{ t.tsumeDatabase }}</div>

      <!-- フォルダ未設定時の選択UI -->
      <div v-if="!dataDirectory" class="section">
        <div class="notice">{{ t.tsumeDataDirectoryNotSet }}</div>
        <button @click="onSelectDirectory">{{ t.selectTsumeDataDirectory }}</button>
      </div>

      <!-- フォルダ設定済み -->
      <template v-else>
        <!-- 手数選択 -->
        <div class="section">
          <div class="mate-buttons">
            <button
              v-for="num in tsumeMateCounts"
              :key="num"
              :class="{ selected: mateNum === num }"
              @click="onSelectMate(num)"
            >
              {{ t.mateN(num) }}
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

        <div v-else class="section notice">{{ t.tsumeFileNotFound(currentFilePath) }}</div>
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
import { tsumeMateCounts, tsumeFileName, type TsumeMateCount } from "@/common/tsume";

const store = useStore();
const appSettings = useAppSettings();
const errorStore = useErrorStore();

const mateNum = ref<TsumeMateCount>(3);
const dataDirectory = computed(() => appSettings.tsumeDataDirectory);
const currentFilePath = computed(() => {
  if (!dataDirectory.value) {
    return "";
  }
  return pathJoin(dataDirectory.value, tsumeFileName(mateNum.value));
});

const lineCount = ref(0);
const currentLineNumber = ref(0);
const inputLineNumber = ref(1);
const currentSfen = ref("");
const isBuilding = ref(false);

// 手数の切り替えなどで複数の非同期要求が並行したとき、先に発行した要求の応答が
// 後から届いて新しい状態を上書きしないよう、要求ごとの通し番号で新旧を判定する。
// 特にインデックス構築は大きなファイルでは数秒かかるため取り違えが起こり得る。
let indexRequestId = 0;
let problemRequestId = 0;

onMounted(async () => {
  if (dataDirectory.value) {
    await buildIndex();
  }
});

watch(currentFilePath, async () => {
  problemRequestId++; // 対象ファイルが変わるため実行中の問題読み込みの結果は破棄する
  lineCount.value = 0;
  currentLineNumber.value = 0;
  inputLineNumber.value = 1;
  currentSfen.value = "";
  if (dataDirectory.value) {
    await buildIndex();
  }
});

// 現在の問題（SFENと行番号）を一括更新する。
function setCurrentProblem(sfen: string, lineNum: number) {
  currentSfen.value = sfen;
  currentLineNumber.value = lineNum;
  inputLineNumber.value = lineNum;
}

async function buildIndex() {
  const requestId = ++indexRequestId;
  isBuilding.value = true;
  lineCount.value = 0;
  try {
    const count = await api.buildTsumeIndex(currentFilePath.value);
    if (requestId !== indexRequestId) {
      return; // より新しい要求が発行済みのため破棄する
    }
    lineCount.value = count;
  } catch (e) {
    if (requestId === indexRequestId) {
      errorStore.add(e);
    }
  } finally {
    if (requestId === indexRequestId) {
      isBuilding.value = false;
    }
  }
}

async function loadLine(lineNum: number) {
  const requestId = ++problemRequestId;
  try {
    const [sfen] = await api.getTsumeLines(currentFilePath.value, [lineNum]);
    if (requestId !== problemRequestId) {
      return; // より新しい要求が発行済みのため破棄する
    }
    setCurrentProblem(sfen || "", lineNum);
  } catch (e) {
    if (requestId === problemRequestId) {
      errorStore.add(e);
    }
  }
}

const onSelectMate = (num: TsumeMateCount) => {
  mateNum.value = num;
};

const onRandom = async () => {
  const requestId = ++problemRequestId;
  try {
    const { sfens, lineNumbers } = await api.getRandomTsumeLines(currentFilePath.value, 1);
    if (requestId !== problemRequestId) {
      return; // より新しい要求が発行済みのため破棄する
    }
    if (sfens.length > 0) {
      setCurrentProblem(sfens[0], lineNumbers[0]);
    }
  } catch (e) {
    if (requestId === problemRequestId) {
      errorStore.add(e);
    }
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
  // v-model.number は空入力などで数値以外（"" や NaN）になり得るため、
  // その場合は現在の問題番号に戻して読み込みを行わない。
  const raw: unknown = inputLineNumber.value;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    inputLineNumber.value = currentLineNumber.value;
    return;
  }
  const n = Math.max(1, Math.min(lineCount.value, Math.floor(raw)));
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
    errorStore.add(e);
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
}
input.number {
  text-align: right;
  width: 90px;
}
.current-sfen {
  font-family: monospace;
  font-size: 0.85em;
  word-break: break-all;
  border: 1px solid var(--dialog-border-color);
  padding: 4px 6px;
  border-radius: 4px;
  min-height: 1.4em;
}
/* 補足的なテキストの色をまとめて指定する。 */
.nav-row .total,
.current-sfen,
.building,
.notice {
  color: var(--text-color-secondary, #888);
}
.main-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
