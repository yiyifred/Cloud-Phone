/**
 * 极简 Prometheus 指标原语（文本格式 0.0.4）。
 *
 * 为什么不用 prom-client：后端依赖本来就少，为五个指标引一条依赖链不划算；
 * 更要紧的是本项目真正的风险是「标签基数失控」——设备序列号、sessionKey 都是
 * 高基数值，一旦被当成标签写进来，进程内存会随请求数单调增长。自己实现才能在
 * 写死的序列上限内丢弃超量序列，并把丢弃数暴露出来。
 */

/** 单个指标最多保留的标签组合数；超出后丢弃新序列并计数。 */
const MAX_SERIES_PER_METRIC = 500;

/** @type {Array<{name: string, help: string, type: string, render: () => string[]}>} */
const definitions = [];

/** @type {Map<string, number>} 被丢弃的样本数，按指标名。 */
const droppedByMetric = new Map();

function escapeLabelValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/** 标签按名字排序后渲染成 `a="1",b="2"`，同时当作序列的稳定 key。 */
function renderLabelSet(labels) {
  const entries = Object.entries(labels ?? {});

  if (entries.length === 0) {
    return "";
  }

  return entries
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([name, value]) => `${name}="${escapeLabelValue(value)}"`)
    .join(",");
}

function formatValue(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function formatSeriesLine(name, labels, value) {
  return labels ? `${name}{${labels}} ${formatValue(value)}` : `${name} ${formatValue(value)}`;
}

function countDropped(metricName) {
  droppedByMetric.set(metricName, (droppedByMetric.get(metricName) ?? 0) + 1);
}

/** 一条指标下的序列集合：负责基数上限与丢弃计数。 */
function createSeriesMap(metricName) {
  const entries = new Map();

  return {
    entries,
    get(labels) {
      const key = renderLabelSet(labels);
      const found = entries.get(key);

      if (found) {
        return found;
      }

      if (entries.size >= MAX_SERIES_PER_METRIC) {
        countDropped(metricName);
        return null;
      }

      const series = { labels: key };
      entries.set(key, series);
      return series;
    },
  };
}

function register(definition) {
  definitions.push(definition);
}

/**
 * 计数器：只增不减，进程重启归零（Prometheus 的 rate() 会处理重置）。
 * @param {string} name
 * @param {string} help
 */
export function defineCounter(name, help) {
  const seriesMap = createSeriesMap(name);

  register({
    name,
    help,
    type: "counter",
    render() {
      const lines = [];
      for (const series of seriesMap.entries.values()) {
        lines.push(formatSeriesLine(name, series.labels, series.value ?? 0));
      }
      return lines;
    },
  });

  return {
    name,
    /** @param {Record<string, string>} [labels] */
    inc(labels = {}, delta = 1) {
      const series = seriesMap.get(labels);
      if (series) {
        series.value = (series.value ?? 0) + delta;
      }
    },
  };
}

/**
 * Gauge：可增可减的瞬时值（WS 连接数、进行中的会话数）。
 * @param {string} name
 * @param {string} help
 */
export function defineGauge(name, help) {
  const seriesMap = createSeriesMap(name);

  register({
    name,
    help,
    type: "gauge",
    render() {
      const lines = [];
      for (const series of seriesMap.entries.values()) {
        lines.push(formatSeriesLine(name, series.labels, series.value ?? 0));
      }
      return lines;
    },
  });

  const write = (labels, delta) => {
    const series = seriesMap.get(labels);
    if (series) {
      // 计数型 gauge 不能变负：泄漏一次减号会让面板长期显示负连接数
      series.value = Math.max(0, (series.value ?? 0) + delta);
    }
  };

  return {
    name,
    /** @param {Record<string, string>} [labels] */
    inc(labels = {}) {
      write(labels, 1);
    },
    /** @param {Record<string, string>} [labels] */
    dec(labels = {}) {
      write(labels, -1);
    },
    /** @param {Record<string, string>} [labels] @param {number} value */
    set(labels = {}, value) {
      const series = seriesMap.get(labels);
      if (series) {
        series.value = Number.isFinite(value) ? value : 0;
      }
    },
  };
}

/**
 * 直方图（固定 bucket）：记录 count/sum 与每个 bucket 的累计数。
 * @param {string} name
 * @param {string} help
 * @param {number[]} buckets 秒为单位的 bucket 上界
 */
export function defineHistogram(name, help, buckets) {
  const seriesMap = createSeriesMap(name);
  const sortedBuckets = [...buckets].sort((left, right) => left - right);

  const emptyValues = () => ({
    counts: new Array(sortedBuckets.length).fill(0),
    sum: 0,
    count: 0,
  });

  register({
    name,
    help,
    type: "histogram",
    render() {
      const lines = [];

      for (const series of seriesMap.entries.values()) {
        const values = series.values ?? emptyValues();
        sortedBuckets.forEach((bucket, index) => {
          const le = `le="${bucket}"`;
          lines.push(
            formatSeriesLine(name, series.labels ? `${series.labels},${le}` : le, values.counts[index]),
          );
        });
        const inf = 'le="+Inf"';
        lines.push(formatSeriesLine(name, series.labels ? `${series.labels},${inf}` : inf, values.count));
        lines.push(formatSeriesLine(`${name}_sum`, series.labels, values.sum));
        lines.push(formatSeriesLine(`${name}_count`, series.labels, values.count));
      }

      return lines;
    },
  });

  return {
    name,
    /** @param {Record<string, string>} [labels] @param {number} seconds */
    observe(labels = {}, seconds) {
      const series = seriesMap.get(labels);
      if (!series) {
        return;
      }

      series.values ??= emptyValues();
      const value = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
      series.values.sum += value;
      series.values.count += 1;

      for (let index = 0; index < sortedBuckets.length; index += 1) {
        if (value <= sortedBuckets[index]) {
          series.values.counts[index] += 1;
        }
      }
    },
  };
}

/**
 * 采集时求值的 gauge：投屏会话数这类量本来就有权威状态源（session store），
 * 手工 inc/dec 维护迟早会和真实状态漂移，所以每次抓取时现算。
 * @param {string} name
 * @param {string} help
 * @param {() => number} collect
 */
export function defineCollectedGauge(name, help, collect) {
  register({
    name,
    help,
    type: "gauge",
    render() {
      const value = Number(collect());
      return [formatSeriesLine(name, "", Number.isFinite(value) ? value : 0)];
    },
  });

  return { name };
}

/** 渲染成 Prometheus 文本格式；没有样本的指标只输出 HELP/TYPE。 */
export function renderMetrics() {
  const lines = [];

  for (const definition of definitions) {
    lines.push(`# HELP ${definition.name} ${definition.help}`);
    lines.push(`# TYPE ${definition.name} ${definition.type}`);
    lines.push(...definition.render());
  }

  const dropped = [...droppedByMetric.entries()].filter(([, count]) => count > 0);

  if (dropped.length > 0) {
    lines.push("# HELP cloud_phone_metrics_dropped_series_total 超出单指标序列上限而被丢弃的样本数");
    lines.push("# TYPE cloud_phone_metrics_dropped_series_total counter");
    for (const [metricName, count] of dropped) {
      lines.push(
        formatSeriesLine(
          "cloud_phone_metrics_dropped_series_total",
          `metric="${escapeLabelValue(metricName)}"`,
          count,
        ),
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
