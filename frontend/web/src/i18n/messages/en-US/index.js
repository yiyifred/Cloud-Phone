import access from "./access.js";
import app from "./app.js";
import auth from "./auth.js";
import common from "./common.js";
import devices from "./devices.js";
import groupControl from "./group-control.js";
import iconHelper from "./icon-helper.js";
import logs from "./logs.js";
import settings from "./settings.js";
import share from "./share.js";

export default {
  ...common,
  ...settings,
  ...auth,
  ...devices,
  ...groupControl,
  ...logs,
  ...app,
  ...iconHelper,
  ...share,
  ...access,
};
