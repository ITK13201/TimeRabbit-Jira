import { ALARM_HEARTBEAT, HEARTBEAT_INTERVAL_MINUTES } from "@/shared/constants";
import { StorageService } from "./StorageService";
import { TimerController } from "./TimerController";
import { MessageRouter } from "./MessageRouter";

const storageService = new StorageService();
const timerController = new TimerController(storageService);
const messageRouter = new MessageRouter(timerController, storageService);

// Register message handler
messageRouter.register();

// Register heartbeat alarm
chrome.alarms.create(ALARM_HEARTBEAT, { periodInMinutes: HEARTBEAT_INTERVAL_MINUTES });

// Handle heartbeat alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_HEARTBEAT) {
    storageService.pruneExpiredMetaCache().catch((err: unknown) => {
      console.error("[TimeRabbit] pruneExpiredMetaCache error:", err);
    });
  }
});
