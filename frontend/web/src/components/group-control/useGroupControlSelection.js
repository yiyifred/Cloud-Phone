import { computed, ref, watch } from "vue";

import { getCachedRuntimeState, persistLocalStatePatch } from "../../utils/local-persistence-state.js";

/**
 * 群控页的「网格 + 勾选」状态机（T-430 从 GroupControlPanel 抽出）。
 *
 * 抽出理由：这块是纯状态与持久化逻辑（谁在网格里、谁被勾选、设备上下线时怎么迁移），
 * 与批量操作的编排（batchMode / 弹窗 / 结果）无关；放在面板里只会把 300 行额度吃光。
 * 状态仍属于调用它的组件实例（composable 只是把代码搬走），父组件通过返回值操作。
 */
export function useGroupControlSelection(devicesRef) {
  const gridSerials = ref([]);
  const activeSerials = ref([]);
  const stateInitialized = ref(false);
  let previousGridSerials = new Set();

  const onlineDevices = computed(() => devicesRef.value.filter((device) => device.connected));
  const onlineSerialSet = computed(() => new Set(onlineDevices.value.map((device) => device.serial)));

  const gridDevices = computed(() => {
    const serialSet = new Set(gridSerials.value);
    return devicesRef.value.filter((device) => serialSet.has(device.serial));
  });

  const activeSet = computed(() => new Set(activeSerials.value));

  const activeDevices = computed(() =>
    gridDevices.value.filter((device) => device.connected && activeSet.value.has(device.serial)),
  );

  function persistGridSerials(serials) {
    void persistLocalStatePatch({ runtimeState: { groupControlGridSerials: serials } });
  }

  function persistActiveSerials(serials) {
    void persistLocalStatePatch({ runtimeState: { groupControlActiveSerials: serials } });
  }

  function defaultGridSerials() {
    return onlineDevices.value.map((device) => device.serial);
  }

  // 网格变动后：保留仍然存在的勾选，并自动勾上「这次新进网格」的设备。
  // 这段顺序（先并集、再按原顺序比较）决定了持久化是否被无谓触发，别随手改写。
  function syncActiveWithGrid(grid, previousGrid) {
    const gridSet = new Set(grid);
    const next = new Set(activeSerials.value.filter((serial) => gridSet.has(serial)));

    for (const serial of grid) {
      if (!previousGrid.has(serial)) {
        next.add(serial);
      }
    }

    const merged = [...next];

    if (
      merged.length !== activeSerials.value.length ||
      merged.some((serial, index) => serial !== activeSerials.value[index])
    ) {
      activeSerials.value = merged;
      persistActiveSerials(merged);
    }
  }

  function initializeState() {
    const available = onlineSerialSet.value;
    const persisted = getCachedRuntimeState();
    let grid = Array.isArray(persisted.groupControlGridSerials)
      ? persisted.groupControlGridSerials.filter(Boolean)
      : null;
    let active = Array.isArray(persisted.groupControlActiveSerials)
      ? persisted.groupControlActiveSerials.filter(Boolean)
      : null;

    if (!grid?.length) {
      grid = defaultGridSerials();
    } else {
      grid = grid.filter(
        (serial) =>
          available.has(serial) || devicesRef.value.some((device) => device.serial === serial),
      );
    }
    gridSerials.value = grid;
    previousGridSerials = new Set(grid);
    persistGridSerials(grid);
    if (!active?.length) {
      active = grid.filter((serial) => available.has(serial));
    } else {
      const gridSet = new Set(grid);
      active = active.filter((serial) => gridSet.has(serial));
    }
    activeSerials.value = active;
    persistActiveSerials(active);
    stateInitialized.value = true;
  }

  function syncGridWithDevices() {
    if (!stateInitialized.value) {
      initializeState();
      return;
    }

    const known = new Set(devicesRef.value.map((device) => device.serial));
    const nextGrid = gridSerials.value.filter((serial) => known.has(serial));

    if (nextGrid.length !== gridSerials.value.length) {
      const previousGrid = new Set(gridSerials.value);
      gridSerials.value = nextGrid;
      previousGridSerials = new Set(nextGrid);
      persistGridSerials(nextGrid);
      syncActiveWithGrid(nextGrid, previousGrid);
      return;
    }

    const availableOnline = onlineSerialSet.value;
    const mergedGrid = [...nextGrid];
    let gridChanged = false;

    for (const serial of availableOnline) {
      if (!previousGridSerials.has(serial) && !mergedGrid.includes(serial)) {
        mergedGrid.push(serial);
        gridChanged = true;
      }
    }

    if (gridChanged) {
      const previousGrid = new Set(gridSerials.value);
      gridSerials.value = mergedGrid;
      previousGridSerials = new Set(mergedGrid);
      persistGridSerials(mergedGrid);
      syncActiveWithGrid(mergedGrid, previousGrid);
    }
  }

  function handleConfirmGridSelection(serials) {
    const previousGrid = new Set(gridSerials.value);
    gridSerials.value = serials;
    previousGridSerials = new Set(serials);
    persistGridSerials(serials);
    syncActiveWithGrid(serials, previousGrid);
  }

  function toggleDeviceActive(serial) {
    const next = new Set(activeSerials.value);

    if (next.has(serial)) {
      next.delete(serial);
    } else {
      next.add(serial);
    }

    activeSerials.value = [...next];
    persistActiveSerials(activeSerials.value);
  }

  function selectAllActive() {
    const onlineGrid = gridDevices.value
      .filter((device) => device.connected)
      .map((device) => device.serial);
    activeSerials.value = onlineGrid;
    persistActiveSerials(onlineGrid);
  }

  function deselectAllActive() {
    activeSerials.value = [];
    persistActiveSerials([]);
  }

  function isDeviceActive(serial) {
    return activeSet.value.has(serial);
  }

  watch(
    devicesRef,
    () => {
      syncGridWithDevices();
    },
    { immediate: true, deep: true },
  );

  return {
    gridSerials,
    activeSerials,
    gridDevices,
    activeDevices,
    handleConfirmGridSelection,
    toggleDeviceActive,
    selectAllActive,
    deselectAllActive,
    isDeviceActive,
  };
}
