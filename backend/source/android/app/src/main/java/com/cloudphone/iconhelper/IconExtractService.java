package com.cloudphone.iconhelper;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;

import java.io.ByteArrayOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Extracts launcher app labels/icons into Android/data files.
 * Skips rewrite when the launcher fingerprint is unchanged.
 */
public final class IconExtractService extends Service {
  public static final String ACTION_EXTRACT = "com.cloudphone.iconhelper.EXTRACT";

  private static final String CHANNEL_ID = "icon_extract";
  private static final int NOTIFICATION_ID = 1001;
  private static final int ICON_SIZE_PX = 96;

  private HandlerThread workerThread;
  private Handler workerHandler;
  private boolean running;

  @Override
  public void onCreate() {
    super.onCreate();
    ensureChannel();
    workerThread = new HandlerThread("icon-extract");
    workerThread.start();
    workerHandler = new Handler(workerThread.getLooper());
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    startForeground(NOTIFICATION_ID, buildNotification("Starting…"));
    if (!running) {
      running = true;
      workerHandler.post(this::runExtract);
    }
    return START_NOT_STICKY;
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public void onDestroy() {
    if (workerThread != null) {
      workerThread.quitSafely();
      workerThread = null;
    }
    super.onDestroy();
  }

  private void runExtract() {
    File root = getExternalFilesDir(null);
    if (root == null) {
      writeProgress(null, "error", 0, 0, "", "external files dir unavailable");
      stopSelfSafely();
      return;
    }

    File iconsDir = new File(root, "icons");
    //noinspection ResultOfMethodCallIgnored
    iconsDir.mkdirs();

    try {
      List<LauncherApp> apps = queryLauncherApps();
      Map<String, IconRender> renderedIcons = new LinkedHashMap<>();
      List<String> fingerprintRows = new ArrayList<>(apps.size());
      for (LauncherApp app : apps) {
        IconRender render = renderIconPng(app.icon);
        renderedIcons.put(app.packageName, render);
        String iconHash = render != null ? render.iconHash : "";
        // Include icon hash so "same package but icon changed" triggers re-extract.
        fingerprintRows.add(app.packageName + "|" + app.activity + "|" + app.label + "|" + iconHash);
      }
      String fingerprint = AppListFingerprint.compute(fingerprintRows);
      String previous = AppListFingerprint.readFingerprint(root);
      File appsFile = new File(root, "apps.json");

      if (fingerprint.equals(previous) && appsFile.isFile() && iconsDir.isDirectory()) {
        writeProgress(root, "done", apps.size(), apps.size(), "", "unchanged");
        updateNotification("Unchanged (" + apps.size() + ")");
        stopSelfSafely();
        return;
      }

      writeProgress(root, "running", apps.size(), 0, "", "extracting");
      JSONArray appsJson = new JSONArray();
      int done = 0;

      for (LauncherApp app : apps) {
        updateNotification("Extracting " + app.label + " (" + (done + 1) + "/" + apps.size() + ")");
        writeProgress(root, "running", apps.size(), done, app.packageName, app.label);

        String iconRel = "icons/" + app.packageName + ".png";
        File iconFile = new File(root, iconRel);
        IconRender render = renderedIcons.get(app.packageName);
        boolean wroteIcon = false;
        String iconHash = render != null ? render.iconHash : null;
        if (render != null && render.pngBytes != null && render.pngBytes.length > 0) {
          try (FileOutputStream fos = new FileOutputStream(iconFile)) {
            fos.write(render.pngBytes);
            wroteIcon = true;
          } catch (Exception ignored) {
            wroteIcon = false;
          }
        }

        JSONObject row = new JSONObject();
        row.put("packageName", app.packageName);
        row.put("activity", app.activity);
        row.put("label", app.label);
        row.put("iconFile", wroteIcon ? iconRel : JSONObject.NULL);
        row.put("iconHash", iconHash != null ? iconHash : JSONObject.NULL);
        appsJson.put(row);

        done += 1;
        writeProgress(root, "running", apps.size(), done, app.packageName, app.label);
      }

      writeText(new File(root, "apps.json"), appsJson.toString());
      AppListFingerprint.writeManifest(root, fingerprint, done);
      writeProgress(root, "done", apps.size(), done, "", "complete");
      updateNotification("Done (" + done + ")");
    } catch (Exception error) {
      writeProgress(root, "error", 0, 0, "", String.valueOf(error.getMessage()));
    } finally {
      stopSelfSafely();
    }
  }

  private List<LauncherApp> queryLauncherApps() {
    PackageManager pm = getPackageManager();
    Intent intent = new Intent(Intent.ACTION_MAIN);
    intent.addCategory(Intent.CATEGORY_LAUNCHER);
    List<ResolveInfo> resolved = pm.queryIntentActivities(intent, 0);
    Map<String, LauncherApp> byPackage = new LinkedHashMap<>();

    for (ResolveInfo info : resolved) {
      if (info.activityInfo == null || info.activityInfo.packageName == null) {
        continue;
      }
      String packageName = info.activityInfo.packageName;
      if (byPackage.containsKey(packageName)) {
        continue;
      }
      String activity = info.activityInfo.name;
      CharSequence labelCs = info.loadLabel(pm);
      String label = labelCs != null ? labelCs.toString() : packageName;
      Drawable icon = info.loadIcon(pm);
      if (icon == null) {
        try {
          ApplicationInfo appInfo = pm.getApplicationInfo(packageName, 0);
          icon = pm.getApplicationIcon(appInfo);
        } catch (PackageManager.NameNotFoundException ignored) {
          icon = null;
        }
      }
      byPackage.put(packageName, new LauncherApp(packageName, activity, label, icon));
    }
    return new ArrayList<>(byPackage.values());
  }

  private boolean writeIconPng(Drawable drawable, File outFile) {
    if (drawable == null) {
      return false;
    }
    try {
      Bitmap bitmap = Bitmap.createBitmap(ICON_SIZE_PX, ICON_SIZE_PX, Bitmap.Config.ARGB_8888);
      Canvas canvas = new Canvas(bitmap);
      drawable.setBounds(0, 0, ICON_SIZE_PX, ICON_SIZE_PX);
      drawable.draw(canvas);
      try (FileOutputStream fos = new FileOutputStream(outFile)) {
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos);
      }
      bitmap.recycle();
      return true;
    } catch (Exception ignored) {
      return false;
    }
  }

