/** Naive UI theme overrides aligned with Cloud Phone CSS variables */
export const naiveThemeOverrides = {
  common: {
    // 与 main.css 的 --primary 同步：#15803d 配白字 5.02:1（原 #22c55e 白字仅 2.28:1）
    primaryColor: "#15803d",
    primaryColorHover: "#166534",
    primaryColorPressed: "#14532d",
    primaryColorSuppl: "#15803d",
    borderRadius: "0.65rem",
    borderRadiusSmall: "0.55rem",
    fontSize: "13px",
    fontSizeSmall: "12px",
    heightMedium: "36px",
    heightSmall: "32px",
  },
  Button: {
    // 主色按钮文字固定白色：#15803d 上 5.02:1，满足 AA
    textColorPrimary: "#ffffff",
    borderRadiusMedium: "0.65rem",
    borderRadiusSmall: "0.55rem",
    fontWeightStrong: "600",
  },
  Card: {
    borderRadius: "0.75rem",
  },
  Collapse: {
    titleFontSize: "13px",
    titleFontWeight: "600",
  },
  Form: {
    labelFontSizeTop: "13px",
    labelFontWeight: "500",
  },
  Input: {
    borderRadius: "0.65rem",
  },
  Tabs: {
    tabBorderRadius: "0.55rem",
    tabFontWeightActive: "600",
    tabGapMediumLine: "0.35rem",
    tabPaddingMediumLine: "0.35rem",
  },
  Tag: {
    borderRadius: "999px",
  },
};