  private static final class IconRender {
    final byte[] pngBytes;
    final String iconHash;

    IconRender(byte[] pngBytes, String iconHash) {
      this.pngBytes = pngBytes;
      this.iconHash = iconHash;
    }
  }

  private static IconRender renderIconPng(Drawable drawable) {
    if (drawable == null) {
      return null;
    }
    try {
      Bitmap bitmap = Bitmap.createBitmap(ICON_SIZE_PX, ICON_SIZE_PX, Bitmap.Config.ARGB_8888);
      Canvas canvas = new Canvas(bitmap);
      drawable.setBounds(0, 0, ICON_SIZE_PX, ICON_SIZE_PX);
      drawable.draw(canvas);

      ByteArrayOutputStream bos = new ByteArrayOutputStream();
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, bos);
      bitmap.recycle();

      byte[] bytes = bos.toByteArray();
      if (bytes.length == 0) {
        return null;
      }

      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(bytes);
      StringBuilder hex = new StringBuilder(hash.length * 2);
      for (byte b : hash) {
        hex.append(String.format("%02x", b));
      }
      return new IconRender(bytes, hex.toString());
    } catch (Exception ignored) {
      return null;
    }
  }

  private void writeProgress(File root, String phase, int total, int done, String current, String message) {
    if (root == null) {
      return;
    }
    try {
      JSONObject json = new JSONObject();
      json.put("phase", phase);
      json.put("total", total);
      json.put("done", done);
      json.put("current", current == null ? "" : current);
      json.put("message", message == null ? "" : message);
      writeText(new File(root, "progress.json"), json.toString());
    } catch (Exception ignored) {
      // ignore
    }
  }

  private static void writeText(File file, String text) throws Exception {
    File parent = file.getParentFile();
    if (parent != null) {
      //noinspection ResultOfMethodCallIgnored
      parent.mkdirs();
    }
    try (FileOutputStream fos = new FileOutputStream(file)) {
      fos.write(text.getBytes(StandardCharsets.UTF_8));
    }
  }

  private void ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null) {
      return;
    }
    nm.createNotificationChannel(new NotificationChannel(
        CHANNEL_ID, getString(R.string.notification_channel), NotificationManager.IMPORTANCE_LOW));
  }

  private Notification buildNotification(String content) {
    Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ? new Notification.Builder(this, CHANNEL_ID)
        : new Notification.Builder(this);
    return builder
        .setContentTitle(getString(R.string.notification_title))
        .setContentText(content)
        .setSmallIcon(android.R.drawable.stat_sys_download)
        .setOngoing(true)
        .build();
  }

  private void updateNotification(String content) {
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm != null) {
      nm.notify(NOTIFICATION_ID, buildNotification(content));
    }
  }

  private void stopSelfSafely() {
    running = false;
    stopForeground(true);
    stopSelf();
  }

  private static final class LauncherApp {
    final String packageName;
    final String activity;
    final String label;
    final Drawable icon;

    LauncherApp(String packageName, String activity, String label, Drawable icon) {
      this.packageName = packageName;
      this.activity = activity;
      this.label = label;
      this.icon = icon;
    }
  }
}
